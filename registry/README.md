# Registry manifest

`server.json` is the source-of-truth manifest for submission to the
[Official MCP Registry](https://registry.modelcontextprotocol.io/).
It is **not** auto-submitted; publishing to the registry is a one-time
PR against [`modelcontextprotocol/registry`](https://github.com/modelcontextprotocol/registry):

```bash
# 1. Fork modelcontextprotocol/registry on GitHub.
# 2. Clone your fork; copy our manifest into place.
cp registry/server.json path/to/registry-fork/servers/io.github.zapfetch/mcp-server/server.json
# 3. Verify it schema-validates.
npx ajv-cli validate \
  -s https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json \
  -d servers/io.github.zapfetch/mcp-server/server.json
# 4. Commit, push, open PR.
```

## Updating on version bumps

When we bump the package version (e.g. 0.2.0 → 0.2.1), update two lines
in `server.json`:

1. top-level `"version"`
2. the first `packages[].version` (the npm package version)

The OCI `packages[].identifier` tag also needs to bump
(`docker.io/zapfetchdev/mcp:0.2.1`). Then re-submit the manifest via
the same registry PR flow.

## Schema

The manifest targets schema
`https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`.
Ensure:

- `name` is reverse-DNS (`io.github.<org>/<repo>`), not bare.
- `packages[].registryBaseUrl` is `https://registry.npmjs.org` for npm
  (no private mirrors permitted by the registry).
- `environmentVariables[].isSecret: true` on the API key entry.
