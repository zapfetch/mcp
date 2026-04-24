#!/bin/sh
# Dockerfile entrypoint dispatcher.
#
# Plan §2.5: env-based transport switch lives ONLY at the shell layer.
# Node binaries (dist/index.js, dist/http-server.js) never consult
# ZAPFETCH_TRANSPORT themselves — preventing the "npx user accidentally
# starts HTTP server on localhost" footgun.
#
# Usage:
#   docker run ... image                           # defaults to stdio
#   docker run -e ZAPFETCH_TRANSPORT=http ... image # runs HTTP server
#
# Exit codes:
#   0 — normal (passed to dispatched command)
#   2 — invalid ZAPFETCH_TRANSPORT value

set -e

case "${ZAPFETCH_TRANSPORT:-stdio}" in
  stdio)
    exec node dist/index.js "$@"
    ;;
  http)
    exec node dist/http-server.js "$@"
    ;;
  *)
    echo "FATAL: unknown ZAPFETCH_TRANSPORT: '${ZAPFETCH_TRANSPORT}'" >&2
    echo "  allowed values: stdio, http" >&2
    exit 2
    ;;
esac
