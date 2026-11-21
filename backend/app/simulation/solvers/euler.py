"""Explicit Forward Euler numerical integration solver."""

from __future__ import annotations

from typing import Dict
from app.simulation.solvers.base import DerivativeFn, NumericalSolver


class EulerSolver(NumericalSolver):
    name = "euler"

    def step(
        self,
        t: float,
        dt: float,
        stocks: Dict[str, float],
        derivative_fn: DerivativeFn,
    ) -> Dict[str, float]:
        derivatives = derivative_fn(t, stocks)
        return {
            stock_id: stocks[stock_id] + dt * derivatives[stock_id]
            for stock_id in stocks
        }
