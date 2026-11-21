"""Canonical ORBIT Simulation Model Specification (v1.0.0).

Designed with Python 3.11 standard library dataclasses so the core validation
and simulation engine run deterministically with zero third-party dependencies,
while mirroring the Pydantic schemas used by the standalone FastAPI layer.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

SCHEMA_VERSION = "1.0.0"

# Execution safety bounds (tuned for 4-core / 8 GB CPU-only machines)
MAX_VARIABLES = 80
MAX_STEPS = 5000
MIN_DT = 1e-4
MAX_DURATION = 10000.0
ALLOWED_SOLVERS = ("euler", "rk4")
ALLOWED_ENGINE_TYPES = ("system_dynamics",)


@dataclass
class TimeConfig:
    start_time: float = 0.0
    end_time: float = 20.0
    dt: float = 0.25
    time_unit: str = "years"
    solver: str = "euler"

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TimeConfig":
        return cls(
            start_time=float(data.get("start_time", 0.0)),
            end_time=float(data.get("end_time", 20.0)),
            dt=float(data.get("dt", 0.25)),
            time_unit=str(data.get("time_unit", "years")),
            solver=str(data.get("solver", "euler")).lower(),
        )


@dataclass
class StockDefinition:
    id: str
    name: str
    initial_value: float
    unit: str = ""
    description: str = ""
    inflows: List[str] = field(default_factory=list)
    outflows: List[str] = field(default_factory=list)
    min_value: Optional[float] = 0.0
    max_value: Optional[float] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StockDefinition":
        return cls(
            id=str(data.get("id", "")).strip(),
            name=str(data.get("name", data.get("id", ""))).strip(),
            initial_value=float(data.get("initial_value", 0.0)),
            unit=str(data.get("unit", "")),
            description=str(data.get("description", "")),
            inflows=[str(x).strip() for x in data.get("inflows", []) if str(x).strip()],
            outflows=[str(x).strip() for x in data.get("outflows", []) if str(x).strip()],
            min_value=None if data.get("min_value") is None else float(data["min_value"]),
            max_value=None if data.get("max_value") is None else float(data["max_value"]),
        )


@dataclass
class FlowDefinition:
    id: str
    name: str
    equation: str
    unit: str = ""
    description: str = ""
    source_stock: Optional[str] = None
    target_stock: Optional[str] = None
    non_negative: bool = True

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FlowDefinition":
        src = data.get("source_stock")
        tgt = data.get("target_stock")
        return cls(
            id=str(data.get("id", "")).strip(),
            name=str(data.get("name", data.get("id", ""))).strip(),
            equation=str(data.get("equation", "0")).strip(),
            unit=str(data.get("unit", "")),
            description=str(data.get("description", "")),
            source_stock=str(src).strip() if src else None,
            target_stock=str(tgt).strip() if tgt else None,
            non_negative=bool(data.get("non_negative", True)),
        )


@dataclass
class ParameterDefinition:
    id: str
    name: str
    value: float
    unit: str = ""
    description: str = ""
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    step: Optional[float] = None
    editable: bool = True

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ParameterDefinition":
        return cls(
            id=str(data.get("id", "")).strip(),
            name=str(data.get("name", data.get("id", ""))).strip(),
            value=float(data.get("value", 0.0)),
            unit=str(data.get("unit", "")),
            description=str(data.get("description", "")),
            min_value=None if data.get("min_value") is None else float(data["min_value"]),
            max_value=None if data.get("max_value") is None else float(data["max_value"]),
            step=None if data.get("step") is None else float(data["step"]),
            editable=bool(data.get("editable", True)),
        )


@dataclass
class AuxiliaryDefinition:
    id: str
    name: str
    equation: str
    unit: str = ""
    description: str = ""

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AuxiliaryDefinition":
        return cls(
            id=str(data.get("id", "")).strip(),
            name=str(data.get("name", data.get("id", ""))).strip(),
            equation=str(data.get("equation", "0")).strip(),
            unit=str(data.get("unit", "")),
            description=str(data.get("description", "")),
        )


@dataclass
class ConstraintDefinition:
    id: str
    variable: str
    operator: str  # "<", "<=", ">", ">="
    threshold: float
    severity: str = "warning"  # "info", "warning", "critical"
    label: str = ""

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConstraintDefinition":
        return cls(
            id=str(data.get("id", "")).strip() or f"constraint_{data.get('variable', 'var')}",
            variable=str(data.get("variable", "")).strip(),
            operator=str(data.get("operator", "<")).strip(),
            threshold=float(data.get("threshold", 0.0)),
            severity=str(data.get("severity", "warning")).lower(),
            label=str(data.get("label", "")).strip(),
        )


@dataclass
class AssumptionDefinition:
    id: str
    statement: str
    category: str = "modeling"
    source: str = "illustrative"
    impact: str = "medium"
    editable_parameter: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AssumptionDefinition":
        return cls(
            id=str(data.get("id", "")).strip() or "assumption",
            statement=str(data.get("statement", "")).strip(),
            category=str(data.get("category", "modeling")).strip(),
            source=str(data.get("source", "illustrative")).strip(),
            impact=str(data.get("impact", "medium")).lower(),
            editable_parameter=data.get("editable_parameter"),
        )


@dataclass
class OrbitModelSpec:
    id: str
    name: str
    description: str
    domain: str = "general"
    schema_version: str = SCHEMA_VERSION
    version: int = 1
    engine_type: str = "system_dynamics"
    time_config: TimeConfig = field(default_factory=TimeConfig)
    stocks: List[StockDefinition] = field(default_factory=list)
    flows: List[FlowDefinition] = field(default_factory=list)
    parameters: List[ParameterDefinition] = field(default_factory=list)
    auxiliaries: List[AuxiliaryDefinition] = field(default_factory=list)
    constraints: List[ConstraintDefinition] = field(default_factory=list)
    assumptions: List[AssumptionDefinition] = field(default_factory=list)
    random_seed: int = 42
    visualization: Dict[str, Any] = field(default_factory=dict)
    approved: bool = False

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "OrbitModelSpec":
        return cls(
            id=str(data.get("id", "")).strip(),
            name=str(data.get("name", "Untitled Simulation")).strip(),
            description=str(data.get("description", "")).strip(),
            domain=str(data.get("domain", "general")).strip(),
            schema_version=str(data.get("schema_version", SCHEMA_VERSION)),
            version=int(data.get("version", 1)),
            engine_type=str(data.get("engine_type", "system_dynamics")).lower(),
            time_config=TimeConfig.from_dict(data.get("time_config", {})),
            stocks=[StockDefinition.from_dict(x) for x in data.get("stocks", [])],
            flows=[FlowDefinition.from_dict(x) for x in data.get("flows", [])],
            parameters=[ParameterDefinition.from_dict(x) for x in data.get("parameters", [])],
            auxiliaries=[AuxiliaryDefinition.from_dict(x) for x in data.get("auxiliaries", [])],
            constraints=[ConstraintDefinition.from_dict(x) for x in data.get("constraints", [])],
            assumptions=[AssumptionDefinition.from_dict(x) for x in data.get("assumptions", [])],
            random_seed=int(data.get("random_seed", 42)),
            visualization=dict(data.get("visualization", {})),
            approved=bool(data.get("approved", False)),
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
