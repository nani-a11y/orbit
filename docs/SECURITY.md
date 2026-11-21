# ORBIT Security Architecture & Policy

Security in ORBIT is grounded in a defensive posture: **all equations and AI outputs are untrusted by default**, and computation is decoupled from code execution.

---

## 1. Core Security Guarantees

### Zero Arbitrary Code Execution
ORBIT never executes `eval()`, `exec()`, or `compile()` on user input or AI-generated strings. All mathematical expressions in stocks, flows, and auxiliaries are parsed into Python Abstract Syntax Trees (`ast.parse(expr, mode="eval")`) and evaluated by a restricted recursive-descent visitor (`backend/app/validation/math_parser.py`):

- **Allowed AST Nodes**: `Expression`, `BinOp`, `UnaryOp`, `Call`, `Name`, `Constant`, `IfExp`, `Compare`.
- **Prohibited AST Nodes**: `Attribute`, `Import`, `ImportFrom`, `ListComp`, `SetComp`, `DictComp`, `GeneratorExp`, `Lambda`, `Subscript`, `Yield`, `Await`.
- **Allowed Scalar Functions**: `min`, `max`, `abs`, `sqrt`, `exp`, `log`, `ln`, `sin`, `cos`, `pow`, `round`, `floor`, `ceil`, `clamp`, `safe_div`, `step`.
- **Exponent Safety**: Powers are bounded to $|x| \le 100.0$ to prevent exponential denial-of-service memory exhaustion.

### Server-Side Only AI Credentials
`GEMINI_API_KEY` is loaded strictly inside server-side Node.js environment variables. Client bundles built by Vite never import `@google/genai` or have access to runtime environment variables containing API tokens.

### Subprocess Isolation & Non-Shell IPC
The Node.js gateway spawns the Python 3.11 engine using `child_process.spawn("python3", [CLI_PATH], { shell: false })`. 
- No shell interpretation or shell interpolation takes place.
- All IPC occurs over strict JSON piped via `stdin` and read from `stdout`.
- Active subprocesses are tracked and can be cancelled on demand via `SIGTERM`.
- Integrations run with a hard 15-second wall-clock timeout.

### Strict Environment-Based CORS & Cross-Origin Guard
In `server.ts`, all state-changing mutation requests (`POST`, `PUT`, `DELETE`, `PATCH`) validate the client `Origin` or `Referer` against an explicit allowlist (`ALLOWED_ORIGINS`). Cross-origin requests from unapproved domains are rejected with `403 Forbidden`, and wildcard (`*`) origins are prohibited.

### Parameterized Database Access
All SQLite transactions utilize `better-sqlite3` prepared statements with positional parameters (`?`). Raw SQL concatenation is forbidden across the codebase.

---

## 2. Threat Model & Boundaries

| Asset / Boundary | Threat | Mitigation |
| :--- | :--- | :--- |
| **Equation Input** | Remote Code Execution via equation injection | Restricted AST node allowlist; zero `eval()`. |
| **AI Scenario Drafting** | Hallucinated or malicious model equations | Untrusted-by-default Python AST validation gate before model persistence. |
| **API Endpoints** | Cross-Site Request Forgery (CSRF) / Cross-Origin Hijacking | Explicit `ALLOWED_ORIGINS` validation on all state-changing endpoints. |
| **Numerical Integration** | CPU DoS via infinite loops or runaway stiffness | Max steps limit (5,000), timeout (15s), magnitude overflow ceiling ($10^{15}$). |
| **Export Endpoints** | Memory exhaustion via large file downloads | Hard 5 MB export ceiling enforced before serialization. |

---

## 3. Reporting a Vulnerability

If you discover a security vulnerability in ORBIT, please report it privately:

- **Email**: Send details to `security@orbit-sim.org` (or open a private security advisory on GitHub).
- **Include**: Description of the vulnerability, step-by-step reproduction steps, and proof-of-concept model JSON.
- **Response**: We commit to acknowledging receipt within 48 hours and providing a coordinated disclosure timeline.
