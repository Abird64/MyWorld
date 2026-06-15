#!/usr/bin/env node

// Build the lite version (no WebView2 runtime bundled)

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const configPath = join(root, "src-tauri", "tauri.conf.json");

// Backup original config
const original = readFileSync(configPath, "utf-8");
const config = JSON.parse(original);

// Modify for lite
config.bundle.windows.webviewInstallMode = { type: "skip" };

writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

try {
  execSync("npx tauri build", { stdio: "inherit", cwd: root, shell: true });

  // Rename output
  const bundleDir = join(root, "src-tauri", "target", "release", "bundle", "nsis");
  const stdName = join(bundleDir, "提灯_2.5.0_x64-setup.exe");
  const liteName = join(bundleDir, "提灯_2.5.0_x64-lite-setup.exe");

  if (existsSync(stdName)) {
    copyFileSync(stdName, liteName);
    console.log(`\nLite installer: ${liteName}`);
  }
} finally {
  // Restore original config
  writeFileSync(configPath, original);
}
