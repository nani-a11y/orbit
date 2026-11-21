"""Automated unit & integration tests for the ORBIT Python computational engine.

Run with:
    python3 -m unittest discover -s backend/tests -v
"""

from __future__ import annotations

import json
import math
import sys
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_ROOT.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.schema import OrbitModelSpec  # noqa: E402
from app.simulation.engines.system_dynamics import (  # noqa: E402
    SystemDynamicsEngine,
    compare_results,
)
from app.validation.math_parser import (  # noqa: E402
    UnsafeExpressionError,
    evaluate_expression,
    parse_expression,
)
from app.validation.validator import validate_model  # noqa: E402


class TestASTMathParserSecurity(unittest.TestCase):
    def test_valid_expressions(self):
        parsed = parse_expression("max(0, a * 2.5 + sqrt(b)) / safe_div(c, 2, 1)")
        val = evaluate_expression(parsed, {"a": 4.0, "b": 9.0, "c": 4.0})
        self.assertAlmostEqual(val, 6.5, places=6)

    def test_blocks_dunder_import_and_eval(self):
        unsafe_inputs = [
            "__import__('os').system('echo pwn')",
            "eval('1+1')",
            "exec('x=1')",
            "(lambda x: x)(5)",
            "[x for x in range(10)]",
            "open('/etc/passwd')",
            "a.__class__.__mro__",
            "2 ** 5000",
        ]
        for expr in unsafe_inputs:
            with self.subTest(expr=expr):
                with self.assertRaises((UnsafeExpressionError, ValueError)):
                    parsed = parse_expression(expr)
                    evaluate_expression(parsed, {"a": 1.0})


class TestValidationAndCycles(unittest.TestCase):
    def test_detects_algebraic_cycle(self):
        spec = OrbitModelSpec.from_dict(
            {
                "id": "cyclic",
                "name": "Cyclic Test",
                "description": "Invalid circular auxiliaries",
                "time_config": {"start_time": 0, "end_time": 5, "dt": 0.5, "solver": "euler"},
                "stocks": [{"id": "s", "name": "S", "initial_value": 10, "inflows": [], "outflows": []}],
                "auxiliaries": [
                    {"id": "a", "name": "A", "equation": "b + 1"},
                    {"id": "b", "name": "B", "equation": "a + 1"},
                ],
                "flows": [],
                "parameters": [],
            }
        )
        report = validate_model(spec)
        self.assertFalse(report.valid)
        codes = {e.code for e in report.errors}
        self.assertIn("ALGEBRAIC_DEPENDENCY_CYCLE", codes)

    def test_detects_missing_reference(self):
        spec = OrbitModelSpec.from_dict(
            {
                "id": "missing_ref",
                "name": "Missing Ref",
                "description": "References unknown var",
                "time_config": {"start_time": 0, "end_time": 5, "dt": 0.5, "solver": "euler"},
                "stocks": [{"id": "s", "name": "S", "initial_value": 10, "inflows": ["f"], "outflows": []}],
                "flows": [{"id": "f", "name": "F", "equation": "ghost_var * 2"}],
                "parameters": [],
                "auxiliaries": [],
            }
        )
        report = validate_model(spec)
        self.assertFalse(report.valid)
        codes = {e.code for e in report.errors}
        self.assertIn("MISSING_VARIABLE_REFERENCE", codes)


class TestKnownAnalyticalSolutions(unittest.TestCase):
    def _exponential_growth_model(self, solver: str, dt: float) -> OrbitModelSpec:
        return OrbitModelSpec.from_dict(
            {
                "id": "exp_growth",
                "name": "Analytical Exponential Growth",
                "description": "dP/dt = r * P, exact solution P(t) = P0 * exp(r * t)",
                "time_config": {"start_time": 0, "end_time": 10, "dt": dt, "solver": solver},
                "stocks": [
                    {
                        "id": "pop",
                        "name": "Population",
                        "initial_value": 100.0,
                        "inflows": ["growth"],
                        "outflows": [],
                        "min_value": 0,
                    }
                ],
                "parameters": [{"id": "r", "name": "Rate", "value": 0.1}],
                "flows": [{"id": "growth", "name": "Growth", "equation": "pop * r"}],
                "auxiliaries": [],
            }
        )

    def test_rk4_matches_exact_exponential(self):
        engine = SystemDynamicsEngine()
        res = engine.run(self._exponential_growth_model("rk4", 0.1))
        expected = 100.0 * math.exp(0.1 * 10.0)  # 271.8281828...
        actual = res["series"]["pop"][-1]
        self.assertAlmostEqual(actual, expected, places=4)

    def test_euler_matches_discrete_compound_formula(self):
        engine = SystemDynamicsEngine()
        dt = 0.5
        steps = 20
        res = engine.run(self._exponential_growth_model("euler", dt))
        expected = 100.0 * ((1.0 + 0.1 * dt) ** steps)
        actual = res["series"]["pop"][-1]
        self.assertAlmostEqual(actual, expected, places=4)

    def test_deterministic_reproducibility(self):
        engine = SystemDynamicsEngine()
        spec = self._exponential_growth_model("rk4", 0.25)
        r1 = engine.run(spec, random_seed=123)
        r2 = engine.run(spec, random_seed=123)
        self.assertEqual(r1["series"], r2["series"])
        self.assertEqual(r1["metrics"], r2["metrics"])


class TestUrbanEcosystemDemo(unittest.TestCase):
    def setUp(self):
        model_path = REPO_ROOT / "examples" / "urban_ecosystem" / "model.json"
        self.urban_spec = OrbitModelSpec.from_dict(json.loads(model_path.read_text()))
        self.engine = SystemDynamicsEngine()

    def test_urban_model_validates_and_runs_offline(self):
        report = validate_model(self.urban_spec)
        self.assertTrue(report.valid, f"Unexpected validation errors: {report.errors}")
        res = self.engine.run(self.urban_spec)
        self.assertEqual(res["steps"], 81)  # 0..20 at dt=0.25
        self.assertGreater(res["metrics"]["population"]["final"], 10000)
        self.assertIn("electricity_balance", res["series"])
        self.assertIn("water_reserves", res["series"])

    def test_experiment_override_and_comparison(self):
        baseline = self.engine.run(self.urban_spec)
        variant = self.engine.run(
            self.urban_spec,
            parameter_overrides={"power_stations": 5, "water_reservoirs": 3},
        )
        comp = compare_results(baseline, variant)
        self.assertGreater(
            comp["deltas"]["electricity_balance"]["final_diff"],
            0.0,
        )
        self.assertGreater(
            comp["deltas"]["water_reserves"]["final_diff"],
            0.0,
        )


if __name__ == "__main__":
    unittest.main()
