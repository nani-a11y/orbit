## Description

Brief summary of the changes introduced in this pull request and the problem they solve.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds mathematical or simulation capabilities)
- [ ] Documentation update (improving guides, technical papers, or specifications)
- [ ] Performance / Numerical optimization (refactoring equation parsing, solvers, or UI rendering)
- [ ] Security hardening (AST validation, origin guards, or subprocess isolation)

## Verification & Testing

Please verify that all test suites pass before submitting:

- [ ] Python computational unit tests pass: `python3 -m unittest discover -s backend/tests -v`
- [ ] TypeScript type checks pass: `npm run lint`
- [ ] Production frontend build succeeds: `npm run build`
- [ ] Preserves zero `eval`/`exec` policy in Python AST equation sandbox
- [ ] Adheres to ORBIT's strict black-and-white editorial design tokens

## Additional Notes / Screenshots

Paste relevant test outputs, analytical validation comparisons, or screenshots if UI components were changed.
