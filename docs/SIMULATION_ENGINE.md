# Simulation Engine & Numerical Methods

## Stock-and-Flow Formulation

Each stock $S_i(t)$ evolves according to the coupled ordinary differential equation:

$$\frac{dS_i}{dt} = \sum_{f \in \text{inflows}(i)} F_f(t, \mathbf{S}, \mathbf{P}) - \sum_{g \in \text{outflows}(i)} F_g(t, \mathbf{S}, \mathbf{P})$$

At every integration step (and substep for RK4):
1. Parameters $\mathbf{P}$ and current stock values $\mathbf{S}$ populate the evaluation environment along with $t$ and $\Delta t$.
2. Auxiliary variables and flows are evaluated strictly in topological order (computed via Kahn's algorithm during validation).
3. Non-negative flows are clamped at $0$, and stock bounds `[min_value, max_value]` are applied after each step.

## Numerical Solvers

- **Forward Euler (`euler`)**: $\mathbf{S}(t + \Delta t) = \mathbf{S}(t) + \Delta t \cdot \mathbf{f}(t, \mathbf{S}(t))$. Fast 1st-order baseline useful for pedagogical inspection and discrete step comparisons.
- **Runge-Kutta 4th Order (`rk4`)**: Classical 4-stage RK4 with local truncation error $O(\Delta t^5)$ and global error $O(\Delta t^4)$. Recommended default for coupled feedback systems.

## Verification

Unit tests in `backend/tests/test_engine.py` verify analytical convergence against $P(t) = P_0 e^{rt}$, deterministic seed reproducibility, algebraic cycle rejection, and offline execution of the Urban Ecosystem model.
