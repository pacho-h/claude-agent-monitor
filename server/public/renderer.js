// Canvas 2D rendering engine
import { ZONES, ANIM_STATES } from './agents.js';

const GRID_SIZE = 30;
const AGENT_BASE_RADIUS = 22;
const BUBBLE_DURATION = 4000; // ms

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;
    this.lastTime = 0;
    this.hoveredAgent = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
  }

  // ── Background ───────────────────────────────────
  drawBackground() {
    const { ctx, w, h } = this;
    // Dark base
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, w, h);
    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  // ── Zones ────────────────────────────────────────
  drawZones() {
    const { ctx, w, h } = this;
    for (const [, zone] of Object.entries(ZONES)) {
      const zx = zone.x * w, zy = zone.y * h;
      const zw = zone.w * w, zh = zone.h * h;
      // Fill
      ctx.fillStyle = zone.color;
      ctx.beginPath();
      this._roundRect(ctx, zx, zy, zw, zh, 12);
      ctx.fill();
      // Border
      ctx.strokeStyle = zone.border;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      this._roundRect(ctx, zx, zy, zw, zh, 12);
      ctx.stroke();
      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = 'bold 13px "SF Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(zone.label, zx + 14, zy + 24);
    }
  }

  // ── Agent ────────────────────────────────────────
  drawAgent(agent, now) {
    const { ctx } = this;
    const anim = ANIM_STATES[agent.animState || 'idle'];
    const r = AGENT_BASE_RADIUS * (agent.size || 1.0);

    // Wobble
    const wobbleX = Math.sin(now * anim.wobbleSpeed + agent._seed) * anim.wobbleAmp;
    const wobbleY = Math.cos(now * anim.wobbleSpeed * 0.7 + agent._seed) * anim.wobbleAmp;
    const ax = agent.x + wobbleX;
    const ay = agent.y + wobbleY;
    agent._drawX = ax;
    agent._drawY = ay;

    // Glow
    if (anim.glowRadius > 0) {
      const pulse = 0.7 + 0.3 * Math.sin(now * 3);
      const grad = ctx.createRadialGradient(ax, ay, r * 0.5, ax, ay, r + anim.glowRadius);
      grad.addColorStop(0, this._colorAlpha(agent.color, anim.glowAlpha * pulse));
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ax, ay, r + anim.glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body circle
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(ax, ay, r, 0, Math.PI * 2);
    ctx.fill();

    // Status ring
    ctx.strokeStyle = agent.color;
    ctx.lineWidth = agent.animState === 'working' ? 3 : 2;
    if (agent.animState === 'working') {
      // Rotating dash ring
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(now * 2);
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(ax, ay, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Emoji
    ctx.font = `${Math.round(r * 0.9)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(agent.emoji, ax, ay + 1);

    // Name label
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px "SF Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(agent.label || agent.name, ax, ay + r + 5);

    // Task label (if working)
    if (agent.taskSubject) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '9px "SF Mono", monospace';
      const taskText = agent.taskSubject.length > 20 ? agent.taskSubject.slice(0, 20) + '...' : agent.taskSubject;
      ctx.fillText(taskText, ax, ay + r + 18);
    }

    // Highlight on hover
    if (this.hoveredAgent === agent.name) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(ax, ay, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Speech Bubble ────────────────────────────────
  drawBubble(agent) {
    if (!agent.bubble) return;
    const { ctx } = this;
    const elapsed = Date.now() - agent.bubble.time;
    if (elapsed > BUBBLE_DURATION) { agent.bubble = null; return; }

    const alpha = elapsed > BUBBLE_DURATION - 500 ? (BUBBLE_DURATION - elapsed) / 500 : 1;
    const ax = agent._drawX || agent.x;
    const ay = agent._drawY || agent.y;
    const r = AGENT_BASE_RADIUS * (agent.size || 1.0);
    const text = agent.bubble.text;
    const maxW = 180;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '11px "SF Mono", Consolas, monospace';

    // Measure text
    const lines = this._wrapText(ctx, text, maxW - 16);
    const lineH = 14;
    const bw = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 20);
    const bh = lines.length * lineH + 12;
    const bx = ax - bw / 2;
    const by = ay - r - bh - 14;

    // Bubble background
    ctx.fillStyle = 'rgba(30, 40, 70, 0.92)';
    ctx.beginPath();
    this._roundRect(ctx, bx, by, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = agent.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    this._roundRect(ctx, bx, by, bw, bh, 8);
    ctx.stroke();

    // Arrow pointer
    ctx.fillStyle = 'rgba(30, 40, 70, 0.92)';
    ctx.beginPath();
    ctx.moveTo(ax - 6, by + bh);
    ctx.lineTo(ax, by + bh + 8);
    ctx.lineTo(ax + 6, by + bh);
    ctx.fill();

    // Text
    ctx.fillStyle = '#e0e0e0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bx + 10, by + 6 + i * lineH);
    }
    ctx.restore();
  }

  // ── Dependency Lines ─────────────────────────────
  drawDependencyLines(agents, tasks, now) {
    const { ctx } = this;
    const agentMap = new Map(agents.map(a => [a.name, a]));

    for (const task of tasks) {
      if (!task.owner || !task.blocks?.length) continue;
      const fromAgent = agentMap.get(task.owner);
      if (!fromAgent) continue;

      for (const blockedId of task.blocks) {
        const blockedTask = tasks.find(t => t.id === blockedId);
        if (!blockedTask?.owner) continue;
        const toAgent = agentMap.get(blockedTask.owner);
        if (!toAgent) continue;

        const fx = fromAgent._drawX || fromAgent.x;
        const fy = fromAgent._drawY || fromAgent.y;
        const tx = toAgent._drawX || toAgent.x;
        const ty = toAgent._drawY || toAgent.y;

        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -now * 20;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ── Hit Test ─────────────────────────────────────
  hitTest(agents, mx, my) {
    for (const a of agents) {
      const dx = mx - (a._drawX || a.x);
      const dy = my - (a._drawY || a.y);
      const r = AGENT_BASE_RADIUS * (a.size || 1.0) + 6;
      if (dx * dx + dy * dy < r * r) return a;
    }
    return null;
  }

  // ── Main Render ──────────────────────────────────
  render(state, particles) {
    const now = performance.now() / 1000;
    const dt = this.lastTime ? now - this.lastTime : 0.016;
    this.lastTime = now;

    this.drawBackground();
    this.drawZones();

    if (state.agents.length === 0) {
      this.drawEmptyState();
      particles.update(dt);
      particles.draw(this.ctx);
      return;
    }

    // Update agent positions (lerp)
    for (const a of state.agents) {
      a.x += (a.targetX - a.x) * Math.min(1, dt * 4);
      a.y += (a.targetY - a.y) * Math.min(1, dt * 4);
    }

    this.drawDependencyLines(state.agents, state.tasks, now);

    for (const a of state.agents) {
      this.drawAgent(a, now);
    }
    for (const a of state.agents) {
      this.drawBubble(a);
    }

    // Particles
    // Emit glow particles for working agents
    for (const a of state.agents) {
      if (a.animState === 'working' && Math.random() < 0.3) {
        particles.glowAmbient(a._drawX || a.x, a._drawY || a.y, a.color);
      }
    }
    particles.update(dt);
    particles.draw(this.ctx);
  }

  drawEmptyState() {
    const { ctx, w, h } = this;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '48px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏢', w / 2, h / 2 - 30);
    ctx.font = '16px "SF Mono", monospace';
    ctx.fillText('No agents active', w / 2, h / 2 + 20);
    ctx.font = '12px "SF Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillText('Start a team with /team to see agents here', w / 2, h / 2 + 45);
  }

  // ── Helpers ──────────────────────────────────────
  _roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _colorAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  _wrapText(ctx, text, maxW) {
    if (!text) return [''];
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }
}
