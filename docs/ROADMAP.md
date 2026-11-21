# ORBIT Technical Roadmap

This roadmap documents the engineering milestones for ORBIT, separating completed capabilities from active and planned research initiatives.

---

## 1. Completed (`v1.0.0` Initial Production Release)

- [x] **Canonical Model Schema (`v1.0.0`)**: Strongly-typed JSON specification with schema validation in Python (`pydantic`) and TypeScript.
- [x] **Deterministic System Dynamics Engine**: Stock-and-flow integration engine in pure Python 3.11 with zero live C-extension dependencies.
- [x] **Pluggable Solvers**: 1st-order Forward Euler and 4th-order classical Runge-Kutta (`rk4`) with exact analytical verification against exponential growth.
- [x] **Restricted AST Math Sandbox**: Mathematical expression parser using Python `ast` walking strictly an allowlist of nodes and scalar functions (zero `eval`/`exec`).
- [x] **Independent Graph Validator**: Kahn's topological sort for algebraic cycle detection, variable reference verification, and boundary validation.
- [x] **Server-Side Gemini Integration**: Natural-language scenario drafting and clarification loop using `@google/genai` on `gemini-4-hydrogen`, protected by an independent AST validation gate.
- [x] **Evidence-Grounded AI Analysis**: Gemini result explanations strictly constrained to computed numerical metrics and threshold events.
- [x] **Monochrome Editorial Visual System**: Centralized design token system (`tokens.css`) supporting Obsidian Black and Gallery White themes without ad-hoc color utility leaks.
- [x] **Interactive Workstation UI**:
  - Live landing page model sandbox
  - Overview dashboard with aggregated SQLite metrics
  - Cytoscape.js directed stock-and-flow dependency graph
  - Simulation workspace with Recharts time-series charts, step playback scrubber, and threshold alerts
  - Non-destructive Experiment Laboratory computing numerical deltas between baseline and variant scenarios
  - Scientific results & PDF/CSV/JSON export generation
- [x] **Security Hardening**: Explicit environment-based CORS and origin mutation guard (`ALLOWED_ORIGINS`), subprocess isolation (`shell: false`), process cancellation, and top-level React Error Boundary.

---

## 2. In-Progress (`v1.1.0` Milestone)

- [ ] **Adaptive Step-Size Solvers**: Implementation of Runge-Kutta-Fehlberg (RK45) or Dormand-Prince with automatic truncation error estimation.
- [ ] **Stochastic Simulation & Monte Carlo Ensembles**: Extending `SystemDynamicsEngine` to support calibrated stochastic noise terms (e.g. Wiener processes) and running multi-run Monte Carlo quantile bands.
- [ ] **Sensitivity Analysis Modules**: One-at-a-Time (OAT) parameter sensitivity sweeps and Sobol variance decomposition.
- [ ] **Enhanced Model Diffing**: Visual side-by-side equation and parameter comparison in the Model Editor.

---

## 3. Planned (`v1.2.0` & Beyond)

- [ ] **Mesa Agent-Based Simulation Adapter**: Implement concrete `SimulationEngineAdapter` subclasses for spatial agent-based models.
- [ ] **3D Spatial Visualization**: Optional WebGL / Three.js perspective view for spatial grid and agent simulations.
- [ ] **Database Migration Tooling**: Versioned migration runner for schema upgrades without database recreation.
- [ ] **Multi-User Collaboration & RBAC**: Optional authentication layer with role-based permissions (Viewer, Model Author, Admin).
- [ ] **Standard Container Profiles**: Official multi-stage `Dockerfile` and `docker-compose.yml` for isolated containerized deployment.
