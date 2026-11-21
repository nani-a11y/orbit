"""Standalone FastAPI entry point for deploying ORBIT's Python backend directly.

Uses the exact same core schema, AST-allowlisted parser, validator, and
SystemDynamicsEngine that power the live Express-to-Python runtime bridge.
"""

from __future__ import annotations

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional

from app.models.schema import SCHEMA_VERSION, OrbitModelSpec
from app.simulation.engines.system_dynamics import (
    SOLVER_REGISTRY,
    SystemDynamicsEngine,
    compare_results,
)
from app.validation.validator import validate_model

app = FastAPI(
    title="ORBIT Computational Simulation API",
    version="1.0.0",
    description="Open-ended Reasoning & Behavior Intelligence for Simulation and Testing.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("ORBIT_FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


class RunRequest(BaseModel):
    model: Dict[str, Any]
    parameter_overrides: Optional[Dict[str, float]] = None
    time_overrides: Optional[Dict[str, Any]] = None
    random_seed: Optional[int] = Field(default=None)


class CompareRequest(BaseModel):
    baseline: Dict[str, Any]
    variant: Dict[str, Any]


@app.get("/api/v1/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "schema_version": SCHEMA_VERSION,
        "solvers": sorted(SOLVER_REGISTRY.keys()),
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
    }


@app.post("/api/v1/models/validate")
def validate_endpoint(model: Dict[str, Any]) -> Dict[str, Any]:
    spec = OrbitModelSpec.from_dict(model)
    return validate_model(spec).to_dict()


@app.post("/api/v1/simulations/run")
def run_simulation(req: RunRequest) -> Dict[str, Any]:
    try:
        spec = OrbitModelSpec.from_dict(req.model)
        engine = SystemDynamicsEngine()
        return engine.run(
            spec,
            parameter_overrides=req.parameter_overrides,
            time_overrides=req.time_overrides,
            random_seed=req.random_seed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (OverflowError, TimeoutError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/v1/experiments/compare")
def compare_endpoint(req: CompareRequest) -> Dict[str, Any]:
    return compare_results(req.baseline, req.variant)
