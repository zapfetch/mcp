# Changelog

All notable changes to `@zapfetchdev/mcp-server` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
version numbers follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] — 2026-04-27

### Added
- **HTTP transport** — new `zapfetch-mcp-http` binary + `/mcp` + `/health`
  endpoints. Bearer-token per-request auth. Stateless,
  multi-tenant-safe by architecture (#5).
- **Docker image** — `docker.io/zapfetchdev/mcp:<version>` with shell-
  level transport dispatch; STDIO default (#5, #6).
- **Structured access logs** (stderr) with strict field allowlist and
  bearer-token redaction (#5).
- **Upstream error sanitization** for HTTP mode — only allowlisted
  error codes (`rate_limit`, `invalid_key`, `quota_exceeded`,
  `upstream_unavailable`) surface; arbitrary backend strings never
  transit (#5).
- **STDIO dep-leak CI assertion** (`scripts/assert-stdio-deps.mjs`):
  fails the publish workflow if `dist/index.js` can reach `express`
  or any HTTP-only module (#5).
- **Distribution manifests**: `smithery.yaml` (stdio template) +
  `registry/server.json` (Official MCP Registry schema 2025-12-11,
  reverse-DNS name `io.github.zapfetch/mcp-server`) (#6).
- **Publish workflows** — tag-triggered `publish-npm.yml` +
  `publish-docker.yml` (multi-arch amd64 + arm64); dormant until
  repo secrets are configured and a `v*` tag is pushed (#6).
- **Test coverage** for 7 tool handlers (scrape / search / crawl /
  crawl_status / map / extract / extract_status): 17 new cases
  asserting correct path + body + response shape (#7).

### Changed
- **`ORIGIN_TAG` now dynamic** — reads version from `package.json` at
  runtime; no more manual bump drift for billing attribution (#5).
- **npm package renamed** from `@zapfetch/mcp-server` to
  `@zapfetchdev/mcp-server` (the `@zapfetch` npm scope is
  unavailable; the SDK already ships under `@zapfetchdev/sdk`).
- **`loadConfig()` → `loadStdioConfig()`** (backward-compat alias
  preserved). HTTP mode uses `buildHttpConfig(apiKey)` instead.

### Security
- **HTTP mode refuses to start** if `ZAPFETCH_API_KEY` is present in
  the environment. Prevents misconfigured containers from silently
  serving every request from the operator's key (exit code 2). (#5)
- **`GET /health` bypasses bearer middleware** by design — container
  health probes work without credentials. (#5)

## [0.1.0] — 2026-04-23

Initial public release of the ZapFetch MCP server.

### Added
- 7 tools: `zapfetch_scrape`, `zapfetch_search`, `zapfetch_crawl` +
  `zapfetch_crawl_status`, `zapfetch_map`, `zapfetch_extract` +
  `zapfetch_extract_status`.
- STDIO transport for Claude Desktop / Cursor / Windsurf.
- Origin tag (`mcp/zapfetch@<version>`) on outbound POSTs so the
  ZapFetch backend can attribute billing to MCP-sourced traffic.
- Dockerfile (STDIO-only at this stage).
- CI workflow (typecheck + test + build on push / PR).

[Unreleased]: https://github.com/zapfetch/mcp/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/zapfetch/mcp/releases/tag/v0.2.0
[0.1.0]: https://github.com/zapfetch/mcp/releases/tag/v0.1.0
