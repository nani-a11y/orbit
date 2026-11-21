"""Independent validation layer for canonical ORBIT simulation models.

Separates findings cleanly into:
- errors (blocking issues preventing safe execution)
- warnings (non-blocking mathematical/stability advisories)
- assumptions (transparent, editable model premises)

Also builds the directed dependency graph and topological evaluation order
for algebraic (auxiliary + flow) variables while allowing time-delayed
feedback loops through stocks.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Set

from app.models.schema import (
    ALLOWED_ENGINE_TYPES,
    ALLOWED_SOLVERS,
    MAX_DURATION,
    MAX_STEPS,
    MAX_VARIABLES,
    MIN_DT,
    OrbitModelSpec,
)
from app.validation.math_parser import (
    ParsedExpression,
    UnsafeExpressionError,
    evaluate_expression,
    parse_expression,
    validate_identifier,
)


@dataclass
class ValidationIssue:
    code: str
    message: str
    variable: str = ""
    severity: str = "error"  # "error" | "warning"


@dataclass
class ValidationReport:
    valid: bool
    errors: List[ValidationIssue] = field(default_factory=list)
    warnings: List[ValidationIssue] = field(default_factory=list)
    assumptions: List[Dict[str, Any]] = field(default_factory=list)
    evaluation_order: List[str] = field(default_factory=list)
    dependency_graph: Dict[str, Any] = field(default_factory=dict)
    estimated_steps: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid": self.valid,
            "errors": [asdict(e) for e in self.errors],
            "warnings": [asdict(w) for w in self.warnings],
            "assumptions": self.assumptions,
            "evaluation_order": self.evaluation_order,
            "dependency_graph": self.dependency_graph,
            "estimated_steps": self.estimated_steps,
        }


def validate_model(spec: OrbitModelSpec) -> ValidationReport:
    errors: List[ValidationIssue] = []
    warnings: List[ValidationIssue] = []

    # 1. Engine & time configuration checks
    if spec.engine_type not in ALLOWED_ENGINE_TYPES:
        errors.append(
            ValidationIssue(
                code="UNSUPPORTED_ENGINE",
                message=f"Unsupported engine_type '{spec.engine_type}'. Allowed: {', '.join(ALLOWED_ENGINE_TYPES)}.",
            )
        )

    tc = spec.time_config
    if tc.solver not in ALLOWED_SOLVERS:
        errors.append(
            ValidationIssue(
                code="UNSUPPORTED_SOLVER",
                message=f"Unsupported solver '{tc.solver}'. Allowed: {', '.join(ALLOWED_SOLVERS)}.",
            )
        )

    if tc.dt < MIN_DT:
        errors.append(
            ValidationIssue(
                code="DT_TOO_SMALL",
                message=f"Time step dt={tc.dt} is smaller than minimum allowed ({MIN_DT}).",
            )
        )

    duration = tc.end_time - tc.start_time
    if duration <= 0:
        errors.append(
            ValidationIssue(
                code="INVALID_TIME_RANGE",
                message=f"end_time ({tc.end_time}) must be strictly greater than start_time ({tc.start_time}).",
            )
        )
    elif duration > MAX_DURATION:
        errors.append(
            ValidationIssue(
                code="DURATION_EXCEEDS_LIMIT",
                message=f"Simulation duration ({duration}) exceeds limit ({MAX_DURATION}).",
            )
        )

    estimated_steps = int(round(duration / tc.dt)) if tc.dt > 0 and duration > 0 else 0
    if estimated_steps > MAX_STEPS:
        errors.append(
            ValidationIssue(
                code="STEP_LIMIT_EXCEEDED",
                message=f"Estimated steps ({estimated_steps}) exceeds execution limit ({MAX_STEPS}). Increase dt or shorten end_time.",
            )
        )
    elif estimated_steps < 2 and duration > 0:
        warnings.append(
            ValidationIssue(
                code="LOW_STEP_RESOLUTION",
                message="Simulation has fewer than 2 integration steps; decrease dt for meaningful trajectories.",
            )
        )

    if tc.dt > 1.0 and tc.solver == "euler":
        warnings.append(
            ValidationIssue(
                code="EULER_STABILITY_RISK",
                message=f"Euler solver with dt={tc.dt} may exhibit numerical drift on steep feedback loops. Consider dt <= 0.5 or RK4.",
            )
        )

    # 2. Variable inventory & uniqueness checks
    total_vars = len(spec.stocks) + len(spec.flows) + len(spec.parameters) + len(spec.auxiliaries)
    if total_vars == 0:
        errors.append(
            ValidationIssue(
                code="EMPTY_MODEL",
                message="Model must define at least one stock, flow, or variable.",
            )
        )
    elif total_vars > MAX_VARIABLES:
        errors.append(
            ValidationIssue(
                code="VARIABLE_LIMIT_EXCEEDED",
                message=f"Model defines {total_vars} variables, exceeding safety limit ({MAX_VARIABLES}).",
            )
        )

    if not spec.stocks:
        warnings.append(
            ValidationIssue(
                code="NO_STOCKS",
                message="Model has no stocks; state will not accumulate dynamically across time.",
            )
        )

    all_ids: Dict[str, str] = {}
    stock_ids: Set[str] = set()
    flow_ids: Set[str] = set()
    param_ids: Set[str] = set()
    aux_ids: Set[str] = set()

    def register(var_id: str, kind: str) -> None:
        if not var_id:
            errors.append(
                ValidationIssue(
                    code="EMPTY_IDENTIFIER",
                    message=f"A {kind} definition is missing its identifier.",
                )
            )
            return
        if not validate_identifier(var_id):
            errors.append(
                ValidationIssue(
                    code="INVALID_IDENTIFIER",
                    message=f"Identifier '{var_id}' ({kind}) must be a valid snake_case/alphanumeric name and not a reserved keyword.",
                    variable=var_id,
                )
            )
            return
        if var_id in all_ids:
            errors.append(
                ValidationIssue(
                    code="DUPLICATE_IDENTIFIER",
                    message=f"Duplicate identifier '{var_id}' found in both {all_ids[var_id]} and {kind}.",
                    variable=var_id,
                )
            )
            return
        all_ids[var_id] = kind

    for s in spec.stocks:
        register(s.id, "stock")
        stock_ids.add(s.id)
        if s.min_value is not None and s.max_value is not None and s.min_value > s.max_value:
            errors.append(
                ValidationIssue(
                    code="INVALID_BOUNDS",
                    message=f"Stock '{s.id}' min_value ({s.min_value}) exceeds max_value ({s.max_value}).",
                    variable=s.id,
                )
            )
        if s.min_value is not None and s.initial_value < s.min_value:
            warnings.append(
                ValidationIssue(
                    code="INITIAL_BELOW_MIN",
                    message=f"Stock '{s.id}' initial_value ({s.initial_value}) is below min_value ({s.min_value}) and will be clamped.",
                    variable=s.id,
                )
            )

    for p in spec.parameters:
        register(p.id, "parameter")
        param_ids.add(p.id)
        if p.min_value is not None and p.max_value is not None and p.min_value > p.max_value:
            errors.append(
                ValidationIssue(
                    code="INVALID_PARAM_RANGE",
                    message=f"Parameter '{p.id}' min_value exceeds max_value.",
                    variable=p.id,
                )
            )

    for a in spec.auxiliaries:
        register(a.id, "auxiliary")
        aux_ids.add(a.id)

    for f in spec.flows:
        register(f.id, "flow")
        flow_ids.add(f.id)

    # 3. Validate stock <-> flow links
    for s in spec.stocks:
        for fl in s.inflows:
            if fl not in flow_ids:
                errors.append(
                    ValidationIssue(
                        code="MISSING_INFLOW_REFERENCE",
                        message=f"Stock '{s.id}' references unknown inflow '{fl}'.",
                        variable=s.id,
                    )
                )
        for fl in s.outflows:
            if fl not in flow_ids:
                errors.append(
                    ValidationIssue(
                        code="MISSING_OUTFLOW_REFERENCE",
                        message=f"Stock '{s.id}' references unknown outflow '{fl}'.",
                        variable=s.id,
                    )
                )

    for f in spec.flows:
        if f.source_stock and f.source_stock not in stock_ids:
            errors.append(
                ValidationIssue(
                    code="MISSING_SOURCE_STOCK",
                    message=f"Flow '{f.id}' references unknown source_stock '{f.source_stock}'.",
                    variable=f.id,
                )
            )
        if f.target_stock and f.target_stock not in stock_ids:
            errors.append(
                ValidationIssue(
                    code="MISSING_TARGET_STOCK",
                    message=f"Flow '{f.id}' references unknown target_stock '{f.target_stock}'.",
                    variable=f.id,
                )
            )

    # 4. Parse all algebraic equations (auxiliaries + flows) through restricted AST parser
    parsed_equations: Dict[str, ParsedExpression] = {}
    algebraic_deps: Dict[str, Set[str]] = {}

    for item_kind, items in (("auxiliary", spec.auxiliaries), ("flow", spec.flows)):
        for item in items:
            if not item.id:
                continue
            try:
                parsed = parse_expression(item.equation)
                parsed_equations[item.id] = parsed
                algebraic_deps[item.id] = set(parsed.references)

                for ref in sorted(parsed.references):
                    if ref not in all_ids:
                        errors.append(
                            ValidationIssue(
                                code="MISSING_VARIABLE_REFERENCE",
                                message=f"{item_kind.title()} '{item.id}' references undefined identifier '{ref}'.",
                                variable=item.id,
                            )
                        )

                if parsed.has_division:
                    for denom in parsed.division_denominators:
                        if denom in ("0", "0.0"):
                            errors.append(
                                ValidationIssue(
                                    code="STATIC_DIVISION_BY_ZERO",
                                    message=f"{item_kind.title()} '{item.id}' divides directly by zero.",
                                    variable=item.id,
                                )
                            )
                        else:
                            warnings.append(
                                ValidationIssue(
                                    code="DIVISION_ZERO_RISK",
                                    message=f"{item_kind.title()} '{item.id}' divides by '{denom}'; ensure denominator stays non-zero or use safe_div().",
                                    variable=item.id,
                                )
                            )
            except UnsafeExpressionError as exc:
                errors.append(
                    ValidationIssue(
                        code="INVALID_EQUATION",
                        message=f"Equation error in {item_kind} '{item.id}': {exc}",
                        variable=item.id,
                    )
                )

    # 5. Validate constraints
    valid_ops = {"<", "<=", ">", ">="}
    for c in spec.constraints:
        if c.variable not in all_ids:
            errors.append(
                ValidationIssue(
                    code="INVALID_CONSTRAINT_VARIABLE",
                    message=f"Constraint '{c.id}' references unknown variable '{c.variable}'.",
                    variable=c.variable,
                )
            )
        if c.operator not in valid_ops:
            errors.append(
                ValidationIssue(
                    code="INVALID_CONSTRAINT_OPERATOR",
                    message=f"Constraint '{c.id}' uses unsupported operator '{c.operator}'.",
                    variable=c.variable,
                )
            )

    # 6. Topological sort over algebraic nodes (auxiliaries + flows) to detect instantaneous cycles
    algebraic_ids = [x.id for x in spec.auxiliaries if x.id in parsed_equations] + [
        x.id for x in spec.flows if x.id in parsed_equations
    ]
    algebraic_set = set(algebraic_ids)
    in_degree: Dict[str, int] = {vid: 0 for vid in algebraic_ids}
    forward_edges: Dict[str, List[str]] = {vid: [] for vid in algebraic_ids}

    for vid in algebraic_ids:
        for dep in algebraic_deps.get(vid, set()):
            if dep in algebraic_set:
                forward_edges[dep].append(vid)
                in_degree[vid] += 1

    queue = deque(sorted(vid for vid, deg in in_degree.items() if deg == 0))
    evaluation_order: List[str] = []
    while queue:
        curr = queue.popleft()
        evaluation_order.append(curr)
        for nxt in sorted(forward_edges[curr]):
            in_degree[nxt] -= 1
            if in_degree[nxt] == 0:
                queue.append(nxt)

    if len(evaluation_order) < len(algebraic_ids):
        cyclic_nodes = sorted(vid for vid, deg in in_degree.items() if deg > 0)
        errors.append(
            ValidationIssue(
                code="ALGEBRAIC_DEPENDENCY_CYCLE",
                message=(
                    "Circular instantaneous dependency detected among variables: "
                    + ", ".join(cyclic_nodes)
                    + ". Break instantaneous cycles through a stock variable."
                ),
                variable=cyclic_nodes[0],
            )
        )

    # 7. Dry-run initial step evaluation if no errors so far (catches t=0 division by zero / domain errors)
    if not errors:
        env: Dict[str, float] = {"t": tc.start_time, "dt": tc.dt}
        for p in spec.parameters:
            env[p.id] = p.value
        for s in spec.stocks:
            env[s.id] = s.initial_value
        for vid in evaluation_order:
            try:
                env[vid] = evaluate_expression(parsed_equations[vid], env)
            except Exception as exc:
                errors.append(
                    ValidationIssue(
                        code="INITIAL_EVALUATION_ERROR",
                        message=f"Evaluation failed at t={tc.start_time} for '{vid}': {exc}",
                        variable=vid,
                    )
                )

    # 8. Build dependency graph for Cytoscape visualization
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    for s in spec.stocks:
        nodes.append({"id": s.id, "label": s.name, "kind": "stock", "unit": s.unit})
    for f in spec.flows:
        nodes.append({"id": f.id, "label": f.name, "kind": "flow", "unit": f.unit})
    for p in spec.parameters:
        nodes.append({"id": p.id, "label": p.name, "kind": "parameter", "unit": p.unit})
    for a in spec.auxiliaries:
        nodes.append({"id": a.id, "label": a.name, "kind": "auxiliary", "unit": a.unit})

    edge_seen: Set[tuple] = set()
    # Flow-to-stock material edges
    for s in spec.stocks:
        for fl in s.inflows:
            if fl in all_ids and (fl, s.id, "inflow") not in edge_seen:
                edges.append({"source": fl, "target": s.id, "relation": "inflow"})
                edge_seen.add((fl, s.id, "inflow"))
        for fl in s.outflows:
            if fl in all_ids and (s.id, fl, "outflow") not in edge_seen:
                edges.append({"source": s.id, "target": fl, "relation": "outflow"})
                edge_seen.add((s.id, fl, "outflow"))

    # Equation information dependency edges
    for target_id, deps in algebraic_deps.items():
        for dep in sorted(deps):
            if dep in all_ids and (dep, target_id, "depends") not in edge_seen:
                edges.append({"source": dep, "target": target_id, "relation": "depends"})
                edge_seen.add((dep, target_id, "depends"))

    assumptions_out = [asdict(a) for a in spec.assumptions]
    if not assumptions_out:
        warnings.append(
            ValidationIssue(
                code="NO_ASSUMPTIONS_DOCUMENTED",
                message="No explicit modeling assumptions are documented. Consider listing key simplifications.",
            )
        )

    return ValidationReport(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        assumptions=assumptions_out,
        evaluation_order=evaluation_order,
        dependency_graph={"nodes": nodes, "edges": edges},
        estimated_steps=estimated_steps,
    )
