# ORBIT Security Design

1. **Zero Arbitrary Code Execution**: ORBIT never calls `eval()`, `exec()`, or `compile()` on AI-generated or user-supplied text. Equations are parsed using `ast.parse(expr, mode="eval")` and evaluated via an explicit node and function allowlist (`backend/app/validation/math_parser.py`).
2. **Backend-Only AI Credentials**: `GEMINI_API_KEY` is read exclusively in server-side `process.env`. Browser bundles never import `@google/genai` or expose API credentials.
3. **Subprocess Isolation**: Node invokes Python directly via `spawn("python3", [CLI_PATH], { shell: false })` with structured JSON stdin/stdout, strict wall-clock timeouts (15s), and process cancellation support.
4. **Resource & Stability Limits**: Enforces maximum variable count (80), maximum steps (5,000), expression length/AST complexity limits, magnitude overflow guards (`1e15`), API request rate limits, and a 5 MB export ceiling.
5. **Parameterized Persistence**: All SQLite queries use prepared statements with positional `?` parameters (`server/db.ts`).
6. **Untrusted AI Output Gate**: Every Gemini-generated model draft is validated independently by the Python engine and requires explicit user review and approval before execution.
7. **Strict Origin & CORS Validation**: All state-changing mutations (`POST`, `PUT`, `DELETE`, `PATCH`) validate the client `Origin` and `Referer` headers against an explicit, environment-configured allowlist (`ALLOWED_ORIGINS`). Cross-origin requests from unapproved domains are rejected with `403 Forbidden`, and wildcard (`*`) origins are prohibited.
