#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, chmodSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));

// Ensure bundled binaries have executable permissions
const bins = ["caveman-proxy", "caveman-engine", "caveman-mcp", "cavemem", "caveman-browse", "caveman-shrink"];
for (const b of bins) {
  const p = join(here, b);
  if (existsSync(p)) {
    try { chmodSync(p, 0o755); } catch {}
  }
}

// Add bundled bin dir to PATH for subprocesses if not already present
const pathEnv = process.env.PATH || "";
if (!pathEnv.includes(here)) {
  process.env.PATH = `${here}:${pathEnv}`;
}

await import("../dist/index.js");
