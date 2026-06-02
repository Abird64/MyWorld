// 清理 Cargo 文件锁 —— 解决 "Blocking waiting for file lock" 问题
// 在 tauri android dev 前自动运行

import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const targetDir = join(import.meta.dirname, '..', 'src-tauri', 'target');

// 1. 删除所有 .cargo-lock 文件
const locksToDelete = [
  join(targetDir, 'debug', '.cargo-lock'),
  join(targetDir, 'release', '.cargo-lock'),
  join(targetDir, 'x86_64-linux-android', 'debug', '.cargo-lock'),
  join(targetDir, 'aarch64-linux-android', 'debug', '.cargo-lock'),
];

for (const lock of locksToDelete) {
  if (existsSync(lock)) {
    rmSync(lock);
  }
}

// 2. 杀掉残留的 tauri node 子进程（排除当前进程）
try {
  const wmic = execSync(
    'wmic process where "name=\'node.exe\'" get ProcessId,CommandLine 2>nul',
    { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'ignore'] }
  );

  const pids = wmic
    .split('\n')
    .filter(line => line.includes('tauri') && !line.includes('clean-cargo-lock'))
    .map(line => { const m = line.match(/(\d+)\s*$/); return m ? m[1] : null; })
    .filter(Boolean);

  if (pids.length > 0) {
    try {
      execSync(`taskkill /F ${pids.map(p => `/PID ${p}`).join(' ')}`, {
        timeout: 5000,
        stdio: ['pipe', 'ignore', 'ignore'],
      });
    } catch { /* taskkill 返回非零无所谓 */ }
  }
} catch { /* wmic 失败无所谓 */ }

console.log('[clean] done.');
