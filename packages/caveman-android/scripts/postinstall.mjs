import { chmodSync, existsSync, mkdirSync, copyFileSync, symlinkSync } from "node:fs";
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
