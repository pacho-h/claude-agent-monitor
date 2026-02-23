import { createServer } from 'http';
import { readFileSync, readdirSync, existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, extname, dirname, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import { homedir } from 'os';

// Works in both ESM (source) and CJS (bundled) contexts
const SCRIPT_DIR = (typeof __dirname !== 'undefined' && __dirname !== '')
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));

// Plugin root: prefer env var, fall back to parent of server/
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || join(SCRIPT_DIR, '..');
const PUBLIC_DIR = resolve(PLUGIN_ROOT, 'server', 'public') + sep; // trailing sep for safe prefix check
const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';
const BASE_PORT = parseInt(process.env.PORT || '3777', 10);
const HOME = homedir();
const TEAMS_DIR = join(HOME, '.claude', 'teams');
const TASKS_DIR = join(HOME, '.claude', 'tasks');

// PID file in user-private directory
const STATE_DIR = join(HOME, '.claude', 'agent-monitor');
mkdirSync(STATE_DIR, { recursive: true });
const PID_FILE = join(STATE_DIR, 'server.pid');

// Team name validation: only safe directory names
const TEAM_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

async function safeReadJSON(p) {
  try {
    const raw = await readFile(p, 'utf-8');
    if (raw.length > 1_000_000) return null; // 1 MB cap
    const obj = JSON.parse(raw);
    if (Object.prototype.hasOwnProperty.call(obj, '__proto__')) return null;
    return obj;
  } catch { return null; }
}

// ── Port Discovery ──────────────────────────────────────────
async function findAvailablePort(startPort, maxTries = 10) {
  const net = await import('net');
  for (let i = 0; i < maxTries; i++) {
    const port = startPort + i;
    const available = await new Promise((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => resolve(false));
      srv.once('listening', () => { srv.close(() => resolve(true)); });
      srv.listen(port, BIND_HOST);
    });
    if (available) return port;
  }
  throw new Error(`No available port found (tried ${startPort}-${startPort + maxTries - 1})`);
}

// ── HTTP Server ──────────────────────────────────────────────
const httpServer = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost`);
  const filePath = resolve(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  try {
    const content = readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      ...SECURITY_HEADERS,
    });
    res.end(content);
  } catch {
    res.writeHead(404); res.end('Not Found');
  }
});

// ── WebSocket Server ─────────────────────────────────────────
const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: 64 * 1024, // 64 KB limit
  verifyClient: ({ req }) => {
    const origin = req.headers['origin'];
    if (origin && !origin.startsWith('http://localhost:') && !origin.startsWith('http://127.0.0.1:')) {
      return false;
    }
    return true;
  },
});
const teamWatchers = new Map();
const inboxCounts = new Map();

function discoverTeams() {
  if (!existsSync(TEAMS_DIR)) return [];
  try {
    return readdirSync(TEAMS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && TEAM_NAME_RE.test(d.name) && existsSync(join(TEAMS_DIR, d.name, 'config.json')))
      .map(d => d.name);
  } catch { return []; }
}

async function readTasks(teamName) {
  const dir = join(TASKS_DIR, teamName);
  if (!existsSync(dir)) return [];
  const tasks = [];
  try {
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const t = await safeReadJSON(join(dir, f));
      if (t) tasks.push(t);
    }
  } catch {}
  return tasks;
}

async function readInboxMessages(teamName) {
  const dir = join(TEAMS_DIR, teamName, 'inboxes');
  if (!existsSync(dir)) return [];
  const msgs = [];
  try {
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const inbox = await safeReadJSON(join(dir, f));
      if (!Array.isArray(inbox)) continue;
      const to = f.replace('.json', '');
      inboxCounts.set(`${teamName}:${to}`, inbox.length);
      for (const m of inbox) msgs.push({ ...m, _to: to });
    }
  } catch {}
  return msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

async function findPhase(teamName) {
  for (const base of [process.cwd(), HOME]) {
    const s = await safeReadJSON(join(base, '.omc', 'state', 'team-state.json'));
    if (s?.current_phase) return s.current_phase;
  }
  return null;
}

async function buildTeamState(teamName) {
  const config = await safeReadJSON(join(TEAMS_DIR, teamName, 'config.json'));
  if (!config) return null;
  return {
    teamName,
    config,
    tasks: await readTasks(teamName),
    messages: await readInboxMessages(teamName),
    phase: await findPhase(teamName),
  };
}

function broadcast(teamName, data) {
  const msg = JSON.stringify(data);
  for (const c of wss.clients) {
    if (c.readyState === 1 && c._team === teamName) c.send(msg);
  }
}

function setupWatcher(teamName) {
  if (teamWatchers.has(teamName)) return;

  const paths = [join(TEAMS_DIR, teamName)];
  const tasksDir = join(TASKS_DIR, teamName);
  if (existsSync(tasksDir)) paths.push(tasksDir);

  for (const base of [process.cwd(), HOME]) {
    const sf = join(base, '.omc', 'state', 'team-state.json');
    if (existsSync(sf)) { paths.push(sf); break; }
  }

  const watcher = chokidar.watch(paths, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    persistent: true,
    depth: 2,
  });

  const handle = async (filePath) => {
    if (filePath.endsWith('config.json') && filePath.includes(join('teams', teamName))) {
      const config = await safeReadJSON(filePath);
      if (config) broadcast(teamName, { type: 'config_update', teamName, config });
    }
    else if (filePath.includes(join('tasks', teamName)) && filePath.endsWith('.json')) {
      const task = await safeReadJSON(filePath);
      if (task) broadcast(teamName, { type: 'task_update', teamName, task });
    }
    else if (filePath.includes('inboxes') && filePath.endsWith('.json')) {
      const inbox = await safeReadJSON(filePath);
      if (!Array.isArray(inbox)) return;
      const agent = filePath.split('/').pop().replace('.json', '');
      const key = `${teamName}:${agent}`;
      const prev = inboxCounts.get(key) || 0;
      if (inbox.length > prev) {
        inboxCounts.set(key, inbox.length);
        for (const m of inbox.slice(prev)) {
          broadcast(teamName, { type: 'message_new', teamName, message: { ...m, _to: agent } });
        }
      }
    }
    else if (filePath.includes('team-state.json')) {
      const s = await safeReadJSON(filePath);
      if (s?.current_phase) broadcast(teamName, { type: 'phase_update', teamName, phase: s.current_phase });
    }
  };

  watcher.on('change', handle);
  watcher.on('add', handle);
  teamWatchers.set(teamName, watcher);
}

// ── WS Connections ───────────────────────────────────────────
wss.on('connection', (ws) => {
  ws._lastSelect = 0;
  ws.send(JSON.stringify({ type: 'init', teams: discoverTeams() }));

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'select_team') {
        // Rate limit: 1 select per second
        const now = Date.now();
        if (now - ws._lastSelect < 1000) return;
        ws._lastSelect = now;
        // Validate team name
        const teamName = String(msg.teamName || '');
        if (!TEAM_NAME_RE.test(teamName)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid team name' }));
          return;
        }
        if (!existsSync(join(TEAMS_DIR, teamName, 'config.json'))) {
          ws.send(JSON.stringify({ type: 'error', message: 'Team not found' }));
          return;
        }
        ws._team = teamName;
        setupWatcher(teamName);
        const state = await buildTeamState(teamName);
        if (state) ws.send(JSON.stringify({ type: 'team_state', ...state }));
      } else if (msg.type === 'refresh') {
        ws.send(JSON.stringify({ type: 'init', teams: discoverTeams() }));
      }
    } catch {}
  });
});

// Periodic team discovery (every 10s)
setInterval(() => {
  const teams = discoverTeams();
  const msg = JSON.stringify({ type: 'init', teams });
  for (const c of wss.clients) {
    if (c.readyState === 1) c.send(msg);
  }
}, 10000);

// ── Graceful Shutdown ────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n  Received ${signal}, shutting down...`);
  for (const [, watcher] of teamWatchers) {
    watcher.close();
  }
  teamWatchers.clear();
  for (const client of wss.clients) {
    client.close();
  }
  wss.close();
  httpServer.close(() => {
    try { unlinkSync(PID_FILE); } catch {}
    console.log('  Server stopped.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Start ────────────────────────────────────────────────────
async function start() {
  const PORT = await findAvailablePort(BASE_PORT);

  httpServer.listen(PORT, BIND_HOST, () => {
    writeFileSync(PID_FILE, JSON.stringify({ pid: process.pid, port: PORT }), { mode: 0o600 });

    console.log('');
    console.log('  Agent Monitor Dashboard');
    console.log(`  http://localhost:${PORT}`);
    console.log('');
    console.log('  Watching: ~/.claude/teams/ & ~/.claude/tasks/');
    console.log('  Press Ctrl+C to stop');
    console.log('');
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
