// Runtime version lookup from package.json.
//
// Using fs + import.meta.url (not a JSON import assertion) because
// tsconfig has `rootDir: ./src` — a TS JSON import of `../package.json`
// would be out-of-root and rejected at build.
//
// Resolution works for both dev and prod:
//   - dev (tsx src/index.ts):  here = src/  → ../package.json = repo root
//   - prod (node dist/index.js): here = dist/ → ../package.json = package root
//     (the published tarball's dist/ sits alongside its package.json)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(here, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };

export const VERSION: string = pkg.version;
