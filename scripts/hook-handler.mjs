#!/usr/bin/env node

// Hook event handler for Agent Monitor plugin
// Called by Claude Code hooks to provide contextual notifications

import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PID_FILE = join(homedir(), '.claude', 'agent-monitor', 'server.pid');
const event = process.argv[2];

function isMonitorRunning() {
  try {
    const data = JSON.parse(readFileSync(PID_FILE, 'utf-8'));
    const port = parseInt(data.port, 10);
    const pid = parseInt(data.pid, 10);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) return null;
    if (!Number.isInteger(pid) || pid < 1) return null;
    process.kill(pid, 0);
    return data;
  } catch {
    return null;
  }
}

switch (event) {
  case 'team-created': {
    const info = isMonitorRunning();
    if (info) {
      console.log(`Agent Monitor is live at http://localhost:${info.port}`);
    } else {
      console.log('Tip: Run /monitor to visualize your team agents in real-time');
    }
    break;
  }
  default:
    break;
}
