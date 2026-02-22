// Particle effects system with object pooling

const MAX_PARTICLES = 500;

class Particle {
  constructor() { this.active = false; this.reset(); }

  reset() {
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.life = 0; this.maxLife = 1;
    this.size = 2; this.color = '#fff';
    this.alpha = 1; this.type = 'spark';
    this.active = false;
  }

  update(dt) {
    if (!this.active) return;
    this.life -= dt;
    if (this.life <= 0) { this.active = false; return; }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // Gravity for sparks
    if (this.type === 'spark') this.vy += 80 * dt;
    // Fade out
    this.alpha = Math.max(0, this.life / this.maxLife);
  }
}

export class ParticleSystem {
  constructor() {
    this.pool = Array.from({ length: MAX_PARTICLES }, () => new Particle());
  }

  _acquire() {
    return this.pool.find(p => !p.active) || null;
  }

  // Task completion: green/gold sparkle burst
  burstComplete(x, y) {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      if (!p) break;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 60 + Math.random() * 80;
      p.reset();
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = p.maxLife = 0.8 + Math.random() * 0.6;
      p.size = 2 + Math.random() * 3;
      p.color = Math.random() > 0.5 ? '#66bb6a' : '#ffd700';
      p.type = 'spark';
    }
  }

  // Message trail: blue dots from sender to receiver
  trailMessage(x1, y1, x2, y2) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const p = this._acquire();
      if (!p) break;
      const t = i / count;
      p.reset();
      p.active = true;
      p.x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 6;
      p.y = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 6;
      p.vx = (x2 - x1) * 0.3;
      p.vy = (y2 - y1) * 0.3;
      p.life = p.maxLife = 0.5 + Math.random() * 0.4;
      p.size = 2 + Math.random() * 2;
      p.color = '#42a5f5';
      p.type = 'trail';
    }
  }

  // Working glow: ambient particles around agent
  glowAmbient(x, y, color) {
    const p = this._acquire();
    if (!p) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = 12 + Math.random() * 16;
    p.reset();
    p.active = true;
    p.x = x + Math.cos(angle) * dist;
    p.y = y + Math.sin(angle) * dist;
    p.vx = Math.cos(angle) * 8;
    p.vy = Math.sin(angle) * 8;
    p.life = p.maxLife = 0.6 + Math.random() * 0.5;
    p.size = 1.5 + Math.random() * 2;
    p.color = color || '#ffd700';
    p.type = 'glow';
  }

  update(dt) {
    for (const p of this.pool) p.update(dt);
  }

  draw(ctx) {
    for (const p of this.pool) {
      if (!p.active) continue;
      ctx.save();
      ctx.globalAlpha = p.alpha * 0.8;
      if (p.type === 'glow') {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  activeCount() {
    return this.pool.filter(p => p.active).length;
  }
}
