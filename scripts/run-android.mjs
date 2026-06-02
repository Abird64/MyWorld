// 清理锁 + 启动 tauri android dev（单脚本，避免 &&/& 链接问题）

import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { execSync, spawn } from 'child_process';

const targetDir = join(import.meta.dirname, '..', 'src-tauri', 'target');

// 1. 清理 .cargo-lock 文件
for (const dir of ['debug', 'release', 'x86_64-linux-android/debug', 'aarch64-linux-android/debug']) {
  const lock = join(targetDir, dir, '.cargo-lock');
  if (existsSync(lock)) rmSync(lock);
}

// 2. 杀残留 tauri 进程
try {
  const wmic = execSync(
    'wmic process where "name=\'node.exe\'" get ProcessId,CommandLine 2>nul',
    { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'ignore'] }
  );
  const pids = wmic.split('\n')
    .filter(l => l.includes('tauri') && !l.includes('run-android'))
    .map(l => { const m = l.match(/(\d+)\s*$/); return m ? m[1] : null; })
    .filter(Boolean);
  if (pids.length > 0) {
    try { execSync(`taskkill /F ${pids.map(p => `/PID ${p}`).join(' ')}`, { stdio: 'ignore' }); } catch {}
  }
} catch {}

// 3. 启动 tauri android dev
const child = spawn('npx', ['tauri', 'android', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: join(import.meta.dirname, '..'),
});

child.on('exit', (code) => process.exit(code ?? 0));
