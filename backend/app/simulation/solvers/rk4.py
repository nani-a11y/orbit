"""Classical 4th-order Runge-Kutta (RK4) numerical integration solver."""

from __future__ import annotations

from typing import Dict
from app.simulation.solvers.base import DerivativeFn, NumericalSolver


class RK4Solver(NumericalSolver):
    name = "rk4"

    def step(
        self,
        t: float,
        dt: float,
        stocks: Dict[str, float],
        derivative_fn: DerivativeFn,
    ) -> Dict[str, float]:
        k1 = derivative_fn(t, stocks)

        s2 = {sid: stocks[sid] + 0.5 * dt * k1[sid] for sid in stocks}
        k2 = derivative_fn(t + 0.5 * dt, s2)

        s3 = {sid: stocks[sid] + 0.5 * dt * k2[sid] for sid in stocks}
        k3 = derivative_fn(t + 0.5 * dt, s3)

        s4 = {sid: stocks[sid] + dt * k3[sid] for sid in stocks}
        k4 = derivative_fn(t + dt, s4)

        return {
            sid: stocks[sid] + (dt / 6.0) * (k1[sid] + 2.0 * k2[sid] + 2.0 * k3[sid] + k4[sid])
            for sid in stocks
        }
