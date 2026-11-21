"""Modular engine adapter interface for ORBIT.

Prepared for future expansion beyond System Dynamics (e.g., Mesa agent-based
models, spatial grid models, and React Three Fiber 3D scene adapters) without
making those libraries mandatory dependencies of the initial MVP.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict

from app.models.schema import OrbitModelSpec


class SimulationEngineAdapter(ABC):
    engine_type: str = "abstract"

    @abstractmethod
    def supports(self, spec: OrbitModelSpec) -> bool:
        """Return True if this adapter can execute the given model spec."""

    @abstractmethod
    def execute(
        self,
        spec: OrbitModelSpec,
        parameter_overrides: Dict[str, float] | None = None,
        time_overrides: Dict[str, Any] | None = None,
        random_seed: int | None = None,
    ) -> Dict[str, Any]:
        """Run the simulation and return canonical ORBIT results."""
