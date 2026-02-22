#!/usr/bin/env node

// Hook event handler for Agent Monitor plugin
// Called by Claude Code hooks to provide contextual notifications

import { existsSync, readFileSync } from 'fs';

const PID_FILE = '/tmp/agent-monitor.pid';
const event = process.argv[2];

function isMonitorRunning() {
  try {
    const info = JSON.parse(readFileSync(PID_FILE, 'utf-8'));
    process.kill(info.pid, 0);
    return info;
  } catch {
    return null;
  }
}

switch (event) {
  case 'team-created': {
    const info = isMonitorRunning();
    if (info) {
      // Monitor is running, output URL reminder
      console.log(`Agent Monitor is live at http://localhost:${info.port}`);
    } else {
      // Monitor not running, suggest starting
      console.log('Tip: Run /monitor to visualize your team agents in real-time');
    }
    break;
  }
  default:
    // Unknown event, silently ignore
    break;
}
