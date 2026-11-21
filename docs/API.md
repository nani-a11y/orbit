# ORBIT REST API Reference (`/api/v1`)

All endpoints accept and return `application/json`. Validation and execution errors return consistent `{ "error": "<message>" }` payloads.

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Runtime health: Python version, solvers, SQLite DB size, Gemini availability (boolean only) |
| `GET` | `/api/v1/dashboard/stats` | Real SQLite counts and recent models, runs, and experiments |
| `POST` | `/api/v1/scenarios/interpret` | Server-side Gemini interpretation + clarification loop + Python AST validation |
| `GET` | `/api/v1/models` | List all saved and bundled simulation models |
| `POST` | `/api/v1/models` | Save a new canonical model and initial version snapshot |
| `GET` | `/api/v1/models/{id}` | Retrieve model specification and immutable version history |
| `PUT` | `/api/v1/models/{id}` | Validate and persist a new model version (approval requires `valid=true`) |
| `DELETE` | `/api/v1/models/{id}` | Delete a custom simulation model |
| `POST` | `/api/v1/models/{id}/validate` | Independently validate a model or unsaved draft via Python |
| `POST` | `/api/v1/simulations/run` | Execute deterministic Euler/RK4 integration in Python |
| `GET` | `/api/v1/simulations/{run_id}` | Fetch simulation run status and execution metadata |
| `POST` | `/api/v1/simulations/{run_id}/cancel` | Terminate an in-flight Python subprocess and mark run cancelled |
| `GET` | `/api/v1/simulations/{run_id}/results` | Retrieve computed trajectories, metrics, and threshold events |
| `GET` | `/api/v1/experiments` | List saved scenario comparison experiments |
| `POST` | `/api/v1/experiments` | Non-destructively execute baseline + variant and compute numerical deltas |
| `POST` | `/api/v1/experiments/compare` | Recompute deterministic deltas between any two completed run IDs |
| `POST` | `/api/v1/analysis/explain` | Evidence-grounded Gemini explanation for a run or baseline-vs-variant comparison |
| `POST` | `/api/v1/exports` | Generate size-bounded CSV/JSON exports or log PDF report exports |
