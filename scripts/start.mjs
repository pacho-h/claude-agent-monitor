#!/usr/bin/env node

// Process management for Agent Monitor server
// Usage: node start.mjs [start|stop|status|open]

import { existsSync, readFileSync, unlinkSync } from 'fs';
import { spawn, execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { platform } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || join(__dirname, '..');
const PID_FILE = '/tmp/agent-monitor.pid';

// Prefer bundled server, fall back to source
const SERVER_BUNDLED = join(PLUGIN_ROOT, 'server', 'server.bundled.cjs');
const SERVER_SOURCE = join(PLUGIN_ROOT, 'server', 'server.js');

function readPidFile() {
  try {
    return JSON.parse(readFileSync(PID_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getServerFile() {
  if (existsSync(SERVER_BUNDLED)) return SERVER_BUNDLED;
  if (existsSync(SERVER_SOURCE)) return SERVER_SOURCE;
  throw new Error('Server file not found. Run "npm run build" first or check installation.');
}

function openBrowser(url) {
  const os = platform();
  try {
    if (os === 'darwin') execSync(`open "${url}"`);
    else if (os === 'linux') execSync(`xdg-open "${url}"`);
    else if (os === 'win32') execSync(`start "" "${url}"`);
  } catch {
    console.log(`  Open manually: ${url}`);
  }
}

// ── Commands ─────────────────────────────────────────────────

function cmdStart() {
  const info = readPidFile();
  if (info && isProcessRunning(info.pid)) {
    const url = `http://localhost:${info.port}`;
    console.log(`  Agent Monitor is already running (PID: ${info.pid})`);
    console.log(`  ${url}`);
    openBrowser(url);
    return;
  }

  // Clean stale PID file
  if (info) {
    try { unlinkSync(PID_FILE); } catch {}
  }

  const serverFile = getServerFile();
  const child = spawn('node', [serverFile], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });

  child.unref();
  console.log(`  Starting Agent Monitor server (PID: ${child.pid})...`);

  // Wait for PID file to appear (server writes it on listen)
  let attempts = 0;
  const check = setInterval(() => {
    attempts++;
    const pidInfo = readPidFile();
    if (pidInfo && pidInfo.pid && isProcessRunning(pidInfo.pid)) {
      clearInterval(check);
      const url = `http://localhost:${pidInfo.port}`;
      console.log('');
      console.log('  Agent Monitor Dashboard');
      console.log(`  ${url}`);
      console.log('');
      openBrowser(url);
    } else if (attempts > 30) {
      clearInterval(check);
      console.error('  Failed to start server (timeout)');
      process.exit(1);
    }
  }, 200);
}

function cmdStop() {
  const info = readPidFile();
  if (!info) {
    console.log('  Agent Monitor is not running.');
    return;
  }

  if (isProcessRunning(info.pid)) {
    try {
      process.kill(info.pid, 'SIGTERM');
      console.log(`  Stopping Agent Monitor (PID: ${info.pid})...`);
      // Wait a moment then clean up
      setTimeout(() => {
        try { unlinkSync(PID_FILE); } catch {}
        console.log('  Server stopped.');
      }, 1000);
    } catch (err) {
      console.error(`  Failed to stop process: ${err.message}`);
    }
  } else {
    try { unlinkSync(PID_FILE); } catch {}
    console.log('  Agent Monitor was not running (cleaned stale PID file).');
  }
}

function cmdStatus() {
  const info = readPidFile();
  if (!info) {
    console.log('  Agent Monitor: NOT RUNNING');
    return;
  }

  if (isProcessRunning(info.pid)) {
    console.log(`  Agent Monitor: RUNNING`);
    console.log(`  PID:  ${info.pid}`);
    console.log(`  URL:  http://localhost:${info.port}`);
  } else {
    try { unlinkSync(PID_FILE); } catch {}
    console.log('  Agent Monitor: NOT RUNNING (cleaned stale PID file)');
  }
}

function cmdOpen() {
  const info = readPidFile();
  if (!info || !isProcessRunning(info.pid)) {
    console.log('  Agent Monitor is not running. Starting it first...');
    cmdStart();
    return;
  }
  const url = `http://localhost:${info.port}`;
  console.log(`  Opening ${url}`);
  openBrowser(url);
}

// ── Main ─────────────────────────────────────────────────────
const command = process.argv[2] || 'start';

switch (command) {
  case 'start': cmdStart(); break;
  case 'stop': cmdStop(); break;
  case 'status': cmdStatus(); break;
  case 'open': cmdOpen(); break;
  default:
    console.log('Usage: node start.mjs [start|stop|status|open]');
    process.exit(1);
}
