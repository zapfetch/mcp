#!/usr/bin/env node
// STDIO entry dependency assertion (Critic I9 — HIGH severity).
//
// Scans dist/index.js (the STDIO entry) and its transitive imports,
// and fails if any HTTP-transport-only module (express, http-server,
// bearer-middleware, observability) is reachable.
//
// The guarantee we protect: users who `npx -y @zapfetchdev/mcp-server`
// or install for STDIO-only use (Claude Desktop / Cursor / Windsurf)
// should never pay for express's transitive dep tree (40+ packages,
// ~1.5MB of cold-start).
//
// How: recursively walk `import` / `from` specifiers starting at
// dist/index.js, following only local relative imports (no node_modules).
// If any local file contains a bare import of "express" or the HTTP-only
// modules, fail. node_modules traversal is intentionally skipped because
// the test is about our source graph, not transitive runtime behavior —
// that's a separate audit.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(here, "..", "dist");
const ENTRY = resolve(DIST, "index.js");

// Modules that must not be reachable from STDIO entry.
const FORBIDDEN_BARE_IMPORTS = new Set([
  "express",
]);
const FORBIDDEN_LOCAL_FILES = new Set([
  "http-server.js",
  "http-server",
  "bearer-middleware.js",
  "bearer-middleware",
  "observability.js",
  "observability",
]);

// Match ESM import specifiers: `import ... from "X"` and `import "X"`.
// Also matches re-exports: `export ... from "X"`.
const IMPORT_RE = /(?:import|export)(?:\s[\s\S]*?)?\sfrom\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g;

function extractSpecifiers(source) {
  const specs = [];
  let m;
  while ((m = IMPORT_RE.exec(source)) !== null) {
    specs.push(m[1] ?? m[2]);
  }
  return specs;
}

function walk(file, visited, trail) {
  if (visited.has(file)) return;
  visited.add(file);

  let source;
  try {
    source = readFileSync(file, "utf-8");
  } catch {
    return; // file missing — let tsc errors surface elsewhere
  }

  const specs = extractSpecifiers(source);
  for (const spec of specs) {
    // Bare imports (not relative): check forbidden list.
    if (!spec.startsWith(".") && !spec.startsWith("/")) {
      const top = spec.split("/")[0];
      if (FORBIDDEN_BARE_IMPORTS.has(top)) {
        throw new Error(
          `STDIO dep-leak: ${file} imports forbidden bare module "${spec}".\n` +
            `  Trail: ${[...trail, file].join(" -> ")}\n` +
            `  Fix: gate the import behind the HTTP entry (src/http-server.ts).`,
        );
      }
      continue;
    }

    // Local relative import: check against forbidden file list, then recurse.
    const localFile = spec.endsWith(".js") ? spec : spec + ".js";
    const base = localFile.split("/").pop();
    if (base && FORBIDDEN_LOCAL_FILES.has(base)) {
      throw new Error(
        `STDIO dep-leak: ${file} imports forbidden HTTP-only module "${spec}".\n` +
          `  Trail: ${[...trail, file].join(" -> ")}\n` +
          `  Fix: http-only modules must not be reachable from dist/index.js.`,
      );
    }
    const resolved = resolve(dirname(file), localFile);
    walk(resolved, visited, [...trail, file]);
  }
}

try {
  walk(ENTRY, new Set(), []);
  console.error("OK: STDIO entry dist/index.js has no http-only imports.");
} catch (err) {
  console.error(`FAIL:\n  ${err.message}`);
  process.exit(1);
}
