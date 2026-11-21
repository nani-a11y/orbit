# ORBIT REST API Reference (`/api/v1`)

The ORBIT API Gateway is served by Express on port `3000` under the `/api/v1` prefix. All requests accept and return `application/json` (or `text/csv` for CSV exports).

State-changing requests (`POST`, `PUT`, `DELETE`, `PATCH`) validate the client's `Origin` or `Referer` against the `ALLOWED_ORIGINS` environment allowlist.

---

## 1. System & Health

### `GET /api/v1/health`
Returns runtime status, Python engine availability, supported solvers, and Gemini integration state.

**Response (`200 OK`):**
```json
{
  "status": "ok",
  "python_engine": {
    "available": true,
    "python_version": "3.13.5",
    "schema_version": "1.0.0",
    "solvers": ["euler", "rk4"]
  },
  "database": {
    "engine": "SQLite 3 (WAL mode)",
    "path": "data/orbit.sqlite",
    "size_bytes": 16384
  },
  "gemini": {
    "configured": true,
    "model": "gemini-4-hydrogen"
  }
}
```

---

### `GET /api/v1/dashboard/stats`
Returns aggregated counts and recent activity stored in the local SQLite database.

**Response (`200 OK`):**
```json
{
  "total_projects": 1,
  "total_models": 3,
  "total_runs": 8,
  "total_experiments": 2,
  "total_exports": 4,
  "recent_models": [ ... ],
  "recent_runs": [ ... ],
  "recent_experiments": [ ... ]
}
```

---

## 2. Scenario Modeling & AI Interpretation

### `POST /api/v1/scenarios/interpret`
Translates a natural-language description into a canonical stock-and-flow model draft using server-side Gemini. Validates all generated equations through the Python AST allowlist before returning.

**Request Payload:**
```json
{
  "prompt": "Simulate a fishery with carrying capacity of 120,000 tons and commercial harvesting over 30 years.",
  "duration": 30,
  "time_unit": "years",
  "dt": 0.25,
  "solver": "rk4",
  "skip_clarification": false
}
```

**Response (`200 OK`):**
```json
{
  "needs_clarification": false,
  "summary": "Coastal fishery model with logistic reproduction and density-dependent harvest.",
  "missing_information": [],
  "clarifications": [],
  "model_draft": {
    "id": "fishery-dynamics-abc123",
    "name": "Coastal Fishery Population Dynamics",
    "domain": "Ecology",
    "time_config": {
      "start_time": 0,
      "end_time": 30,
      "dt": 0.25,
      "time_unit": "years",
      "solver": "rk4"
    },
    "stocks": [ ... ],
    "flows": [ ... ],
    "parameters": [ ... ],
    "auxiliaries": [ ... ],
    "constraints": [ ... ],
    "assumptions": [ ... ]
  },
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "evaluation_order": ["harvest_rate", "reproduction_rate", "harvest", "reproduction"]
  }
}
```

---

## 3. Simulation Models CRUD

### `GET /api/v1/models`
List all saved and bundled reference models.

### `POST /api/v1/models`
Persist a new model specification and initial version snapshot.

### `GET /api/v1/models/{model_id}`
Retrieve a model's full JSON specification and immutable version history.

### `PUT /api/v1/models/{model_id}`
Validate and persist an updated model specification as a new version.

### `POST /api/v1/models/{model_id}/validate`
Validate an existing or unsaved draft model through the Python AST validator.

---

## 4. Simulation Execution

### `POST /api/v1/simulations/run`
Executes deterministic numerical integration in the Python engine. Supports non-destructive parameter and time overrides.

**Request Payload:**
```json
{
  "model_id": "urban-ecosystem-baseline",
  "parameter_overrides": {
    "power_stations": 4,
    "water_reservoirs": 3
  },
  "time_overrides": {
    "end_time": 25,
    "dt": 0.25,
    "solver": "rk4"
  },
  "sync": true
}
```

**Response (`201 Created`):**
```json
{
  "run": {
    "id": "run-f481c9b201",
    "model_id": "urban-ecosystem-baseline",
    "model_version": 1,
    "status": "completed",
    "progress": 100,
    "solver": "rk4",
    "execution_ms": 78.4,
    "created_at": "2026-11-22T01:00:00.000Z",
    "completed_at": "2026-11-22T01:00:00.078Z"
  },
  "result": {
    "model_id": "urban-ecosystem-baseline",
    "solver": "rk4",
    "start_time": 0,
    "end_time": 25,
    "dt": 0.25,
    "steps": 101,
    "times": [0, 0.25, 0.5, ...],
    "series": {
      "population": [10000, 10062.7, ...],
      "electricity_balance": [12.0, 11.8, ...]
    },
    "metrics": {
      "population": { "initial": 10000, "final": 15420, "min": 10000, "max": 15420, "pct_change": 54.2 }
    },
    "events": []
  }
}
```

### `POST /api/v1/simulations/{run_id}/cancel`
Cancels an active, running simulation subprocess via `SIGTERM`.

---

## 5. Experiments & Comparisons

### `POST /api/v1/experiments`
Executes both baseline and alternative variant scenarios in the Python engine, records results in SQLite, and computes deterministic delta metrics.

**Request Payload:**
```json
{
  "model_id": "urban-ecosystem-baseline",
  "name": "Grid Expansion Scenario",
  "description": "Examine effect of adding 2 power stations on long-term crowding stress.",
  "parameter_overrides": {
    "power_stations": 5
  }
}
```

---

## 6. Evidence-Grounded AI Analysis

### `POST /api/v1/analysis/explain`
Requests an evidence-grounded explanation from Gemini analyzing computed run metrics or delta comparisons.

**Grounding Guarantees:**
- Gemini receives strictly pre-computed numerical metrics and constraint events.
- System instructions strictly prohibit calculating new numbers, extrapolating, or claiming unproven causal links outside the explicit equations.

---

## 7. Data Exports

### `POST /api/v1/exports`
Generates bounded CSV or JSON bundles and logs the export event.

```bash
curl -X POST http://localhost:3000/api/v1/exports \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -d '{"run_id": "run-f481c9b201", "format": "csv"}'
```
