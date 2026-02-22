---
description: Agent Monitor Dashboard - real-time 2D visualization of team agents
triggers:
  - monitor agents
  - agent dashboard
  - watch agents
  - agent visualization
  - show dashboard
  - open monitor
---
# Agent Monitor Dashboard

A real-time 2D Canvas dashboard that visualizes Claude Code team agents working together.

## What it does
- Shows agents as animated characters in Planning, Coding, and Review zones
- Displays real-time task assignments and progress
- Animates message passing between agents with particle effects
- Shows pipeline stage progression (PLAN -> PRD -> EXEC -> VERIFY -> FIX)

## How to use
Run `/monitor` to start the dashboard server, or use these commands:
- `/monitor start` - Start the server and open in browser
- `/monitor stop` - Stop the server
- `/monitor status` - Check server status
- `/monitor open` - Open dashboard in browser

The dashboard watches `~/.claude/teams/` and `~/.claude/tasks/` directories for live updates via WebSocket.
