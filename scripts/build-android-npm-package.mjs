#!/usr/bin/env node
import { execSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const androidPkgDir = join(root, "packages", "caveman-android");
const distDir = join(root, "dist");
const binariesDir = join(distDir, "binaries");
const cliDistDir = join(root, "packages", "cli", "dist");

console.log("==> 1. Ensuring Android aarch64 binaries are built...");
const binaries = [
  "caveman-proxy",
  "caveman-engine",
  "caveman-mcp",
  "cavemem",
  "caveman-browse",
  "caveman-shrink",
];

for (const bin of binaries) {
  const binPath = join(binariesDir, `${bin}_android_arm64`);
  if (!existsSync(binPath)) {
    console.log(`Building missing binary: ${bin}...`);
    execSync(`node scripts/build-release-binaries.mjs --target android/arm64`, {
      cwd: root,
      stdio: "inherit",
    });
    break;
  }
}

console.log("==> 2. Ensuring CLI is built...");
execSync("npm run build", {
  cwd: join(root, "packages", "cli"),
  stdio: "inherit",
});

console.log("==> 3. Assembling packages/caveman-android...");
mkdirSync(join(androidPkgDir, "bin"), { recursive: true });
mkdirSync(join(androidPkgDir, "dist"), { recursive: true });
mkdirSync(join(androidPkgDir, "scripts"), { recursive: true });

// Copy CLI dist files
cpSync(cliDistDir, join(androidPkgDir, "dist"), { recursive: true });

// Copy Go binaries to bin/
for (const bin of binaries) {
  const src = join(binariesDir, `${bin}_android_arm64`);
  const dst = join(androidPkgDir, "bin", bin);
  copyFileSync(src, dst);
  chmodSync(dst, 0o755);
}

// Write bin/caveman.mjs launcher
writeFileSync(
  join(androidPkgDir, "bin", "caveman.mjs"),
  `#!/usr/bin/env node
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
  process.env.PATH = \`\${here}:\${pathEnv}\`;
}

await import("../dist/index.js");
`,
  { mode: 0o755 }
);

// Write postinstall script
writeFileSync(
  join(androidPkgDir, "scripts", "postinstall.mjs"),
  `import { chmodSync, existsSync, mkdirSync, copyFileSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const binSrc = join(pkgRoot, "bin");

// Resolve caveman home
let caveHome = process.env.CAVEMAN_HOME;
if (!caveHome) {
  const h = homedir();
  if (!h || h === "/") {
    caveHome = join(process.env.TMPDIR || "/data/local/tmp", ".caveman");
  } else {
    caveHome = join(h, ".caveman");
  }
}

const targetBinDir = join(caveHome, "bin");
try {
  mkdirSync(targetBinDir, { recursive: true, mode: 0o755 });
} catch {}

const bins = ["caveman-proxy", "caveman-engine", "caveman-mcp", "cavemem", "caveman-browse", "caveman-shrink"];
for (const b of bins) {
  const src = join(binSrc, b);
  const dst = join(targetBinDir, b);
  if (existsSync(src)) {
    try {
      chmodSync(src, 0o755);
      try {
        symlinkSync(src, dst);
      } catch {
        copyFileSync(src, dst);
      }
      chmodSync(dst, 0o755);
    } catch {}
  }
}
`,
  { mode: 0o755 }
);

// Write package.json
const pkgJson = {
  name: "caveman-android",
  version: "2.1.0",
  description: "Caveman context compression layer ported for Android (aarch64)",
  license: "Apache-2.0",
  type: "module",
  bin: {
    caveman: "./dist/index.js",
    cave: "./dist/index.js",
    "caveman-proxy": "./bin/caveman-proxy",
    "caveman-engine": "./bin/caveman-engine",
    "caveman-mcp": "./bin/caveman-mcp",
    cavemem: "./bin/cavemem",
    "caveman-browse": "./bin/caveman-browse",
    "caveman-shrink": "./bin/caveman-shrink",
  },
  files: ["bin", "dist", "scripts", "README.md"],
  scripts: {
    postinstall: "node scripts/postinstall.mjs",
  },
  engines: {
    node: ">=18",
  },
};

writeFileSync(
  join(androidPkgDir, "package.json"),
  JSON.stringify(pkgJson, null, 2) + "\n"
);

// Write README.md
writeFileSync(
  join(androidPkgDir, "README.md"),
  `# Caveman Android (aarch64)

Caveman context compression layer for Android (Termux / aarch64).

## Install via npm

\`\`\`bash
# Direct install from tarball
npm install -g caveman-android-2.1.0.tgz

# Or run directly with npx
npx caveman-android-2.1.0.tgz status
npx caveman-android-2.1.0.tgz setup
\`\`\`

## Commands

- \`caveman status\` — show layer status
- \`caveman setup\` — verify companion Go binaries
- \`caveman <agent>\` — wrap coding agent
`
);

console.log("==> 4. Packing npm tarball...");
const tarballOutput = execSync("npm pack --pack-destination " + distDir, {
  cwd: androidPkgDir,
  encoding: "utf8",
}).trim();

console.log(`\nSuccess! Created npm package tarball at: ${join(distDir, tarballOutput)}`);
