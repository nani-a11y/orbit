"""Abstract numerical solver interface for ORBIT system-dynamics integration."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Callable, Dict

DerivativeFn = Callable[[float, Dict[str, float]], Dict[str, float]]


class NumericalSolver(ABC):
    name: str = "base"

    @abstractmethod
    def step(
        self,
        t: float,
        dt: float,
        stocks: Dict[str, float],
        derivative_fn: DerivativeFn,
    ) -> Dict[str, float]:
        """Advance stock values from time t to t + dt."""
