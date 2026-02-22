// Main application — state management, WebSocket, sidebar, interactions
import { getAgentDef, ZONES } from './agents.js';
import { Renderer } from './renderer.js';
import { ParticleSystem } from './particles.js';

// ── State ──────────────────────────────────────────
const state = {
  teams: [],
  activeTeam: null,
  config: null,
  agents: [],       // rendered agent objects
  tasks: [],
  messages: [],     // last N messages for log
  phase: null,
  connected: false,
};

const MAX_MESSAGES = 100;
let ws = null;
let renderer = null;
let particles = null;

// ── Init ───────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('scene');
  renderer = new Renderer(canvas);
  particles = new ParticleSystem();

  setupCanvasInteractions(canvas);
  connectWebSocket();
  requestAnimationFrame(renderLoop);
});

function renderLoop() {
  renderer.render(state, particles);
  requestAnimationFrame(renderLoop);
}

// ── WebSocket ──────────────────────────────────────
function connectWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => {
    state.connected = true;
    updateConnectionStatus();
  };

  ws.onclose = () => {
    state.connected = false;
    updateConnectionStatus();
    setTimeout(connectWebSocket, 2000);
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      handleMessage(msg);
    } catch {}
  };
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'init':
      state.teams = msg.teams || [];
      updateTeamSelector();
      // Auto-select first team if none selected
      if (!state.activeTeam && state.teams.length > 0) {
        selectTeam(state.teams[0]);
      }
      break;

    case 'team_state':
      state.config = msg.config;
      state.tasks = msg.tasks || [];
      state.messages = (msg.messages || []).slice(-MAX_MESSAGES);
      state.phase = msg.phase;
      rebuildAgents();
      updateSidebar();
      break;

    case 'config_update':
      state.config = msg.config;
      rebuildAgents();
      updateSidebar();
      break;

    case 'task_update':
      updateTask(msg.task);
      assignTasksToAgents();
      updateTaskBoard();
      break;

    case 'message_new':
      handleNewMessage(msg.message);
      break;

    case 'phase_update':
      state.phase = msg.phase;
      updatePipelineDisplay();
      break;
  }
}

function selectTeam(teamName) {
  state.activeTeam = teamName;
  state.agents = [];
  state.tasks = [];
  state.messages = [];
  state.phase = null;
  ws?.send(JSON.stringify({ type: 'select_team', teamName }));
  updateTeamSelector();
}

// ── Agent Management ───────────────────────────────
function rebuildAgents() {
  if (!state.config?.members) return;

  const existing = new Map(state.agents.map(a => [a.name, a]));
  const newAgents = [];

  // Zone slot counters
  const zoneSlots = { planning: 0, coding: 0, review: 0 };

  for (const member of state.config.members) {
    const def = getAgentDef(member.agentType);
    const ex = existing.get(member.name);

    if (ex) {
      // Update properties, keep position if zone unchanged
      ex.type = member.agentType;
      ex.emoji = def.emoji;
      ex.color = def.color;
      ex.size = def.size;
      ex.label = def.label;
      ex.isActive = member.isActive !== false;
      if (ex.zone !== def.zone) {
        ex.zone = def.zone;
        const pos = getSlotPosition(def.zone, zoneSlots[def.zone]++);
        ex.targetX = pos.x;
        ex.targetY = pos.y;
        ex.animState = 'moving';
        setTimeout(() => { if (ex.animState === 'moving') ex.animState = 'idle'; }, 1000);
      } else {
        zoneSlots[def.zone]++;
      }
      newAgents.push(ex);
    } else {
      // New agent
      const pos = getSlotPosition(def.zone, zoneSlots[def.zone]++);
      newAgents.push({
        name: member.name,
        agentId: member.agentId,
        type: member.agentType,
        isActive: member.isActive !== false,
        ...def,
        x: pos.x, y: pos.y,
        targetX: pos.x, targetY: pos.y,
        animState: 'idle',
        bubble: null,
        taskSubject: null,
        _seed: Math.random() * 100,
        _drawX: pos.x, _drawY: pos.y,
      });
    }
  }

  state.agents = newAgents;
  assignTasksToAgents();
}

function getSlotPosition(zone, index) {
  const z = ZONES[zone];
  if (!z) return { x: 200, y: 200 };
  const w = renderer.w;
  const h = renderer.h;
  const zx = z.x * w;
  const zy = z.y * h;
  const zw = z.w * w;
  const zh = z.h * h;

  // Grid layout within zone
  const cols = Math.max(2, Math.floor(zw / 90));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const cellW = zw / cols;
  const cellH = Math.min(80, (zh - 40) / Math.max(1, Math.ceil(10 / cols)));

  return {
    x: zx + cellW * (col + 0.5),
    y: zy + 40 + cellH * (row + 0.5),
  };
}

// ── Task Management ────────────────────────────────
function updateTask(task) {
  const idx = state.tasks.findIndex(t => t.id === task.id);
  const oldTask = idx >= 0 ? state.tasks[idx] : null;

  if (idx >= 0) state.tasks[idx] = task;
  else state.tasks.push(task);

  // Task completion particle burst
  if (task.status === 'completed' && oldTask?.status !== 'completed') {
    const agent = state.agents.find(a => a.name === task.owner);
    if (agent) {
      particles.burstComplete(agent._drawX || agent.x, agent._drawY || agent.y);
    }
  }
}

function assignTasksToAgents() {
  // Reset
  for (const a of state.agents) {
    a.taskSubject = null;
    if (a.animState !== 'talking' && a.animState !== 'moving') {
      a.animState = 'idle';
    }
  }

  for (const task of state.tasks) {
    if (!task.owner || task.status !== 'in_progress') continue;
    const agent = state.agents.find(a => a.name === task.owner);
    if (agent) {
      agent.taskSubject = task.subject || task.id;
      if (agent.animState !== 'talking') agent.animState = 'working';
    }
  }
}

// ── Message Handling ───────────────────────────────
function handleNewMessage(msg) {
  state.messages.push(msg);
  if (state.messages.length > MAX_MESSAGES) state.messages.shift();

  // Parse message text
  const parsed = parseMessageText(msg.text || msg.content || '');

  // Show bubble on receiving agent
  const toAgent = state.agents.find(a => a.name === msg._to);
  if (toAgent) {
    toAgent.bubble = { text: parsed.display, time: Date.now() };
    toAgent.animState = 'talking';
    setTimeout(() => {
      if (toAgent.animState === 'talking') {
        toAgent.animState = toAgent.taskSubject ? 'working' : 'idle';
      }
    }, 4000);
  }

  // Message trail particles
  const fromAgent = state.agents.find(a => a.name === msg.from);
  if (fromAgent && toAgent) {
    particles.trailMessage(
      fromAgent._drawX || fromAgent.x, fromAgent._drawY || fromAgent.y,
      toAgent._drawX || toAgent.x, toAgent._drawY || toAgent.y
    );
  }

  // Handle special message types
  if (parsed.type === 'idle_notification') {
    const agent = state.agents.find(a => a.name === msg.from);
    if (agent && agent.animState !== 'talking') agent.animState = 'idle';
  }

  updateMessageLog();
}

function parseMessageText(text) {
  if (!text) return { type: 'text', display: '' };
  try {
    const obj = JSON.parse(text);
    if (obj.type === 'task_assignment') {
      return { type: 'task_assignment', display: `📋 ${obj.task?.subject || 'New task'}` };
    }
    if (obj.type === 'idle_notification' || obj.type === 'idle') {
      return { type: 'idle_notification', display: '💤 Idle' };
    }
    if (obj.type === 'permission_request') {
      return { type: 'permission', display: `🔑 ${obj.description || 'Permission request'}` };
    }
    if (obj.type === 'shutdown_request') {
      return { type: 'shutdown', display: '🛑 Shutdown request' };
    }
    if (obj.summary) return { type: 'message', display: obj.summary };
    if (obj.content) {
      const content = typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content);
      return { type: 'message', display: content.slice(0, 80) };
    }
    return { type: 'json', display: text.slice(0, 80) };
  } catch {
    return { type: 'text', display: text.slice(0, 80) };
  }
}

// ── Canvas Interactions ────────────────────────────
function setupCanvasInteractions(canvas) {
  let selectedAgent = null;

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = renderer.hitTest(state.agents, mx, my);
    renderer.hoveredAgent = hit?.name || null;
    canvas.style.cursor = hit ? 'pointer' : 'default';
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = renderer.hitTest(state.agents, mx, my);

    if (hit) {
      showAgentPopover(hit, e.clientX, e.clientY);
    } else {
      hideAgentPopover();
    }
  });
}

function showAgentPopover(agent, px, py) {
  hideAgentPopover();
  const el = document.createElement('div');
  el.id = 'agent-popover';
  el.className = 'popover';

  const tasks = state.tasks.filter(t => t.owner === agent.name);
  const taskList = tasks.length
    ? tasks.map(t => `<div class="pop-task ${t.status}">${statusIcon(t.status)} ${escHtml(t.subject || t.id)}</div>`).join('')
    : '<div class="pop-empty">No tasks</div>';

  el.innerHTML = `
    <div class="pop-header" style="border-color: ${agent.color}">
      <span class="pop-emoji">${agent.emoji}</span>
      <div>
        <div class="pop-name">${escHtml(agent.name)}</div>
        <div class="pop-type">${escHtml(agent.type || 'unknown')}</div>
      </div>
    </div>
    <div class="pop-status ${agent.animState}">${agent.animState.toUpperCase()}</div>
    <div class="pop-tasks">${taskList}</div>
  `;

  // Position
  el.style.left = Math.min(px, window.innerWidth - 260) + 'px';
  el.style.top = Math.min(py, window.innerHeight - 200) + 'px';
  document.body.appendChild(el);

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!el.contains(e.target)) {
        hideAgentPopover();
        document.removeEventListener('click', close);
      }
    });
  }, 10);
}

function hideAgentPopover() {
  document.getElementById('agent-popover')?.remove();
}

// ── Sidebar Updates ────────────────────────────────
function updateConnectionStatus() {
  const el = document.getElementById('conn-status');
  if (el) {
    el.textContent = state.connected ? 'CONNECTED' : 'RECONNECTING...';
    el.className = 'conn-status ' + (state.connected ? 'on' : 'off');
  }
}

function updateTeamSelector() {
  const sel = document.getElementById('team-select');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = state.teams.length === 0
    ? '<option value="">No teams found</option>'
    : state.teams.map(t => `<option value="${t}" ${t === state.activeTeam ? 'selected' : ''}>${t}</option>`).join('');

  if (state.activeTeam && sel.value !== state.activeTeam) sel.value = state.activeTeam;
}

function updateSidebar() {
  updatePipelineDisplay();
  updateTaskBoard();
  updateMessageLog();
  updateAgentList();
}

function updatePipelineDisplay() {
  const el = document.getElementById('pipeline');
  if (!el) return;
  const stages = ['team-plan', 'team-prd', 'team-exec', 'team-verify', 'team-fix'];
  const labels = ['PLAN', 'PRD', 'EXEC', 'VERIFY', 'FIX'];
  el.innerHTML = stages.map((s, i) => {
    const active = state.phase === s;
    return `<span class="stage ${active ? 'active' : ''}">${active ? '★' : ''}${labels[i]}${active ? '★' : ''}</span>`;
  }).join('<span class="stage-sep">━━</span>');
}

function updateTaskBoard() {
  const el = document.getElementById('task-board');
  if (!el) return;
  if (state.tasks.length === 0) {
    el.innerHTML = '<div class="empty-hint">No tasks yet</div>';
    return;
  }
  // Sort: in_progress first, then pending, then completed
  const order = { in_progress: 0, pending: 1, completed: 2 };
  const sorted = [...state.tasks].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
  el.innerHTML = sorted.map(t => `
    <div class="task-item ${t.status}">
      <span class="task-status">${statusIcon(t.status)}</span>
      <div class="task-info">
        <div class="task-subject">${escHtml(t.subject || t.id)}</div>
        <div class="task-meta">${t.owner ? escHtml(t.owner) : '<i>unassigned</i>'}${t.blockedBy?.length ? ' ⛔ blocked' : ''}</div>
      </div>
    </div>
  `).join('');
}

function updateMessageLog() {
  const el = document.getElementById('msg-log');
  if (!el) return;
  const recent = state.messages.slice(-30);
  if (recent.length === 0) {
    el.innerHTML = '<div class="empty-hint">No messages yet</div>';
    return;
  }
  el.innerHTML = recent.map(m => {
    const parsed = parseMessageText(m.text || m.content || '');
    const agent = state.agents.find(a => a.name === m.from);
    const color = agent?.color || '#90a4ae';
    const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : '';
    return `
      <div class="msg-item">
        <span class="msg-dot" style="background:${color}"></span>
        <span class="msg-from">${escHtml(m.from || '?')}</span>
        <span class="msg-arrow">→</span>
        <span class="msg-to">${escHtml(m._to || '?')}</span>
        <span class="msg-text">${escHtml(parsed.display)}</span>
        <span class="msg-time">${time}</span>
      </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function updateAgentList() {
  const el = document.getElementById('agent-list');
  if (!el) return;
  if (state.agents.length === 0) {
    el.innerHTML = '<div class="empty-hint">No agents</div>';
    return;
  }
  el.innerHTML = state.agents.map(a => `
    <div class="agent-item ${a.animState}">
      <span class="agent-emoji">${a.emoji}</span>
      <div class="agent-info">
        <span class="agent-name">${escHtml(a.name)}</span>
        <span class="agent-status-dot ${a.animState}"></span>
      </div>
    </div>
  `).join('');
}

// ── Event Handlers ─────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('team-select')?.addEventListener('change', (e) => {
    if (e.target.value) selectTeam(e.target.value);
  });

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    ws?.send(JSON.stringify({ type: 'refresh' }));
  });
});

// ── Utilities ──────────────────────────────────────
function statusIcon(status) {
  switch (status) {
    case 'completed': return '✅';
    case 'in_progress': return '🔄';
    case 'pending': return '⏳';
    default: return '❓';
  }
}

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
