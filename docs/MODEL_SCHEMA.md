# ORBIT Model Specification (`v1.0.0`)

ORBIT models are defined using a canonical, declarative JSON specification representing coupled systems of ordinary differential equations (ODEs) formulated as **Stock-and-Flow System Dynamics**.

---

## Specification Schema Structure

A valid ORBIT model document conforms to the following top-level structure:

```typescript
interface OrbitModelSpec {
  id: string;                      // Unique slug (e.g., "urban-ecosystem-baseline")
  name: string;                    // Human-readable title
  description: string;             // Detailed narrative of system boundaries & intent
  domain: string;                  // System domain (e.g., "Urban Systems", "Epidemiology")
  schema_version: "1.0.0";         // Specification version
  version: number;                 // Monotonically increasing revision number
  engine_type: "system_dynamics";  // Target execution engine
  time_config: TimeConfig;         // Integration horizon and solver configuration
  stocks: StockDefinition[];       // Integrated state variables
  flows: FlowDefinition[];         // Rate equations governing state transitions
  parameters: ParameterDefinition[];// Exogenous constants and scenario inputs
  auxiliaries: AuxiliaryDefinition[];// Intermediate algebraic variables
  constraints: ConstraintDefinition[];// Invariant thresholds and alerts
  assumptions: AssumptionDefinition[];// Documented modeling assumptions
  random_seed: number;             // Deterministic pseudo-random seed (default: 42)
  approved: boolean;               // Validation approval gate status
}
```

---

## Component Definitions

### 1. `time_config` (Temporal Horizon & Solver)

Specifies the numerical integration interval and solver algorithm:

```json
{
  "start_time": 0,
  "end_time": 20,
  "dt": 0.25,
  "time_unit": "years",
  "solver": "rk4"
}
```

- `dt`: Numerical integration step size. Local truncation error scales as $O(\Delta t^2)$ for Euler and $O(\Delta t^5)$ for RK4.
- `solver`: `"euler"` (1st-order forward integration) or `"rk4"` (classical 4th-order Runge-Kutta).

---

### 2. `stocks` (State Variables)

Stocks represent physical, financial, or biological quantities that accumulate or deplete over time. Each stock evolves according to:

$$\frac{dS_i}{dt} = \sum_{f \in \text{inflows}} F_f - \sum_{g \in \text{outflows}} F_g$$

```json
{
  "id": "population",
  "name": "Population",
  "initial_value": 10000,
  "unit": "residents",
  "description": "Total active residents living within municipal boundaries.",
  "inflows": ["births"],
  "outflows": ["deaths"],
  "min_value": 0,
  "max_value": 500000
}
```

---

### 3. `flows` (Rate Equations)

Flows define the instantaneous rates of change moving into or out of stocks.

```json
{
  "id": "births",
  "name": "Births & Migration Inflow",
  "equation": "population * base_birth_rate * clamp(infrastructure_capacity / population, 0.4, 1.4)",
  "unit": "residents/year",
  "description": "Annual births and incoming residents modulated by infrastructure adequacy.",
  "source_stock": null,
  "target_stock": "population",
  "non_negative": true
}
```

- `source_stock`: Stock ID being depleted (or `null` if drawn from an infinite boundary).
- `target_stock`: Stock ID being augmented (or `null` if exiting system boundaries).
- `non_negative`: Clamps negative evaluated rates to `0.0` when true.

---

### 4. `parameters` (Constants & Scenario Inputs)

Exogenous constants that can be non-destructively overridden during experiment comparison:

```json
{
  "id": "power_stations",
  "name": "Active Power Stations",
  "value": 3,
  "unit": "plants",
  "description": "Number of active municipal power generation stations.",
  "min_value": 1,
  "max_value": 10,
  "step": 1,
  "editable": true
}
```

---

### 5. `auxiliaries` (Algebraic Equations)

Intermediate computed variables evaluated at each step. Evaluated strictly in topological dependency order:

```json
{
  "id": "electricity_balance",
  "name": "Electricity Balance",
  "equation": "electricity_production - electricity_demand",
  "unit": "MW",
  "description": "Surplus generation or capacity shortfall across the municipal grid."
}
```

---

### 6. `constraints` (Threshold Monitoring)

Threshold rules monitored continuously throughout the simulation. State crossings generate structured event logs:

```json
{
  "id": "grid_blackout_warning",
  "variable": "electricity_balance",
  "operator": "<",
  "threshold": 0,
  "severity": "critical",
  "label": "Grid shortfall: demand exceeds generation capacity."
}
```

---

### 7. `assumptions` (Scientific Limitations)

Explicit documentation of domain assumptions distinguishing user-specified constraints from estimated parameters:

```json
{
  "id": "assump_hydro_recharge",
  "statement": "Annual water recharge assumes historical 10-year mean rainfall with zero severe drought events.",
  "category": "environmental",
  "source": "Municipal Water Authority 2024 Report",
  "impact": "high"
}
```

---

## Equation Language & Sandbox Constraints

Equations in flows and auxiliaries must conform to ORBIT's restricted AST grammar:

- **Allowed Operators**: `+`, `-`, `*`, `/`, `**`, `==`, `!=`, `<`, `<=`, `>`, `>=`, and ternary conditional (`a if cond else b`).
- **Allowed Functions**: `min`, `max`, `abs`, `sqrt`, `exp`, `log`, `ln`, `sin`, `cos`, `pow`, `round`, `clamp(val, min, max)`, `safe_div(num, den, fallback)`, `step(t, threshold)`.
- **Prohibited**: Loops, comprehensions, imports, lambdas, attribute access (`__class__`), indexing, or variable definitions.
