# Contributing to ORBIT

Thank you for your interest in contributing to **ORBIT (Open-ended Reasoning & Behavior Intelligence for Simulation and Testing)**. We welcome contributions from systems modelers, mathematicians, software engineers, and domain researchers.

---

## Core Engineering Principles

Before contributing code, please review ORBIT's foundational invariants:

1. **Strict Separation Between AI and Execution**: Gemini translates natural-language descriptions into structured model drafts and explains computed results. Numerical integration is performed **exclusively** by the deterministic Python 3.11 engine.
2. **Zero Arbitrary Code Execution**: ORBIT never executes `eval()`, `exec()`, or dynamic imports on user or AI equations. All equations must parse through the restricted Python AST allowlist in [`backend/app/validation/math_parser.py`](backend/app/validation/math_parser.py).
3. **Monochrome Editorial Visual Identity**: All UI styling must adhere strictly to centralized CSS design tokens in [`src/styles/tokens.css`](src/styles/tokens.css). Do not introduce ad-hoc Tailwind color classes (e.g. `bg-blue-500`, `text-indigo-600`).
4. **Offline-First Functionality**: Core simulation, model editing, parameter experiments, and bundled scenarios must run fully locally without an internet connection or external API key.

---

## Local Development Setup

### Prerequisites

- **Node.js**: v20.0.0 or higher (v22 LTS recommended)
- **Python**: v3.11 or higher
- **npm**: v10.0.0 or higher

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/nani-a11y/orbit.git
cd orbit

# 2. Install JavaScript dependencies
npm install

# 3. Configure local environment
cp .env.example .env
# Optionally configure GEMINI_API_KEY in .env for natural-language modeling

# 4. Start local development server
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Testing & Verification

Every pull request must pass the automated test suites and build pipelines:

```bash
# Run Python computational unit tests
npm run test:engine
# or directly:
python3 -m unittest discover -s backend/tests -v

# Run TypeScript type check
npm run lint

# Run production frontend build
npm run build
```

### Adding New Mathematical Functions

If adding a new scalar function to ORBIT's equation language:
1. Register it in `ALLOWED_FUNCTIONS` in [`backend/app/validation/math_parser.py`](backend/app/validation/math_parser.py).
2. Ensure it handles domain errors gracefully (e.g., division by zero, non-finite values).
3. Add corresponding unit tests in [`backend/tests/test_engine.py`](backend/tests/test_engine.py) verifying both valid execution and rejection of malicious inputs.

---

## Pull Request Guidelines

1. **Branch Naming**: Use descriptive prefixes:
   - `feat/` for new modeling capabilities or UI workflows
   - `fix/` for bug fixes and numerical stability corrections
   - `docs/` for documentation updates
2. **Commit Messages**: Follow standard Conventional Commits:
   - `feat: add adaptive step-size Runge-Kutta solver`
   - `fix: resolve cycle detection edge case in auxiliary chains`
3. **Keep PRs Focused**: Avoid bundling unrelated refactorings or dependencies into a single PR.
4. **Documentation**: Update corresponding architectural, API, or schema documentation if your change affects public contracts.

---

## License

By contributing to ORBIT, you agree that your contributions will be licensed under the project's [Apache License 2.0](LICENSE).
