#!/usr/bin/env node

// Build both standard and lite NSIS installers.
// Standard: WebView2 offlineInstaller included
// Lite:     WebView2 skipped (for users who already have WebView2)

import { execSync } from "child_process";
import { readFileSync, writeFileSync, copyFileSync, renameSync, mkdirSync, existsSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const configPath = join(root, "src-tauri", "tauri.conf.json");

const bundleDir = join(root, "src-tauri", "target", "release", "bundle", "nsis");
const outDir = join(root, "dist-installer");

mkdirSync(outDir, { recursive: true });

function findInstaller() {
  const candidates = [
    "提灯_2.5.0_x64-setup.exe",
    "Lantern_2.5.0_x64-setup.exe",
    "lantern_2.5.0_x64-setup.exe",
    "提灯_2.5.0_x64_en-US.msi",
  ];
  for (const name of candidates) {
    const full = join(bundleDir, name);
    if (existsSync(full)) return full;
  }
  // Try glob
  try {
    const files = execSync(`dir /b "${bundleDir}\\*.exe" "${bundleDir}\\*.msi" 2>nul`, {
      cwd: bundleDir,
      shell: true,
      encoding: "utf-8",
    }).trim();
    if (files) return join(bundleDir, files.split("\n")[0].trim());
  } catch {}
  return null;
}

function saveBuild(label) {
  const found = findInstaller();
  if (!found) {
    console.error(`\nCould not find built installer in ${bundleDir}`);
    return false;
  }
  const ext = extname(found);

  // Rename in NSIS dir so next build doesn't overwrite it
  const nsisRenamed = join(bundleDir, `提灯_2.5.0_x64-${label}-setup${ext}`);
  renameSync(found, nsisRenamed);
  console.log(`  NSIS: ${nsisRenamed}`);

  // Copy to dist-installer
  const dest = join(outDir, `Lantern_2.5.0_${label}${ext}`);
  copyFileSync(nsisRenamed, dest);
  console.log(`  -> ${dest}`);
  return true;
}

const target = process.argv[2];

// ── Standard build ──
if (target !== "lite") {
  console.log(`\n=== Building standard (with WebView2) ===\n`);
  execSync("npx tauri build", { stdio: "inherit", cwd: root, shell: true });
  saveBuild("standard");
}

// ── Lite build ──
if (target !== "standard") {
  console.log(`\n=== Building lite (without WebView2) ===\n`);

  // Temporarily modify config to skip WebView2
  const original = readFileSync(configPath, "utf-8");
  const config = JSON.parse(original);
  config.bundle.windows.webviewInstallMode = { type: "skip" };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

  try {
    execSync("npx tauri build", { stdio: "inherit", cwd: root, shell: true });
    saveBuild("lite");
  } finally {
    // Restore original config
    writeFileSync(configPath, original);
  }
}

if (!target) {
  console.log("\n=== Done ===");
  console.log(`Installers: ${outDir}`);
  console.log(`NSIS dir:   ${bundleDir}`);
}
