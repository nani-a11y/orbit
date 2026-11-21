# Simulation Engine & Numerical Methods

ORBIT executes continuous-time dynamic models by formulating them as coupled ordinary differential equations (ODEs) and solving them with deterministic numerical integration algorithms.

---

## 1. Stock-and-Flow Formulation

In ORBIT's system dynamics formulation, each stock $S_i(t)$ represents an integrated state variable governed by the differential equation:

$$\frac{dS_i}{dt} = \sum_{f \in \text{inflows}(i)} F_f(t, \mathbf{S}, \mathbf{A}, \mathbf{P}) - \sum_{g \in \text{outflows}(i)} F_g(t, \mathbf{S}, \mathbf{A}, \mathbf{P})$$

where:
- $\mathbf{S} = [S_1, S_2, \dots, S_n]^T$ is the vector of stocks (state variables).
- $\mathbf{P}$ is the vector of exogenous parameters.
- $\mathbf{A}$ is the vector of intermediate auxiliary variables.
- $F_f$ and $F_g$ are flow equations defining rates of addition and depletion.

---

## 2. Evaluation Sequence & Topological Sorting

Because auxiliary variables and flow equations can depend on one another, instantaneous circular dependencies must be detected and rejected before simulation begins.

During model validation (`backend/app/validation/validator.py`), ORBIT constructs a directed acyclic dependency graph (DAG) and computes an exact topological evaluation order using **Kahn's Algorithm**:

1. **Graph Construction**: Identify incoming edges from referenced variables to dependent equations.
2. **Cycle Detection**: If the topological sort terminates with unvisited nodes, an `ALGEBRAIC_DEPENDENCY_CYCLE` error is emitted and execution is blocked.
3. **Execution Order**: At every time step (and every sub-stage of multi-stage solvers), variables are evaluated strictly in topological order.
4. **Stock Clamping**: Stocks with explicit `min_value` or `max_value` definitions are bounded at the end of each integration step.

---

## 3. Pluggable Numerical Solvers

ORBIT implements a pluggable `NumericalSolver` interface (`backend/app/simulation/solvers/base.py`).

### Forward Euler Solver (`euler`)

The simplest 1st-order explicit integration method:

$$\mathbf{S}(t + \Delta t) = \mathbf{S}(t) + \Delta t \cdot \mathbf{f}(t, \mathbf{S}(t))$$

- **Local Truncation Error**: $O(\Delta t^2)$
- **Global Error**: $O(\Delta t)$
- **Use Case**: Fast discrete approximations, pedagogical demonstration, and simple single-variable models.

### Classical 4th-Order Runge-Kutta (`rk4`)

ORBIT's recommended default solver for coupled non-linear feedback systems. Computes four intermediate slope estimates across each interval $\Delta t$:

$$\begin{aligned}
\mathbf{k}_1 &= \mathbf{f}(t, \mathbf{S}(t)) \\
\mathbf{k}_2 &= \mathbf{f}\left(t + \frac{\Delta t}{2}, \mathbf{S}(t) + \frac{\Delta t}{2} \mathbf{k}_1\right) \\
\mathbf{k}_3 &= \mathbf{f}\left(t + \frac{\Delta t}{2}, \mathbf{S}(t) + \frac{\Delta t}{2} \mathbf{k}_2\right) \\
\mathbf{k}_4 &= \mathbf{f}\left(t + \Delta t, \mathbf{S}(t) + \Delta t \cdot \mathbf{k}_3\right) \\
\mathbf{S}(t + \Delta t) &= \mathbf{S}(t) + \frac{\Delta t}{6} \left(\mathbf{k}_1 + 2\mathbf{k}_2 + 2\mathbf{k}_3 + \mathbf{k}_4\right)
\end{aligned}$$

- **Local Truncation Error**: $O(\Delta t^5)$
- **Global Error**: $O(\Delta t^4)$
- **Use Case**: Non-linear feedback models, oscillatory systems, and scenarios with high stiffness.

---

## 4. Stability & Guardrails

To prevent runaway divergence or unbounded computation:

- **Magnitude Ceiling**: If any variable exceeds $|10^{15}|$, integration halts immediately with an `OverflowError` alerting the user to numerical instability.
- **Maximum Step Limit**: Simulations are capped at a maximum of `5,000` steps (`MAX_STEPS`).
- **Wall-Clock Timeout**: Python integration runs under a strict 12-second engine ceiling (`MAX_EXECUTION_SECONDS`) and a 15-second process timeout enforced by Node.js.
- **Safe Operations**: Built-in helper functions like `safe_div(num, den, fallback)` prevent division-by-zero crashes.

---

## 5. Analytical Verification & Tests

The simulation engine is verified against exact analytical ground truths in `backend/tests/test_engine.py`:

| Model / Test Case | Analytical Ground Truth | Numerical Result | Accuracy |
| :--- | :--- | :--- | :--- |
| **Exponential Growth ($r=0.1, t=10$)** | $P(10) = 100 \cdot e^{1.0} \approx 271.82818$ | RK4: `271.82818` | Exact to 4 decimal places |
| **Euler Discrete Compound ($dt=0.5, 20\text{ steps}$)** | $P_{20} = 100 \cdot (1 + 0.1 \times 0.5)^{20} \approx 265.32977$ | Euler: `265.32977` | Exact match |
| **Urban Ecosystem Benchmark** | Offline execution over 20 years ($dt=0.25$) | 81 integration steps | Verified convergence |
