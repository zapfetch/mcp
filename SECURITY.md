# Security policy

Thank you for looking at the security of the ZapFetch MCP server.
We treat vulnerability reports seriously and aim to respond within
**2 business days**.

## Supported versions

Only the latest minor release line receives security fixes. Older
lines are considered end-of-life at each new minor release.

| Version  | Supported          |
|----------|--------------------|
| 0.2.x    | :white_check_mark: |
| 0.1.x    | :x: (EOL at 0.2.0) |

## Reporting a vulnerability

**Do not open a public GitHub issue** for anything that could be
exploited. Instead:

1. Email **security@zapfetch.com** with the subject line
   "mcp-server: <short summary>".
2. Include:
   - A clear description of the issue
   - Steps to reproduce (or a proof-of-concept)
   - Affected version(s), Node/OS if relevant
   - Any known workaround
3. If you prefer encrypted communication, request our PGP key in
   your first message — we'll reply with it before you send
   sensitive details.

We'll acknowledge your report within 2 business days, keep you
updated on investigation, and credit you in the fix release notes if
you'd like.

## Scope

**In scope**: vulnerabilities in this repository's published
artifacts — the npm package `@zapfetchdev/mcp-server` and the Docker
image `zapfetchdev/mcp` — including:

- Authentication bypass or privilege escalation in HTTP transport
- Cross-tenant data leakage (one request's data surfacing to
  another, or tool handler seeing wrong `authInfo.token`)
- Injection into outbound requests (command, header, path)
- Secret leakage through logs, error responses, or stdout
- Supply-chain integrity (malicious dependency, modified tag, etc.)

**Out of scope**: upstream ZapFetch API issues (report those through
`security@zapfetch.com` as usual — they'll be triaged to the
backend team); MCP protocol-level issues (report upstream at
<https://github.com/modelcontextprotocol/specification>).

## Hardened-by-default posture

The HTTP transport is designed around a few invariants that we will
not weaken without a CVE-level justification:

- **Stateless per-request** — each `POST /mcp` builds a fresh
  `McpServer` + `StreamableHTTPServerTransport`. No session map,
  no shared client instance.
- **No env-based key in HTTP mode** — the server exits with code 2
  at boot if `ZAPFETCH_API_KEY` is set, so a misconfigured
  container cannot silently serve all traffic from the operator's
  key.
- **Node binaries ignore `ZAPFETCH_TRANSPORT`** — transport is
  chosen by which bin the user invokes (`zapfetch-mcp` vs
  `zapfetch-mcp-http`), never by env. This prevents an accidentally-
  set shell env from flipping a local `npx` install into a
  listening HTTP server.
- **Structured stderr logging** emits only an allowlist
  (ts / method / path / status / ms / origin_ip); Authorization,
  body, query, and full headers are never logged.
- **Upstream error bodies are sanitized** before transiting to HTTP
  clients — only allowlisted machine codes surface, not arbitrary
  backend text.

If you find a way around any of these, please report it via the
process above.
