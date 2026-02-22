---
description: Start/stop the Agent Monitor dashboard
argument-hint: [start|stop|status|open]
allowed-tools: [Bash]
---
# Agent Monitor

Run the agent monitor dashboard server for real-time visualization of Claude Code team agents.

## Usage
- No args or "start": Start the dashboard server and open browser
- "stop": Stop the running server
- "status": Check if the server is running
- "open": Open the dashboard in browser (if server is already running)

## Instructions

Determine the plugin root directory by checking `CLAUDE_PLUGIN_ROOT` environment variable, or fall back to the directory containing this command file (go up one level from `commands/`).

Based on the argument provided:

### start (default)
1. Run: `node "${PLUGIN_ROOT}/scripts/start.mjs" start`
2. Report the URL to the user
3. The browser will open automatically

### stop
1. Run: `node "${PLUGIN_ROOT}/scripts/start.mjs" stop`
2. Confirm the server has stopped

### status
1. Run: `node "${PLUGIN_ROOT}/scripts/start.mjs" status`
2. Report whether the server is running and on which port

### open
1. Run: `node "${PLUGIN_ROOT}/scripts/start.mjs" open`
2. Opens the dashboard in the default browser
