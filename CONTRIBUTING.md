# Contributing

Thanks for your interest in contributing to `@zapfetchdev/mcp-server`.
This is a thin MCP wrapper around the ZapFetch API; most feature work
will involve either a new tool in `src/tools/`, a transport
improvement in `src/http-server.ts` / `src/index.ts`, or docs.

## Ground rules

- **Security before features.** Anything that touches the HTTP
  transport, auth flow, or error surface must keep the invariants
  documented in [SECURITY.md](SECURITY.md#hardened-by-default-posture).
- **STDIO path is load-bearing.** Most users run this via
  `npx -y @zapfetchdev/mcp-server` for Claude Desktop. Keep cold
  start fast and don't add HTTP-only deps to that import graph.
  The `scripts/assert-stdio-deps.mjs` check enforces this at build
  time.
- **Issues first for non-trivial changes.** For anything beyond a
  typo / obvious bug, open an issue before the PR so we can align
  on approach.

## Local setup

```bash
git clone https://github.com/zapfetch/mcp.git
cd mcp
npm install
npm run typecheck      # should be clean
npm test               # should be all green
npm run build          # -> dist/
```

You need **Node 20+** (Node 22 is the CI target).

## Running locally

### STDIO mode (Claude Desktop / Cursor / Windsurf)

```bash
ZAPFETCH_API_KEY=fc-YOUR-KEY node dist/index.js
```

The server emits one line on stderr (`zapfetch-mcp vX.Y.Z ready
(STDIO)`) and then reads JSON-RPC from stdin.

To point an MCP client at your dev build:

```json
{
  "mcpServers": {
    "zapfetch-dev": {
      "command": "node",
      "args": ["/absolute/path/to/zapfetch-mcp/dist/index.js"],
      "env": { "ZAPFETCH_API_KEY": "fc-..." }
    }
  }
}
```

### HTTP mode (self-host / Smithery hosted)

```bash
# ZAPFETCH_API_KEY must NOT be set — HTTP mode takes keys per-request
PORT=3000 node dist/http-server.js
```

Then:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer fc-YOUR-KEY" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Making changes

### Adding a new tool

1. Create `src/tools/<name>.ts` exporting: the handler, input schema,
   and a description.
2. Register it in `src/server.ts` alongside the existing ones.
3. Add a case in `src/tools.test.ts` asserting path + body + response
   shape.
4. Update the tools list in `README.md` and `CHANGELOG.md`.

### Changing the transport layer

1. Check the invariants in `SECURITY.md`. Changes that cross them
   need CVE-level justification.
2. Tests to run before even opening a draft PR:
   ```bash
   npm run typecheck
   npm test
   npm run build
   npm run assert:stdio-deps
   ```
3. For HTTP-mode changes, write a failing test in
   `src/http-server.test.ts` or `src/http-server.concurrent.test.ts`
   FIRST. Multi-tenant auth regressions are expensive; the concurrent
   test is the backstop.

## Commit / PR conventions

- **One purpose per PR.** Don't bundle a feature with a refactor.
- **Conventional-ish commit messages.** Type prefixes we use:
  `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`. Scope
  is the primary touched area, e.g. `feat(http): ...`,
  `fix(server): ...`, `test(tools): ...`.
- **PR description** should include a `## Summary` (what + why),
  `## Verification` (commands run), and, if relevant, `## Follow-up`
  (explicit out-of-scope items).
- **Breaking changes** — call out in the PR title AND the
  `CHANGELOG.md` entry under a `### Changed` or `### Removed` line.

## Release flow (maintainers only)

1. Merge all PRs targeted for the release.
2. Open a tiny PR: bump `package.json.version` +
   `registry/server.json.version` + the `packages[].version` entries.
3. Update `CHANGELOG.md`: move `[Unreleased]` content under a new
   `[X.Y.Z]` heading with the release date.
4. Merge that PR, then tag: `git tag vX.Y.Z && git push --tags`.
5. The `publish-npm.yml` and `publish-docker.yml` workflows will run
   automatically. Verify:
   - `npm view @zapfetchdev/mcp-server@X.Y.Z` returns metadata
   - `docker pull zapfetchdev/mcp:X.Y.Z` succeeds on a clean host
6. Submit / update the Official MCP Registry entry (see
   `registry/README.md`).
7. Post-release: `npx @smithery/cli publish` if the `smithery.yaml`
   config changed.

## Code style

- TypeScript strict mode is on. Don't add `// @ts-ignore` or
  `any` without a comment explaining why.
- Prefer `node:` prefixed imports for built-ins (e.g. `node:http`,
  `node:crypto`) — makes intent explicit.
- Don't use `console.log` anywhere in STDIO-reachable code — stdout
  is the JSON-RPC channel. Use `console.error` for diagnostics.
- Comments: default to none. Only add one when the WHY is
  non-obvious.
