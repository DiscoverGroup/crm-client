/**
 * start-tunnel.ts
 *
 * Reads NGROK_DOMAIN from .env and starts an ngrok tunnel pointing
 * local MinIO (port 9000) to that domain.
 *
 * Started automatically by `npm run dev:local` via concurrently.
 * If NGROK_DOMAIN is not set, this exits silently (tunnel is optional).
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Read .env ────────────────────────────────────────────────────────────────
let ngrokDomain = '';
try {
  const envContent = readFileSync(join(process.cwd(), '.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eqIdx  = trimmed.indexOf('=');
    const key    = trimmed.slice(0, eqIdx).trim();
    const value  = trimmed.slice(eqIdx + 1).trim();
    if (key === 'NGROK_DOMAIN') ngrokDomain = value;
  }
} catch {
  // No .env — skip
}

if (!ngrokDomain) {
  console.log('  [tunnel] NGROK_DOMAIN not set in .env — tunnel not started.');
  console.log('  [tunnel] Run scripts/setup-tunnel.ps1 to configure it.');
  process.exit(0);
}

console.log(`\n  [tunnel] Starting ngrok tunnel → https://${ngrokDomain}\n`);

const proc = spawn('ngrok', ['http', `--domain=${ngrokDomain}`, '9000'], {
  stdio: 'inherit',
  shell: true,
});

proc.on('error', (err) => {
  if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
    console.error('  [tunnel] ngrok not found. Run: scripts/setup-tunnel.ps1 to install it.');
  } else {
    console.error('  [tunnel] ngrok error:', err.message);
  }
  process.exit(0); // Non-fatal — don't bring down the whole dev server
});

proc.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`  [tunnel] ngrok exited with code ${code}`);
  }
});

// Graceful shutdown
process.on('SIGINT',  () => { proc.kill('SIGINT');  });
process.on('SIGTERM', () => { proc.kill('SIGTERM'); });
