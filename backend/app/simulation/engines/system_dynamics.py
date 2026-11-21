"""Deterministic System Dynamics simulation engine for ORBIT.

Executes validated stock-and-flow models using pluggable numerical solvers
(Euler, RK4), records full time-series trajectories, detects constraint and
regime-shift events, enforces numerical stability guards, and computes
reproducible summary statistics and experiment comparison deltas.
"""

from __future__ import annotations

import math
import random
import time
from typing import Any, Dict, List, Optional

from app.models.schema import MAX_STEPS, OrbitModelSpec
from app.simulation.solvers.base import NumericalSolver
from app.simulation.solvers.euler import EulerSolver
from app.simulation.solvers.rk4 import RK4Solver
from app.validation.math_parser import ParsedExpression, evaluate_expression, parse_expression
from app.validation.validator import validate_model

MAX_MAGNITUDE = 1e15
MAX_EXECUTION_SECONDS = 12.0

SOLVER_REGISTRY: Dict[str, NumericalSolver] = {
    "euler": EulerSolver(),
    "rk4": RK4Solver(),
}


def _check_constraint(value: float, operator: str, threshold: float) -> bool:
    if operator == "<":
        return value < threshold
    if operator == "<=":
        return value <= threshold
    if operator == ">":
        return value > threshold
    if operator == ">=":
        return value >= threshold
    return False


class SystemDynamicsEngine:
    """Pure Python deterministic stock-and-flow simulation engine."""

    def run(
        self,
        spec: OrbitModelSpec,
        parameter_overrides: Optional[Dict[str, float]] = None,
        time_overrides: Optional[Dict[str, Any]] = None,
        random_seed: Optional[int] = None,
    ) -> Dict[str, Any]:
        started_wall = time.perf_counter()

        # Apply non-destructive runtime overrides on a shallow copy of values
        eff_spec = OrbitModelSpec.from_dict(spec.to_dict())
        if time_overrides:
            if "start_time" in time_overrides and time_overrides["start_time"] is not None:
                eff_spec.time_config.start_time = float(time_overrides["start_time"])
            if "end_time" in time_overrides and time_overrides["end_time"] is not None:
                eff_spec.time_config.end_time = float(time_overrides["end_time"])
            if "dt" in time_overrides and time_overrides["dt"] is not None:
                eff_spec.time_config.dt = float(time_overrides["dt"])
            if "solver" in time_overrides and time_overrides["solver"]:
                eff_spec.time_config.solver = str(time_overrides["solver"]).lower()

        if random_seed is not None:
            eff_spec.random_seed = int(random_seed)

        overrides_applied: Dict[str, float] = {}
        if parameter_overrides:
            param_map = {p.id: p for p in eff_spec.parameters}
            stock_map = {s.id: s for s in eff_spec.stocks}
            for key, raw_val in parameter_overrides.items():
                val = float(raw_val)
                if not math.isfinite(val):
                    raise ValueError(f"Override for '{key}' must be a finite number")
                if key in param_map:
                    param_map[key].value = val
                    overrides_applied[key] = val
                elif key in stock_map:
                    stock_map[key].initial_value = val
                    overrides_applied[key] = val

        report = validate_model(eff_spec)
        if not report.valid:
            first_err = report.errors[0].message if report.errors else "Model validation failed"
            raise ValueError(f"Validation failed: {first_err}")

        # Seed deterministic PRNG (reserved for future stochastic extensions)
        _rng = random.Random(eff_spec.random_seed)
        _ = _rng.random()

        tc = eff_spec.time_config
        solver = SOLVER_REGISTRY.get(tc.solver)
        if solver is None:
            raise ValueError(f"Unsupported solver '{tc.solver}'")

        # Pre-parse all equations once through the AST allowlist
        parsed_eqs: Dict[str, ParsedExpression] = {}
        flow_map = {f.id: f for f in eff_spec.flows}
        for a in eff_spec.auxiliaries:
            parsed_eqs[a.id] = parse_expression(a.equation)
        for f in eff_spec.flows:
            parsed_eqs[f.id] = parse_expression(f.equation)

        eval_order = report.evaluation_order
        base_params = {p.id: p.value for p in eff_spec.parameters}
        stock_defs = {s.id: s for s in eff_spec.stocks}

        def clamp_stock(sid: str, val: float) -> float:
            sdef = stock_defs[sid]
            if not math.isfinite(val) or abs(val) > MAX_MAGNITUDE:
                raise OverflowError(
                    f"Numerical instability detected in stock '{sid}' (value={val})"
                )
            if sdef.min_value is not None and val < sdef.min_value:
                val = sdef.min_value
            if sdef.max_value is not None and val > sdef.max_value:
                val = sdef.max_value
            return val

        def evaluate_all(t_curr: float, current_stocks: Dict[str, float]) -> Dict[str, float]:
            env: Dict[str, float] = {"t": t_curr, "dt": tc.dt}
            env.update(base_params)
            env.update(current_stocks)
            for vid in eval_order:
                val = evaluate_expression(parsed_eqs[vid], env)
                if vid in flow_map and flow_map[vid].non_negative and val < 0.0:
                    val = 0.0
                if not math.isfinite(val) or abs(val) > MAX_MAGNITUDE:
                    raise OverflowError(
                        f"Numerical overflow in variable '{vid}' at t={t_curr:.3f}"
                    )
                env[vid] = val
            return env

        def compute_derivatives(t_curr: float, current_stocks: Dict[str, float]) -> Dict[str, float]:
            env = evaluate_all(t_curr, current_stocks)
            derivs: Dict[str, float] = {}
            for s in eff_spec.stocks:
                inflow_sum = sum(env.get(fid, 0.0) for fid in s.inflows)
                outflow_sum = sum(env.get(fid, 0.0) for fid in s.outflows)
                derivs[s.id] = inflow_sum - outflow_sum
            return derivs

        # Initialize stocks
        stocks: Dict[str, float] = {
            s.id: clamp_stock(s.id, s.initial_value) for s in eff_spec.stocks
        }

        num_steps = int(round((tc.end_time - tc.start_time) / tc.dt))
        if num_steps > MAX_STEPS:
            raise ValueError(f"Step count {num_steps} exceeds maximum {MAX_STEPS}")

        times: List[float] = []
        tracked_vars = (
            [s.id for s in eff_spec.stocks]
            + [a.id for a in eff_spec.auxiliaries]
            + [f.id for f in eff_spec.flows]
        )
        series: Dict[str, List[float]] = {vid: [] for vid in tracked_vars}
        events: List[Dict[str, Any]] = []
        active_constraints: Dict[str, bool] = {c.id: False for c in eff_spec.constraints}

        for step_idx in range(num_steps + 1):
            if step_idx % 100 == 0 and (time.perf_counter() - started_wall) > MAX_EXECUTION_SECONDS:
                raise TimeoutError(
                    f"Simulation exceeded maximum wall time ({MAX_EXECUTION_SECONDS}s)"
                )

            t_curr = round(tc.start_time + step_idx * tc.dt, 8)
            env = evaluate_all(t_curr, stocks)

            times.append(round(t_curr, 4))
            for vid in tracked_vars:
                series[vid].append(round(float(env[vid]), 6))

            # Detect constraint threshold crossings (transition into or out of violated state)
            for c in eff_spec.constraints:
                if c.variable not in env:
                    continue
                val = float(env[c.variable])
                triggered = _check_constraint(val, c.operator, c.threshold)
                was_active = active_constraints.get(c.id, False)
                if triggered and not was_active:
                    active_constraints[c.id] = True
                    events.append(
                        {
                            "time": round(t_curr, 4),
                            "step": step_idx,
                            "type": "constraint_triggered",
                            "severity": c.severity,
                            "variable": c.variable,
                            "value": round(val, 4),
                            "threshold": c.threshold,
                            "message": c.label
                            or f"{c.variable} crossed {c.operator} {c.threshold} (value={val:.2f})",
                        }
                    )
                elif not triggered and was_active:
                    active_constraints[c.id] = False
                    events.append(
                        {
                            "time": round(t_curr, 4),
                            "step": step_idx,
                            "type": "constraint_recovered",
                            "severity": "info",
                            "variable": c.variable,
                            "value": round(val, 4),
                            "threshold": c.threshold,
                            "message": f"{c.variable} recovered from threshold {c.operator} {c.threshold}",
                        }
                    )

            # Advance stocks for next step
            if step_idx < num_steps:
                next_stocks = solver.step(t_curr, tc.dt, stocks, compute_derivatives)
                stocks = {sid: clamp_stock(sid, val) for sid, val in next_stocks.items()}

        # Compute deterministic summary statistics for every tracked variable
        metrics: Dict[str, Dict[str, Any]] = {}
        for vid in tracked_vars:
            vals = series[vid]
            if not vals:
                continue
            initial_v = vals[0]
            final_v = vals[-1]
            min_v = min(vals)
            max_v = max(vals)
            min_idx = vals.index(min_v)
            max_idx = vals.index(max_v)
            mean_v = sum(vals) / len(vals)
            abs_change = final_v - initial_v
            pct_change = (
                ((final_v - initial_v) / abs(initial_v)) * 100.0
                if abs(initial_v) > 1e-9
                else None
            )
            metrics[vid] = {
                "initial": round(initial_v, 4),
                "final": round(final_v, 4),
                "min": round(min_v, 4),
                "min_time": times[min_idx],
                "max": round(max_v, 4),
                "max_time": times[max_idx],
                "mean": round(mean_v, 4),
                "abs_change": round(abs_change, 4),
                "pct_change": round(pct_change, 2) if pct_change is not None else None,
            }

        elapsed_ms = round((time.perf_counter() - started_wall) * 1000.0, 2)

        return {
            "model_id": eff_spec.id,
            "model_version": eff_spec.version,
            "solver": tc.solver,
            "time_unit": tc.time_unit,
            "start_time": tc.start_time,
            "end_time": tc.end_time,
            "dt": tc.dt,
            "steps": len(times),
            "random_seed": eff_spec.random_seed,
            "parameter_overrides": overrides_applied,
            "execution_ms": elapsed_ms,
            "times": times,
            "series": series,
            "metrics": metrics,
            "events": events,
            "warnings": [w.message for w in report.warnings],
            "assumptions": report.assumptions,
        }


def compare_results(
    baseline: Dict[str, Any],
    variant: Dict[str, Any],
) -> Dict[str, Any]:
    """Deterministically compare two simulation result payloads."""
    base_metrics = baseline.get("metrics", {})
    var_metrics = variant.get("metrics", {})
    base_series = baseline.get("series", {})
    var_series = variant.get("series", {})
    times = baseline.get("times", [])

    shared_vars = [v for v in base_metrics.keys() if v in var_metrics]
    deltas: Dict[str, Dict[str, Any]] = {}

    for vid in shared_vars:
        bm = base_metrics[vid]
        vm = var_metrics[vid]
        final_diff = vm["final"] - bm["final"]
        final_pct = (
            (final_diff / abs(bm["final"])) * 100.0
            if abs(bm["final"]) > 1e-9
            else None
        )
        peak_diff = vm["max"] - bm["max"]
        mean_diff = vm["mean"] - bm["mean"]

        # Maximum point-in-time absolute divergence
        b_arr = base_series.get(vid, [])
        v_arr = var_series.get(vid, [])
        n = min(len(b_arr), len(v_arr), len(times))
        max_abs_div = 0.0
        max_div_time = times[0] if times else 0.0
        for i in range(n):
            d = abs(v_arr[i] - b_arr[i])
            if d > max_abs_div:
                max_abs_div = d
                max_div_time = times[i]

        deltas[vid] = {
            "baseline_final": bm["final"],
            "variant_final": vm["final"],
            "final_diff": round(final_diff, 4),
            "final_pct_diff": round(final_pct, 2) if final_pct is not None else None,
            "baseline_max": bm["max"],
            "variant_max": vm["max"],
            "peak_diff": round(peak_diff, 4),
            "mean_diff": round(mean_diff, 4),
            "max_abs_divergence": round(max_abs_div, 4),
            "max_divergence_time": max_div_time,
        }

    # Rank variables by relative magnitude of final change
    ranked = sorted(
        shared_vars,
        key=lambda v: abs(deltas[v]["final_pct_diff"] or 0.0),
        reverse=True,
    )

    return {
        "shared_variables": shared_vars,
        "most_affected_variables": ranked[:6],
        "deltas": deltas,
        "baseline_event_count": len(baseline.get("events", [])),
        "variant_event_count": len(variant.get("events", [])),
    }
