"""Command-line JSON bridge for the ORBIT Python 3.11 computational engine.

Reads a single JSON payload from stdin and writes a single JSON response to stdout.
Commands:
- health: report Python runtime & available solvers
- validate: run independent AST & dependency validation on a model spec
- simulate: run deterministic Euler/RK4 system-dynamics simulation
- compare: compute deterministic deltas between two result payloads
"""

from __future__ import annotations

import json
import platform
import sys
from pathlib import Path
from typing import Any, Dict

# Ensure backend/ is importable as root for `app.*`
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.schema import SCHEMA_VERSION, OrbitModelSpec  # noqa: E402
from app.simulation.engines.system_dynamics import (  # noqa: E402
    SOLVER_REGISTRY,
    SystemDynamicsEngine,
    compare_results,
)
from app.validation.validator import validate_model  # noqa: E402


def handle_command(payload: Dict[str, Any]) -> Dict[str, Any]:
    cmd = str(payload.get("command", "")).lower().strip()

    if cmd == "health":
        return {
            "ok": True,
            "python_version": platform.python_version(),
            "schema_version": SCHEMA_VERSION,
            "solvers": sorted(SOLVER_REGISTRY.keys()),
            "engines": ["system_dynamics"],
        }

    if cmd == "validate":
        model_data = payload.get("model")
        if not isinstance(model_data, dict):
            return {"ok": False, "error": "Missing 'model' object"}
        spec = OrbitModelSpec.from_dict(model_data)
        report = validate_model(spec)
        return {"ok": True, "validation": report.to_dict()}

    if cmd == "simulate":
        model_data = payload.get("model")
        if not isinstance(model_data, dict):
            return {"ok": False, "error": "Missing 'model' object"}
        spec = OrbitModelSpec.from_dict(model_data)
        engine = SystemDynamicsEngine()
        result = engine.run(
            spec,
            parameter_overrides=payload.get("parameter_overrides"),
            time_overrides=payload.get("time_overrides"),
            random_seed=payload.get("random_seed"),
        )
        return {"ok": True, "result": result}

    if cmd == "compare":
        baseline = payload.get("baseline")
        variant = payload.get("variant")
        if not isinstance(baseline, dict) or not isinstance(variant, dict):
            return {"ok": False, "error": "Both 'baseline' and 'variant' result objects are required"}
        comparison = compare_results(baseline, variant)
        return {"ok": True, "comparison": comparison}

    return {"ok": False, "error": f"Unknown command '{cmd}'"}


def main() -> int:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {"command": "health"}
        response = handle_command(payload)
        sys.stdout.write(json.dumps(response))
        return 0
    except Exception as exc:
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
