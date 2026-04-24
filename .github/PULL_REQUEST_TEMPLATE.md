## Summary

<!-- What changed and why, in 1–3 sentences. -->

## Type of change

- [ ] Bug fix
- [ ] New feature (new tool / new option / transport capability)
- [ ] Refactor (no behavior change)
- [ ] Docs / chore
- [ ] CI / release infra
- [ ] **Breaking change** — requires a major/minor bump per SemVer

## Test plan

<!-- Commands you ran locally and what they produced. -->

- [ ] `npm run typecheck` clean
- [ ] `npm test` green
- [ ] `npm run build` clean
- [ ] `npm run assert:stdio-deps` clean (required for any `src/*` change)
- [ ] For HTTP transport changes: `src/http-server.concurrent.test.ts` still passes

## Security invariants

If this PR touches `src/http-server.ts`, `src/bearer-middleware.ts`,
`src/config.ts`, `src/observability.ts`, or `src/error-sanitize.ts`,
confirm:

- [ ] `GET /health` still unauthenticated
- [ ] HTTP mode still rejects `ZAPFETCH_API_KEY` env at boot
- [ ] `req.auth` is the only place Bearer token is stashed (never `req.app.locals` / `res.locals`)
- [ ] stderr logger redaction still drops Authorization / body / headers / query
- [ ] Upstream error bodies are still sanitized for HTTP mode

If any box is unticked, explain why in the Summary above.

## CHANGELOG

- [ ] Added an entry under `[Unreleased]` in `CHANGELOG.md`
- [ ] Not user-facing, skipped

## Follow-up

<!-- Anything intentionally out of scope that should be a separate PR. -->
