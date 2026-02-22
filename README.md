# Agent Monitor Dashboard

Real-time 2D Canvas dashboard for visualizing Claude Code team agents.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- Animated agent characters in **Planning**, **Coding**, and **Review** zones
- Real-time task board with status tracking
- Message passing visualization with particle effects
- Pipeline stage progression (PLAN → PRD → EXEC → VERIFY → FIX)
- WebSocket-based live updates from `~/.claude/teams/` and `~/.claude/tasks/`
- Auto-reconnect on connection loss

## Installation

### As Claude Code Plugin

```bash
# Install from GitHub
claude plugin add https://github.com/evar/claude-agent-monitor
```

Once installed, use the `/monitor` command in Claude Code.

### Manual / Standalone

```bash
git clone https://github.com/evar/claude-agent-monitor.git
cd claude-agent-monitor
npm install
npm run build
```

## Usage

### Via Claude Code

```
/monitor              # Start server and open browser
/monitor stop         # Stop the server
/monitor status       # Check if running
/monitor open         # Open dashboard in browser
```

### Standalone

```bash
# Start the server
npm start

# Or run the bundled server directly
node server/server.bundled.cjs

# Stop
npm stop

# Check status
npm run status
```

The dashboard opens at `http://localhost:3777` (auto-increments if port is busy).

## How It Works

1. The server watches `~/.claude/teams/` for team configurations and `~/.claude/tasks/` for task files
2. Changes are detected via `chokidar` file watcher
3. Updates are pushed to the browser via WebSocket
4. The Canvas 2D renderer draws agents with animations, particles, and speech bubbles

## Plugin Structure

```
.claude-plugin/
  plugin.json          # Plugin manifest
  marketplace.json     # Marketplace listing metadata
commands/
  monitor.md           # /monitor slash command
skills/
  monitor/SKILL.md     # Skill trigger definitions
hooks/
  hooks.json           # Hook registrations
scripts/
  start.mjs            # Server process management
  hook-handler.mjs     # Hook event handler
server/
  server.js            # Server source (ESM)
  server.bundled.cjs   # Bundled server (no npm install needed)
  public/              # Frontend static files
```

## Development

```bash
# Install dependencies
npm install

# Edit server/server.js or server/public/* files

# Rebuild bundle
npm run build

# Test
node server/server.bundled.cjs
```

## Requirements

- Node.js >= 18
- Claude Code with team/task support

## License

MIT
