/* ═══════════════════════════════════════════════════════════════════
   APEX STRIKER — script.js
   Complete 2D fighter jet shooter — Vanilla JS + Canvas
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════════
   SECTION 1 — AUDIO ENGINE (Web Audio API)
   ══════════════════════════════════════════════════════ */
class AudioEngine {
  constructor() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4;
      this.masterGain.connect(this.ctx.destination);
      this.enabled = true;
    } catch (e) {
      this.enabled = false;
    }
  }

  // Resume context after user interaction (autoplay policy)
  resume() {
    if (this.enabled && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Generate a beep with given params
  _beep(frequency, type, duration, gainVal, detune = 0, delay = 0) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type      = type;
    osc.frequency.setValueAtTime(frequency, t);
    osc.detune.setValueAtTime(detune, t);
    gain.gain.setValueAtTime(gainVal, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  // Noise burst for explosions
  _noise(duration, gainVal, delay = 0) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const bufLen = this.ctx.sampleRate * duration;
    const buf    = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src    = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain   = this.ctx.createGain();

    src.buffer           = buf;
    filter.type          = 'bandpass';
    filter.frequency.value = 300;
    filter.Q.value         = 0.5;
    gain.gain.setValueAtTime(gainVal, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
    src.stop(t + duration);
  }

  shoot() {
    this._beep(880, 'sawtooth', 0.08, 0.3);
    this._beep(440, 'square', 0.12, 0.15, -200, 0.02);
  }

  shootDouble() {
    this._beep(1100, 'sawtooth', 0.08, 0.3);
    this._beep(900,  'sawtooth', 0.08, 0.25, 0, 0.04);
  }

  explodeSmall() {
    this._noise(0.2, 0.4);
    this._beep(150, 'sawtooth', 0.2, 0.3, 0);
  }

  explodeLarge() {
    this._noise(0.5, 0.7);
    this._beep(80, 'sawtooth', 0.4, 0.5, 0);
    this._beep(60, 'square',   0.5, 0.3, 0, 0.1);
  }

  powerUp() {
    this._beep(523, 'sine', 0.1, 0.4);
    this._beep(659, 'sine', 0.1, 0.4, 0, 0.1);
    this._beep(784, 'sine', 0.15, 0.4, 0, 0.2);
  }

  waveStart() {
    this._beep(330, 'square', 0.12, 0.3);
    this._beep(440, 'square', 0.12, 0.3, 0, 0.14);
    this._beep(550, 'square', 0.2,  0.3, 0, 0.28);
  }

  playerHit() {
    this._noise(0.15, 0.5);
    this._beep(200, 'sawtooth', 0.2, 0.4);
  }

  gameOver() {
    this._beep(440, 'sawtooth', 0.3, 0.4);
    this._beep(330, 'sawtooth', 0.3, 0.4, 0, 0.3);
    this._beep(220, 'sawtooth', 0.5, 0.4, 0, 0.6);
  }
}

/* ══════════════════════════════════════════════════════
   SECTION 2 — UTILITIES
   ══════════════════════════════════════════════════════ */

// Clamp a value between min and max
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Random float between a and b
const rand  = (a, b) => Math.random() * (b - a) + a;

// Random integer between a and b (inclusive)
const randInt = (a, b) => Math.floor(rand(a, b + 1));

// Lerp
const lerp = (a, b, t) => a + (b - a) * t;

// Distance squared (faster, avoids sqrt)
const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

// HEX color to {r,g,b}
const hexToRgb = hex => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
};

/* ══════════════════════════════════════════════════════
   SECTION 3 — STAR BACKGROUND
   ══════════════════════════════════════════════════════ */
class StarField {
  constructor(canvas) {
    this.canvas = canvas;
    this.stars  = [];
    this.nebula = [];
    this._generate();
  }

  _generate() {
    const { width: W, height: H } = this.canvas;

    // Stars in three layers (parallax speeds)
    for (let i = 0; i < 200; i++) {
      this.stars.push({
        x: rand(0, W), y: rand(0, H),
        r: rand(0.4, 1.8),
        speed: rand(20, 60),
        alpha: rand(0.3, 1),
        twinkle: rand(0, Math.PI * 2),
        twinkleSpeed: rand(0.5, 2)
      });
    }

    // Nebula blobs
    for (let i = 0; i < 5; i++) {
      this.nebula.push({
        x: rand(0, W), y: rand(0, H),
        rx: rand(80, 200), ry: rand(50, 130),
        hue: rand(180, 280),
        alpha: rand(0.02, 0.06),
        speed: rand(5, 15)
      });
    }
  }

  update(dt) {
    const H = this.canvas.height;
    for (const s of this.stars) {
      s.y += s.speed * dt;
      s.twinkle += s.twinkleSpeed * dt;
      if (s.y > H + 2) {
        s.y = -2;
        s.x = rand(0, this.canvas.width);
      }
    }
    for (const n of this.nebula) {
      n.y += n.speed * dt;
      if (n.y - n.ry > H) n.y = -n.ry;
    }
  }

  draw(ctx) {
    const { width: W, height: H } = this.canvas;

    // Deep space background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0,   '#000814');
    bg.addColorStop(0.5, '#001120');
    bg.addColorStop(1,   '#000814');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Nebula blobs
    for (const n of this.nebula) {
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, Math.max(n.rx, n.ry));
      grad.addColorStop(0, `hsla(${n.hue},80%,60%,${n.alpha})`);
      grad.addColorStop(1, 'transparent');
      ctx.save();
      ctx.scale(1, n.ry / n.rx);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y * (n.rx / n.ry), n.rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Stars
    for (const s of this.stars) {
      const twinkleAlpha = s.alpha * (0.7 + 0.3 * Math.sin(s.twinkle));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,230,255,${twinkleAlpha})`;
      ctx.fill();
    }
  }

  resize() {
    this.stars  = [];
    this.nebula = [];
    this._generate();
  }
}

/* ══════════════════════════════════════════════════════
   SECTION 4 — PARTICLE SYSTEM
   ══════════════════════════════════════════════════════ */
class Particle {
  constructor(x, y, options = {}) {
    this.x    = x;
    this.y    = y;
    this.vx   = options.vx   ?? rand(-80, 80);
    this.vy   = options.vy   ?? rand(-120, 40);
    this.life = options.life ?? rand(0.4, 1.0);
    this.maxLife = this.life;
    this.r    = options.r    ?? rand(1.5, 4);
    this.color = options.color ?? '#ff6b00';
    this.gravity = options.gravity ?? 40;
    this.fade    = options.fade    ?? true;
    this.shrink  = options.shrink  ?? true;
    this.type    = options.type    ?? 'circle'; // 'circle' | 'spark' | 'ring'
    this.angle   = rand(0, Math.PI * 2);
    this.spin    = rand(-4, 4);

    // For ring particles
    this.ringR = options.ringR ?? 0;
    this.ringExpand = options.ringExpand ?? 80;
  }

  update(dt) {
    this.x    += this.vx * dt;
    this.y    += this.vy * dt;
    this.vy   += this.gravity * dt;
    this.life -= dt;
    this.angle += this.spin * dt;
    if (this.type === 'ring') this.ringR += this.ringExpand * dt;
  }

  get alpha() {
    const t = this.life / this.maxLife;
    return this.fade ? clamp(t, 0, 1) : 1;
  }

  get radius() {
    const t = this.life / this.maxLife;
    return this.shrink ? this.r * Math.sqrt(t) : this.r;
  }

  get alive() { return this.life > 0; }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;

    if (this.type === 'ring') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth   = 2 * (this.life / this.maxLife);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.ringR, 0, Math.PI * 2);
      ctx.stroke();

    } else if (this.type === 'spark') {
      const len = this.radius * 4;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.strokeStyle = this.color;
      ctx.lineWidth   = this.radius * 0.6;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.lineTo( len / 2, 0);
      ctx.stroke();

    } else {
      // Glowing circle
      const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 2);
      grd.addColorStop(0, this.color);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

/* ══════════════════════════════════════════════════════
   SECTION 5 — PARTICLE EMITTER PRESETS
   ══════════════════════════════════════════════════════ */
class Emitter {
  /**
   * Spawn explosion particles into a pool array
   */
  static explode(pool, x, y, count, color, big = false) {
    const multiplier = big ? 2 : 1;

    // Core burst
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(30, 200 * multiplier);
      pool.push(new Particle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rand(0.3, 0.8 * multiplier),
        r:    rand(2, big ? 6 : 4),
        color,
        gravity: 0,
        type: 'circle'
      }));
    }

    // Sparks
    for (let i = 0; i < count * 0.6; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(60, 300 * multiplier);
      pool.push(new Particle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rand(0.2, 0.5),
        r:    rand(1, 3),
        color: '#ffffff',
        gravity: 80,
        type: 'spark',
        angle
      }));
    }

    // Shockwave ring
    pool.push(new Particle(x, y, {
      vx: 0, vy: 0,
      life: 0.4,
      color,
      type: 'ring',
      ringExpand: big ? 200 : 120,
      gravity: 0
    }));

    // Secondary color ring
    if (big) {
      pool.push(new Particle(x, y, {
        vx: 0, vy: 0,
        life: 0.6,
        color: '#ffffff',
        type: 'ring',
        ringExpand: 80,
        gravity: 0
      }));
    }
  }

  static trail(pool, x, y, color) {
    pool.push(new Particle(x, y, {
      vx: rand(-10, 10),
      vy: rand(20, 60),
      life: rand(0.15, 0.35),
      r:    rand(1, 2.5),
      color,
      gravity: 0,
      type: 'circle'
    }));
  }

  static powerUpEffect(pool, x, y, color) {
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      pool.push(new Particle(x, y, {
        vx: Math.cos(angle) * 120,
        vy: Math.sin(angle) * 120,
        life: 0.8,
        r:    3,
        color,
        gravity: 0,
        type: 'spark',
        angle
      }));
    }
    pool.push(new Particle(x, y, {
      vx: 0, vy: 0, life: 0.5,
      color, type: 'ring', ringExpand: 160, gravity: 0
    }));
  }
}

/* ══════════════════════════════════════════════════════
   SECTION 6 — BULLET CLASS
   ══════════════════════════════════════════════════════ */
class Bullet {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} vx
   * @param {number} vy
   * @param {boolean} isPlayer
   * @param {string}  color
   * @param {number}  damage
   */
  constructor(x, y, vx, vy, isPlayer, color = '#00f5ff', damage = 10) {
    this.x        = x;
    this.y        = y;
    this.vx       = vx;
    this.vy       = vy;
    this.isPlayer = isPlayer;
    this.color    = color;
    this.damage   = damage;
    this.alive    = true;
    this.trail    = []; // store last few positions for trail effect
    this.w        = isPlayer ? 4 : 5;
    this.h        = isPlayer ? 18 : 10;
  }

  update(dt) {
    // Store trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  // Bounding box (axis-aligned) for collision
  get left()   { return this.x - this.w / 2; }
  get right()  { return this.x + this.w / 2; }
  get top()    { return this.y - this.h / 2; }
  get bottom() { return this.y + this.h / 2; }

  draw(ctx) {
    // Glow trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = i / this.trail.length;
      const p = this.trail[i];
      ctx.save();
      ctx.globalAlpha = t * 0.5;
      ctx.fillStyle   = this.color;
      const tw = this.w * t;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, tw / 2, this.h * t * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Core bullet
    ctx.save();
    ctx.shadowBlur  = 12;
    ctx.shadowColor = this.color;

    const grad = ctx.createLinearGradient(this.x, this.top, this.x, this.bottom);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, this.color);
    grad.addColorStop(1, 'transparent');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ══════════════════════════════════════════════════════
   SECTION 7 — POWER-UP CLASS
   ══════════════════════════════════════════════════════ */
class PowerUp {
  static TYPES = [
    { id: 'rapid',  label: 'RAPID FIRE',    color: '#ff6b00', icon: '⚡', duration: 8  },
    { id: 'shield', label: 'SHIELD',        color: '#00f5ff', icon: '🛡', duration: 10 },
    { id: 'double', label: 'DOUBLE SHOT',   color: '#d500f9', icon: '✦', duration: 8  },
  ];

  constructor(x, y) {
    this.x     = x;
    this.y     = y;
    this.vy    = 80;
    this.alive = true;
    this.r     = 18;
    this.angle = 0;
    this.pulse = 0;

    const def  = PowerUp.TYPES[randInt(0, PowerUp.TYPES.length - 1)];
    this.id       = def.id;
    this.label    = def.label;
    this.color    = def.color;
    this.icon     = def.icon;
    this.duration = def.duration;
  }

  update(dt) {
    this.y     += this.vy * dt;
    this.angle += 2 * dt;
    this.pulse += 4 * dt;
  }

  draw(ctx) {
    const pulse = 0.85 + 0.15 * Math.sin(this.pulse);
    const r     = this.r * pulse;

    ctx.save();

    // Outer ring
    ctx.shadowBlur  = 20;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Spinning dashes
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      const a = this.angle + (i / 6) * Math.PI * 2;
      const x1 = this.x + Math.cos(a) * (r + 6);
      const y1 = this.y + Math.sin(a) * (r + 6);
      const x2 = this.x + Math.cos(a) * (r + 12);
      const y2 = this.y + Math.sin(a) * (r + 12);
      ctx.strokeStyle = this.color;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Fill
    ctx.globalAlpha = 1;
    const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
    grd.addColorStop(0, this.color + 'cc');
    grd.addColorStop(1, this.color + '22');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Icon
    ctx.fillStyle   = '#fff';
    ctx.font        = `${r * 0.9}px serif`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur  = 0;
    ctx.fillText(this.icon, this.x, this.y);

    ctx.restore();
  }
}

/* ══════════════════════════════════════════════════════
   SECTION 8 — PLAYER CLASS
   ══════════════════════════════════════════════════════ */
class Player {
  constructor(canvas) {
    this.canvas = canvas;
    this.w      = 44;
    this.h      = 54;
    this.x      = canvas.width  / 2;
    // On mobile, leave room for the controls bar at the bottom (~120px)
    const isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    this.y      = isMobile ? canvas.height * 0.68 : canvas.height * 0.78;
    this.speed  = 320;
    this.health = 100;
    this.maxHealth = 100;
    this.alive  = true;

    // Shoot timing
    this.shootCooldown = 0;
    this.baseFireRate  = 0.22; // seconds between shots
    this.fireRate      = this.baseFireRate;

    // Power-ups active
    this.powers = {
      rapid:  0,
      shield: 0,
      double: 0,
    };

    // Visual state
    this.invincibleTimer = 0; // flash after hit
    this.shieldAlpha     = 0;
    this.engineFlicker   = 0;
    this.tiltX           = 0; // visual tilt when moving
  }

  applyPowerUp(type, duration) {
    this.powers[type] = duration;
    if (type === 'rapid')  this.fireRate = this.baseFireRate * 0.35;
    // Shield protection is handled by isShielded getter in takeDamage — no Infinity timer needed
  }

  get isShielded() { return this.powers.shield > 0; }
  get isRapid()    { return this.powers.rapid  > 0; }
  get isDouble()   { return this.powers.double > 0; }

  update(dt, input) {
    // Movement
    let dx = 0, dy = 0;
    if (input.left)  dx -= 1;
    if (input.right) dx += 1;
    if (input.up)    dy -= 1;
    if (input.down)  dy += 1;

    // Normalize diagonal
    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

    this.x = clamp(this.x + dx * this.speed * dt, this.w / 2, this.canvas.width  - this.w / 2);
    const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    const bottomMargin = isTouchDevice ? 140 : this.h / 2;
    this.y = clamp(this.y + dy * this.speed * dt, this.h / 2, this.canvas.height - bottomMargin);

    // Tilt visually
    this.tiltX = lerp(this.tiltX, dx * 0.3, 8 * dt);

    // Timers
    this.shootCooldown    = Math.max(0, this.shootCooldown - dt);
    // Only count down invincibleTimer when NOT shielded (shield manages it separately)
    if (!this.isShielded) {
      this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    }
    this.engineFlicker   += dt * 20;

    // Power-up countdowns
    for (const key of Object.keys(this.powers)) {
      if (this.powers[key] > 0 && this.powers[key] !== Infinity) {
        this.powers[key] = Math.max(0, this.powers[key] - dt);
        if (this.powers[key] === 0 && key === 'rapid') {
          this.fireRate = this.baseFireRate;
        }
        if (this.powers[key] === 0 && key === 'shield') {
          // Shield expired — clear invincibility so hits register immediately
          this.invincibleTimer = 0;
        }
      }
    }

    // Shield alpha animation
    const targetAlpha = this.isShielded ? 0.7 : 0;
    this.shieldAlpha  = lerp(this.shieldAlpha, targetAlpha, 5 * dt);
  }

  takeDamage(amount) {
    if (this.invincibleTimer > 0) return false; // invincible
    if (this.isShielded) {
      // Drain shield
      this.powers.shield = 0;
      this.invincibleTimer = 1.5;
      return false;
    }
    this.health -= amount;
    this.invincibleTimer = 1.2;
    if (this.health <= 0) {
      this.health = 0;
      this.alive  = false;
    }
    return true; // took damage
  }

  canShoot() {
    return this.alive && this.shootCooldown <= 0;
  }

  shoot() {
    this.shootCooldown = this.fireRate;
  }

  // AABB for collision
  get left()   { return this.x - this.w * 0.3; }
  get right()  { return this.x + this.w * 0.3; }
  get top()    { return this.y - this.h * 0.4; }
  get bottom() { return this.y + this.h * 0.4; }

  draw(ctx) {
    if (!this.alive) return;

    // Invincibility flash
    if (this.invincibleTimer > 0 && !this.isShielded) {
      if (Math.floor(this.invincibleTimer * 10) % 2 === 0) return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.transform(1, 0, this.tiltX, 1, 0, 0); // skew for tilt

    // ── Engine exhaust ──────────────────────────────
    const flicker = 0.8 + 0.2 * Math.sin(this.engineFlicker);
    const exGrad  = ctx.createLinearGradient(0, 10, 0, 38);
    exGrad.addColorStop(0,   `rgba(0,200,255,${0.9 * flicker})`);
    exGrad.addColorStop(0.4, `rgba(0,100,255,${0.6 * flicker})`);
    exGrad.addColorStop(1,    'transparent');

    // Left engine
    ctx.fillStyle = exGrad;
    ctx.beginPath();
    ctx.moveTo(-14, 14);
    ctx.lineTo(-8,  14);
    ctx.lineTo(-10, 38 * flicker);
    ctx.closePath();
    ctx.fill();

    // Right engine
    ctx.beginPath();
    ctx.moveTo(14,  14);
    ctx.lineTo(8,   14);
    ctx.lineTo(10,  38 * flicker);
    ctx.closePath();
    ctx.fill();

    // ── Jet body ────────────────────────────────────
    const bodyGrad = ctx.createLinearGradient(-20, 0, 20, 0);
    bodyGrad.addColorStop(0,   '#1a4a7a');
    bodyGrad.addColorStop(0.5, '#2a7acc');
    bodyGrad.addColorStop(1,   '#1a4a7a');

    ctx.fillStyle   = bodyGrad;
    ctx.shadowBlur  = 10;
    ctx.shadowColor = '#00aaff';

    // Main fuselage
    ctx.beginPath();
    ctx.moveTo(0, -26);       // nose
    ctx.lineTo(8, -8);
    ctx.lineTo(12,  6);
    ctx.lineTo(10, 16);
    ctx.lineTo(-10, 16);
    ctx.lineTo(-12,  6);
    ctx.lineTo(-8, -8);
    ctx.closePath();
    ctx.fill();

    // Left wing
    ctx.beginPath();
    ctx.moveTo(-12,  4);
    ctx.lineTo(-22, 16);
    ctx.lineTo(-20, 18);
    ctx.lineTo(-10, 16);
    ctx.closePath();
    const lwGrad = ctx.createLinearGradient(-22, 0, 0, 0);
    lwGrad.addColorStop(0, '#0a2a4a');
    lwGrad.addColorStop(1, '#2060a0');
    ctx.fillStyle = lwGrad;
    ctx.fill();

    // Right wing
    ctx.beginPath();
    ctx.moveTo(12,  4);
    ctx.lineTo(22, 16);
    ctx.lineTo(20, 18);
    ctx.lineTo(10, 16);
    ctx.closePath();
    const rwGrad = ctx.createLinearGradient(0, 0, 22, 0);
    rwGrad.addColorStop(0, '#2060a0');
    rwGrad.addColorStop(1, '#0a2a4a');
    ctx.fillStyle = rwGrad;
    ctx.fill();

    // Canopy
    const cpGrad = ctx.createRadialGradient(-3, -14, 1, 0, -10, 9);
    cpGrad.addColorStop(0, '#aaddff');
    cpGrad.addColorStop(1, '#003366');
    ctx.fillStyle = cpGrad;
    ctx.beginPath();
    ctx.ellipse(0, -10, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Engine nacelles
    ctx.fillStyle = '#102040';
    ctx.fillRect(-14, 8, 6, 10);
    ctx.fillRect(8,   8, 6, 10);

    // Tail fins
    ctx.fillStyle = '#1a4a7a';
    ctx.beginPath();
    ctx.moveTo(-8, 16);
    ctx.lineTo(-14, 22);
    ctx.lineTo(-8, 22);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(8,  16);
    ctx.lineTo(14, 22);
    ctx.lineTo(8,  22);
    ctx.closePath();
    ctx.fill();

    // Hull highlights
    ctx.strokeStyle = 'rgba(100,200,255,0.4)';
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 0;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(6, -6);
    ctx.lineTo(0,  4);
    ctx.lineTo(-6, -6);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();

    // ── Shield bubble ───────────────────────────────
    if (this.shieldAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.shieldAlpha;

      const sg  = ctx.createRadialGradient(this.x, this.y, 10, this.x, this.y, 40);
      sg.addColorStop(0,   'rgba(0,245,255,0.1)');
      sg.addColorStop(0.7, 'rgba(0,245,255,0.05)');
      sg.addColorStop(1,   'rgba(0,245,255,0.3)');

      ctx.fillStyle   = sg;
      ctx.strokeStyle = 'rgba(0,245,255,0.8)';
      ctx.lineWidth   = 1.5;
      ctx.shadowBlur  = 20;
      ctx.shadowColor = '#00f5ff';

      ctx.beginPath();
      ctx.ellipse(this.x, this.y - 4, 34, 38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

/* ══════════════════════════════════════════════════════
   SECTION 9 — ENEMY CLASS
   ══════════════════════════════════════════════════════ */
class Enemy {
  static TYPES = {
    scout:   { hp: 20,  speed: 160, score: 50,  scale: 0.7,  color: '#ff4444', shootChance: 0,    fireRate: 0    },
    fighter: { hp: 40,  speed: 110, score: 100, scale: 1.0,  color: '#ff8800', shootChance: 0.3,  fireRate: 2.2  },
    tank:    { hp: 120, speed: 55,  score: 200, scale: 1.5,  color: '#aa00ff', shootChance: 0.4,  fireRate: 1.8  },
    drone:   { hp: 15,  speed: 140, score: 40,  scale: 0.65, color: '#ff1144', shootChance: 0,    fireRate: 0    },
    bomber:  { hp: 80,  speed: 70,  score: 180, scale: 1.2,  color: '#ff6600', shootChance: 0.7,  fireRate: 1.4  },
    elite:   { hp: 300, speed: 90,  score: 500, scale: 1.8,  color: '#ff00aa', shootChance: 0.9,  fireRate: 1.0  },
  };

  constructor(x, y, typeName, canvas) {
    const def    = Enemy.TYPES[typeName] || Enemy.TYPES.fighter;
    this.canvas  = canvas;
    this.typeName = typeName;
    this.x       = x;
    this.y       = y;
    this.maxHp   = def.hp;
    this.hp      = def.hp;
    this.speed   = def.speed;
    this.score   = def.score;
    this.scale   = def.scale;
    this.color   = def.color;
    this.shootChance = def.shootChance;
    this.fireRate    = def.fireRate;
    this.alive       = true;
    this.w = 38 * this.scale;
    this.h = 38 * this.scale;
    this.angle       = 0;
    this.zigzagDir   = Math.random() < 0.5 ? 1 : -1;
    this.zigzagTimer = 0;
    this.entryDone   = false;
    this.entryY      = y;
    this.shootTimer  = rand(0.5, Math.max(def.fireRate, 0.5));
    this.flashTimer  = 0;
    this.rotAngle    = Math.PI;
    this.enginePhase = rand(0, Math.PI * 2);
    this.wobble      = 0;
  }

  update(dt, playerX, playerY) {
    this.flashTimer   = Math.max(0, this.flashTimer - dt);
    this.enginePhase += dt * 15;
    this.wobble      += dt * 3;

    if (!this.entryDone) {
      const target = this.entryY + 140;
      this.y = Math.min(target, this.y + 200 * dt);
      if (this.y >= target) this.entryDone = true;
      return;
    }

    switch (this.typeName) {
      case 'scout':
        this.y += this.speed * dt;
        break;
      case 'fighter': {
        const dx = playerX - this.x;
        this.x  += Math.sign(dx) * Math.min(Math.abs(dx), this.speed * 0.6) * dt;
        this.y  += this.speed * dt;
        break;
      }
      case 'tank':
        this.y += this.speed * dt;
        this.x += Math.sin(this.wobble) * 40 * dt;
        break;
      case 'drone':
        this.zigzagTimer += dt;
        if (this.zigzagTimer > rand(0.3, 0.7)) {
          this.zigzagDir   = -this.zigzagDir;
          this.zigzagTimer = 0;
        }
        this.x += this.zigzagDir * this.speed * dt;
        this.y += this.speed * 0.5 * dt;
        if (this.x < 20 || this.x > this.canvas.width - 20) this.zigzagDir *= -1;
        break;
      case 'bomber':
        if (this.y < this.canvas.height * 0.25) this.y += this.speed * dt;
        else this.x += Math.sin(this.wobble * 0.5) * 60 * dt;
        break;
      case 'elite': {
        const ex = playerX - this.x;
        this.x  += Math.sign(ex) * Math.min(Math.abs(ex), this.speed * 0.8) * dt;
        if (this.y < this.canvas.height * 0.22) this.y += this.speed * dt;
        else this.y += Math.sin(this.wobble * 0.4) * 20 * dt;
        break;
      }
    }

    this.x = clamp(this.x, this.w / 2, this.canvas.width - this.w / 2);

    if (this.shootChance > 0) this.shootTimer -= dt;
  }

  canShoot() {
    if (this.shootChance === 0) return false;
    if (this.shootTimer <= 0) {
      this.shootTimer = this.fireRate + rand(-0.3, 0.3);
      return Math.random() < this.shootChance;
    }
    return false;
  }

  takeDamage(amount) {
    this.hp        -= amount;
    this.flashTimer = 0.1;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }

  get healthPct() { return this.hp / this.maxHp; }
  get left()   { return this.x - this.w * 0.35; }
  get right()  { return this.x + this.w * 0.35; }
  get top()    { return this.y - this.h * 0.35; }
  get bottom() { return this.y + this.h * 0.35; }

  draw(ctx) {
    const s  = this.scale;
    const ef = 0.8 + 0.2 * Math.sin(this.enginePhase);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotAngle);
    if (this.flashTimer > 0) ctx.filter = 'brightness(4)';
    ctx.shadowBlur  = 15;
    ctx.shadowColor = this.color;

    switch (this.typeName) {
      case 'scout':
      case 'fighter': this._drawBasic(ctx, s, ef); break;
      case 'tank':    this._drawTank(ctx, s, ef);  break;
      case 'bomber':  this._drawBomber(ctx, s, ef);break;
      case 'drone':   this._drawDrone(ctx, s, ef); break;
      case 'elite':   this._drawElite(ctx, s, ef); break;
    }
    ctx.restore();

    if (this.maxHp > 30 && this.hp < this.maxHp) this._drawHealthBar(ctx);
  }

  _drawBasic(ctx, s, ef) {
    const bg = ctx.createLinearGradient(-12*s,0,12*s,0);
    bg.addColorStop(0,'#330011'); bg.addColorStop(0.5,this.color); bg.addColorStop(1,'#330011');
    ctx.fillStyle='#220008';
    ctx.beginPath(); ctx.moveTo(-10*s,4*s); ctx.lineTo(-22*s,16*s); ctx.lineTo(-14*s,18*s); ctx.lineTo(-8*s,8*s); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10*s,4*s);  ctx.lineTo(22*s,16*s);  ctx.lineTo(14*s,18*s);  ctx.lineTo(8*s,8*s);  ctx.closePath(); ctx.fill();
    ctx.fillStyle=bg;
    ctx.beginPath(); ctx.moveTo(0,-22*s); ctx.lineTo(8*s,-6*s); ctx.lineTo(10*s,10*s); ctx.lineTo(-10*s,10*s); ctx.lineTo(-8*s,-6*s); ctx.closePath(); ctx.fill();
    const ex=ctx.createLinearGradient(0,-22*s,0,-34*s*ef);
    ex.addColorStop(0,this.color+'cc'); ex.addColorStop(1,'transparent');
    ctx.fillStyle=ex;
    ctx.beginPath(); ctx.moveTo(-5*s,-22*s); ctx.lineTo(5*s,-22*s); ctx.lineTo(0,-34*s*ef); ctx.closePath(); ctx.fill();
  }

  _drawTank(ctx, s, ef) {
    const bg=ctx.createLinearGradient(-18*s,0,18*s,0);
    bg.addColorStop(0,'#1a004a'); bg.addColorStop(0.5,this.color); bg.addColorStop(1,'#1a004a');
    ctx.fillStyle='#110033';
    ctx.beginPath(); ctx.moveTo(-22*s,-6*s); ctx.lineTo(22*s,-6*s); ctx.lineTo(26*s,14*s); ctx.lineTo(-26*s,14*s); ctx.closePath(); ctx.fill();
    ctx.fillStyle=bg;
    ctx.beginPath(); ctx.moveTo(0,-20*s); ctx.lineTo(14*s,-4*s); ctx.lineTo(14*s,12*s); ctx.lineTo(-14*s,12*s); ctx.lineTo(-14*s,-4*s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=this.color+'88'; ctx.lineWidth=1.5; ctx.strokeRect(-12*s,-2*s,24*s,12*s);
    for(const ex of[-8,8]){
      const eg=ctx.createLinearGradient(ex*s,-20*s,ex*s,-30*s*ef);
      eg.addColorStop(0,this.color+'cc'); eg.addColorStop(1,'transparent');
      ctx.fillStyle=eg;
      ctx.beginPath(); ctx.moveTo((ex-3)*s,-20*s); ctx.lineTo((ex+3)*s,-20*s); ctx.lineTo(ex*s,-30*s*ef); ctx.closePath(); ctx.fill();
    }
  }

  _drawBomber(ctx, s, ef) {
    const bg=ctx.createLinearGradient(-14*s,0,14*s,0);
    bg.addColorStop(0,'#3a1000'); bg.addColorStop(0.5,this.color); bg.addColorStop(1,'#3a1000');
    ctx.fillStyle='#220800';
    ctx.beginPath(); ctx.moveTo(-8*s,0); ctx.lineTo(-28*s,12*s); ctx.lineTo(-22*s,16*s); ctx.lineTo(-6*s,10*s); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8*s,0);  ctx.lineTo(28*s,12*s);  ctx.lineTo(22*s,16*s);  ctx.lineTo(6*s,10*s);  ctx.closePath(); ctx.fill();
    ctx.fillStyle=bg;
    ctx.beginPath(); ctx.moveTo(0,-24*s); ctx.lineTo(10*s,-4*s); ctx.lineTo(12*s,12*s); ctx.lineTo(-12*s,12*s); ctx.lineTo(-10*s,-4*s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=this.color; ctx.lineWidth=1; ctx.strokeRect(-4*s,2*s,8*s,8*s);
    const eg=ctx.createLinearGradient(0,-24*s,0,-36*s*ef);
    eg.addColorStop(0,this.color+'cc'); eg.addColorStop(1,'transparent');
    ctx.fillStyle=eg;
    ctx.beginPath(); ctx.moveTo(-6*s,-24*s); ctx.lineTo(6*s,-24*s); ctx.lineTo(0,-36*s*ef); ctx.closePath(); ctx.fill();
  }

  _drawDrone(ctx, s, ef) {
    ctx.fillStyle=this.color;
    ctx.beginPath();
    for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2-Math.PI/6,r=14*s;i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#110000';
    ctx.beginPath();
    for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2-Math.PI/6,r=8*s;i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
    ctx.closePath(); ctx.fill();
    const cg=ctx.createRadialGradient(0,0,0,0,0,5*s);
    cg.addColorStop(0,'#ffffff'); cg.addColorStop(1,this.color);
    ctx.fillStyle=cg;
    ctx.beginPath(); ctx.arc(0,0,5*s,0,Math.PI*2); ctx.fill();
  }

  _drawElite(ctx, s, ef) {
    const bg=ctx.createRadialGradient(0,0,4,0,0,24*s);
    bg.addColorStop(0,'#ffffff'); bg.addColorStop(0.2,this.color); bg.addColorStop(1,'#440033');
    ctx.fillStyle='#220033';
    ctx.beginPath(); ctx.moveTo(-16*s,0); ctx.lineTo(-36*s,10*s); ctx.lineTo(-32*s,16*s); ctx.lineTo(-12*s,10*s); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16*s,0);  ctx.lineTo(36*s,10*s);  ctx.lineTo(32*s,16*s);  ctx.lineTo(12*s,10*s);  ctx.closePath(); ctx.fill();
    ctx.fillStyle=bg;
    ctx.beginPath(); ctx.moveTo(0,-28*s); ctx.lineTo(16*s,0); ctx.lineTo(14*s,16*s); ctx.lineTo(-14*s,16*s); ctx.lineTo(-16*s,0); ctx.closePath(); ctx.fill();
    const core=ctx.createRadialGradient(0,4*s,0,0,4*s,10*s);
    core.addColorStop(0,'#ffffff'); core.addColorStop(0.5,this.color); core.addColorStop(1,'transparent');
    ctx.fillStyle=core;
    ctx.beginPath(); ctx.arc(0,4*s,10*s,0,Math.PI*2); ctx.fill();
    for(const ex of[-10,0,10]){
      const eg=ctx.createLinearGradient(ex*s,-28*s,ex*s,-42*s*ef);
      eg.addColorStop(0,this.color+'ee'); eg.addColorStop(1,'transparent');
      ctx.fillStyle=eg;
      ctx.beginPath(); ctx.moveTo((ex-3)*s,-28*s); ctx.lineTo((ex+3)*s,-28*s); ctx.lineTo(ex*s,-42*s*ef); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle=this.color; ctx.lineWidth=1.5; ctx.globalAlpha=0.5+0.5*Math.sin(this.enginePhase*0.5);
    ctx.beginPath(); ctx.moveTo(0,-28*s); ctx.lineTo(16*s,0); ctx.lineTo(14*s,16*s); ctx.lineTo(-14*s,16*s); ctx.lineTo(-16*s,0); ctx.closePath(); ctx.stroke();
    ctx.globalAlpha=1;
  }

  _drawHealthBar(ctx) {
    const bw=this.w*1.2, bh=4, bx=this.x-bw/2, by=this.y-this.h/2-10;
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(bx,by,bw,bh);
    const pct=this.healthPct;
    ctx.fillStyle=pct>0.5?'#00e676':pct>0.25?'#ffaa00':'#ff1744';
    ctx.fillRect(bx,by,bw*pct,bh);
    ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=0.5; ctx.strokeRect(bx,by,bw,bh);
  }
}

/* ══════════════════════════════════════════════════════
   SECTION 10 — WAVE MANAGER
   ══════════════════════════════════════════════════════ */
class WaveManager {
  constructor() {
    this.wave             = 1;
    this.spawnTimer       = 0;
    this.spawnInterval    = 2.2;
    this.minInterval      = 0.5;
    this.waveEnemiesLeft  = 0;
    this.waveComplete     = false;
    this.betweenWaves     = false;
    this.betweenTimer     = 0;
    this.betweenDuration  = 3;
    this.totalKills       = 0;
    this._buildWave();
  }

  _buildWave() {
    const w = this.wave;
    this.waveEnemiesLeft = 5 + w * 3;
    this.spawnInterval   = Math.max(this.minInterval, 2.2 - w * 0.12);
    this.spawnTimer      = 0;
    this.waveComplete    = false;
  }

  _pickEnemyType() {
    const w = this.wave;
    if (w === 1) return 'scout';
    if (w === 2) return Math.random() < 0.6 ? 'scout' : 'fighter';

    const types = [
      { type: 'scout',   weight: Math.max(0.05, 0.4 - w * 0.02) },
      { type: 'drone',   weight: w >= 3 ? 0.2 : 0 },
      { type: 'fighter', weight: 0.3 },
      { type: 'tank',    weight: w >= 4 ? 0.15 : 0 },
      { type: 'bomber',  weight: w >= 5 ? 0.15 : 0 },
      { type: 'elite',   weight: w >= 8 ? 0.1  : 0 },
    ];
    const total = types.reduce((s,t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of types) { r -= t.weight; if (r <= 0) return t.type; }
    return 'fighter';
  }

  update(dt) {
    if (this.betweenWaves) {
      this.betweenTimer -= dt;
      if (this.betweenTimer <= 0) {
        this.betweenWaves = false;
        this.wave++;
        this._buildWave();
        return { newWave: true, wave: this.wave };
      }
      return null;
    }
    if (this.waveComplete) return null;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.waveEnemiesLeft > 0) {
      this.spawnTimer = this.spawnInterval;
      this.waveEnemiesLeft--;
      return { spawn: true, type: this._pickEnemyType() };
    }
    return null;
  }

  onEnemyKilled() { this.totalKills++; }

  startNextWave() {
    this.betweenWaves  = true;
    this.betweenTimer  = this.betweenDuration;
    this.waveComplete  = true;
  }
}

/* ══════════════════════════════════════════════════════
   SECTION 11 — MAIN GAME CLASS
   ══════════════════════════════════════════════════════ */
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this.audio  = new AudioEngine();

    this.state     = 'menu';
    this.score     = 0;
    this.kills     = 0;
    this.bestScore = parseInt(localStorage.getItem('apexBestScore') || '0');
    this.bestWave  = parseInt(localStorage.getItem('apexBestWave')  || '0');

    this.player    = null;
    this.enemies   = [];
    this.bullets   = [];
    this.particles = [];
    this.powerUps  = [];
    this._scorePops = [];

    this.starField   = null;
    this.waveManager = null;

    this.input = { up:false,down:false,left:false,right:false,shoot:false };
    this.touchInput = { up:false,down:false,left:false,right:false,shoot:false };

    this.lastTime     = 0;
    this.raf          = null;
    this.lastPauseKey = false;
    this.waveAnnounceEl = null;
    this.powerUpDropChance = 0.12;

    this.$startMenu        = document.getElementById('startMenu');
    this.$gameOver         = document.getElementById('gameOverScreen');
    this.$pause            = document.getElementById('pauseScreen');
    this.$hud              = document.getElementById('hud');
    this.$powerupHud       = document.getElementById('powerupHud');
    this.$mobileControls   = document.getElementById('mobileControls');
    this.$nicknameModal    = document.getElementById('nicknameModal');
    this.$leaderboardScreen= document.getElementById('leaderboardScreen');

    // Player nickname — persisted across sessions
    this.nickname = localStorage.getItem('apexNickname') || '';

    this._resize();
    this._bindEvents();
    this._updateMenuStats();
    this._showMenu();

    // Keep drawing menu background
    this.starField = new StarField(this.canvas);
    this.raf = requestAnimationFrame(ts => this._menuLoop(ts));
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.starField) this.starField.resize();
  }

  _menuLoop(ts) {
    if (this.state !== 'menu') return;
    this.raf = requestAnimationFrame(t => this._menuLoop(t));
    const dt = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    this.starField.update(dt);
    this.starField.draw(this.ctx);
  }

  // Show nickname modal before actually starting (skip if nickname already set)
  _promptAndStart() {
    this.audio.resume();
    if (this.nickname && this.nickname.length >= 2) {
      // Already have a nickname — start directly
      this._startGame();
      return;
    }
    // Show nickname modal
    this.$startMenu.classList.add('hidden');
    this.$nicknameModal.classList.remove('hidden');
    setTimeout(() => document.getElementById('nicknameInput').focus(), 100);
  }

  _startGame() {
    this.audio.resume();
    this.score     = 0;
    this.kills     = 0;
    this.enemies   = [];
    this.bullets   = [];
    this.particles = [];
    this.powerUps  = [];
    this._scorePops = [];

    this.player      = new Player(this.canvas);
    this.starField   = new StarField(this.canvas);
    this.waveManager = new WaveManager();

    this.$startMenu.classList.add('hidden');
    this.$gameOver.classList.add('hidden');
    this.$pause.classList.add('hidden');
    this.$hud.classList.remove('hidden');
    this.$powerupHud.classList.remove('hidden');

    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
      this.$mobileControls.classList.remove('hidden');
    }

    this.state    = 'playing';
    this.lastTime = performance.now();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(ts => this._loop(ts));
    this._announceWave(1);
  }

  _showMenu() {
    this.state = 'menu';
    this.$startMenu.classList.remove('hidden');
    this.$gameOver.classList.add('hidden');
    this.$pause.classList.add('hidden');
    this.$hud.classList.add('hidden');
    this.$powerupHud.classList.add('hidden');
    this.$mobileControls.classList.add('hidden');
    this.$nicknameModal.classList.add('hidden');
    this.$leaderboardScreen.classList.add('hidden');
    // Refresh saved nickname in input
    const inp = document.getElementById('nicknameInput');
    if (inp && this.nickname) inp.value = this.nickname;
  }

  _gameOver() {
    this.state = 'gameover';
    this.audio.gameOver();
    if (this.player) Emitter.explode(this.particles, this.player.x, this.player.y, 60, '#00aaff', true);

    const wave = this.waveManager?.wave ?? 1;
    if (this.score > this.bestScore) { this.bestScore = this.score; localStorage.setItem('apexBestScore', this.bestScore); }
    if (wave  > this.bestWave)       { this.bestWave  = wave;       localStorage.setItem('apexBestWave',  this.bestWave);  }

    document.getElementById('finalScore').textContent = this.score.toLocaleString();
    document.getElementById('finalWave').textContent  = wave;
    document.getElementById('finalKills').textContent = this.kills;
    document.getElementById('finalBest').textContent  = this.bestScore.toLocaleString();

    setTimeout(async () => {
      this.$gameOver.classList.remove('hidden');
      this.$hud.classList.add('hidden');
      this.$powerupHud.classList.add('hidden');
      this.$mobileControls.classList.add('hidden');

      // Submit score to leaderboard and render results
      await this._submitAndShowLeaderboard(wave);
    }, 1400);
  }

  async _submitAndShowLeaderboard(wave) {
    const listEl      = document.getElementById('goLeaderboardList');
    const rankBadgeEl = document.getElementById('yourRankBadge');
    const db          = window.leaderboardDB;

    // ── Offline mode ──────────────────────────────────────────
    if (!db || !db.isReady) {
      listEl.innerHTML = `
        <div class="lb-offline-notice">
          ⚡ Offline mode — configure Supabase in db.js for global rankings
        </div>`;
      return;
    }

    // ── Submitting spinner ────────────────────────────────────
    listEl.innerHTML = `<div class="lb-submitting"><div class="spinner"></div>SUBMITTING SCORE…</div>`;
    rankBadgeEl.textContent = '';

    // Submit
    const result = await db.submitScore({
      nickname: this.nickname || 'PILOT',
      score:    this.score,
      wave,
      kills:    this.kills,
    });

    if (result) {
      rankBadgeEl.textContent = `YOUR RANK: #${result.rank}`;
    }

    // Fetch top scores and render
    const scores = await db.getTopScores(15);
    this._renderLeaderboardRows(listEl, scores, this.score);
  }

  _renderLeaderboardRows(container, scores, highlightScore = null) {
    if (!scores || scores.length === 0) {
      container.innerHTML = '<div class="lb-empty">No scores yet — be the first!</div>';
      return;
    }

    const medals = ['gold', 'silver', 'bronze'];
    const rows = scores.map((row, i) => {
      const rank      = i + 1;
      const rankClass = medals[i] ?? '';
      const isYou     = highlightScore !== null && row.score === highlightScore && i === scores.findIndex(s => s.score === highlightScore);
      const date      = LeaderboardDB.formatDate(row.created_at);
      return `
        <div class="lb-row${isYou ? ' lb-you' : ''}">
          <div class="lb-rank ${rankClass}">${rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</div>
          <div class="lb-name">${_escapeHtml(row.nickname)}</div>
          <div class="lb-score">${row.score.toLocaleString()}</div>
          <div class="lb-wave">W${row.wave}</div>
          <div class="lb-date">${date}</div>
        </div>`;
    }).join('');

    container.innerHTML = rows;
  }

  _updateMenuStats() {
    document.getElementById('bestScore').textContent = this.bestScore.toLocaleString();
    document.getElementById('bestWave').textContent  = this.bestWave;
  }

  _announceWave(waveNum) {
    if (this.waveAnnounceEl) this.waveAnnounceEl.remove();
    this.audio.waveStart();
    const el = document.createElement('div');
    el.id = 'waveAnnounce';
    el.innerHTML = `
      <div class="wave-announce-label">INCOMING</div>
      <div class="wave-announce-number">${waveNum}</div>
      <div class="wave-announce-sub">WAVE ${waveNum > 1 ? '— THREAT ESCALATING' : '— ENGAGE'}</div>
    `;
    document.body.appendChild(el);
    this.waveAnnounceEl = el;
    setTimeout(() => {
      if (el.parentNode) {
        el.classList.add('out');
        setTimeout(() => { if (el.parentNode) el.remove(); }, 600);
      }
    }, 2200);
  }

  _bindEvents() {
    const keyMap = {
      ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down',
      ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right', Space:'shoot'
    };
    window.addEventListener('keydown', e => {
      if (keyMap[e.code]) { this.input[keyMap[e.code]] = true; if (e.code==='Space') e.preventDefault(); }
      if ((e.code==='KeyP'||e.code==='Escape') && !this.lastPauseKey) { this._togglePause(); this.lastPauseKey=true; }
    });
    window.addEventListener('keyup', e => {
      if (keyMap[e.code]) this.input[keyMap[e.code]] = false;
      if (e.code==='KeyP'||e.code==='Escape') this.lastPauseKey=false;
    });
    window.addEventListener('resize', () => this._resize());

    document.getElementById('startBtn').addEventListener('click',   () => this._promptAndStart());
    document.getElementById('restartBtn').addEventListener('click', () => { this.audio.resume(); this._startGame(); });
    document.getElementById('menuBtn').addEventListener('click',    () => { this._showMenu(); this._updateMenuStats(); if(this.raf)cancelAnimationFrame(this.raf); this.raf=requestAnimationFrame(ts=>this._menuLoop(ts)); });
    document.getElementById('resumeBtn').addEventListener('click',  () => this._togglePause());
    this.$pause.addEventListener('click', e => { if(e.target===this.$pause) this._togglePause(); });

    // Mobile D-pad — include touchcancel so releasing quickly never sticks
    document.querySelectorAll('.dpad-btn').forEach(btn => {
      const dir = btn.dataset.dir;
      const press   = e => { e.preventDefault(); this.touchInput[dir]=true;  btn.classList.add('pressed');    };
      const release = e => { e.preventDefault(); this.touchInput[dir]=false; btn.classList.remove('pressed'); };
      btn.addEventListener('touchstart',  press,   { passive:false });
      btn.addEventListener('touchend',    release, { passive:false });
      btn.addEventListener('touchcancel', release, { passive:false });
    });

    const fireBtn = document.getElementById('fireBtn');
    const fireOn  = e => { e.preventDefault(); this.touchInput.shoot=true;  };
    const fireOff = e => { e.preventDefault(); this.touchInput.shoot=false; };
    fireBtn.addEventListener('touchstart',  fireOn,  { passive:false });
    fireBtn.addEventListener('touchend',    fireOff, { passive:false });
    fireBtn.addEventListener('touchcancel', fireOff, { passive:false });
    fireBtn.addEventListener('mousedown',  () => this.touchInput.shoot=true);
    fireBtn.addEventListener('mouseup',    () => this.touchInput.shoot=false);
    fireBtn.addEventListener('mouseleave', () => this.touchInput.shoot=false);

    // Reset all inputs when app loses focus (tab switch, incoming call, etc.)
    document.addEventListener('visibilitychange', () => { if (document.hidden) this._resetTouchInput(); });
    window.addEventListener('blur', () => this._resetTouchInput());

    document.getElementById('pauseMobileBtn').addEventListener('click', () => this._togglePause());
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    // ── Nickname modal ──────────────────────────────────────────
    const nickInput   = document.getElementById('nicknameInput');
    const nickError   = document.getElementById('nicknameError');
    const nickConfirm = document.getElementById('nicknameConfirmBtn');
    const nickCancel  = document.getElementById('nicknameCancelBtn');

    // Pre-fill saved nickname
    if (this.nickname) nickInput.value = this.nickname;

    const confirmNickname = () => {
      const val = nickInput.value.trim().toUpperCase();
      if (val.length < 2 || val.length > 16) {
        nickError.classList.remove('hidden');
        nickInput.focus();
        return;
      }
      nickError.classList.add('hidden');
      this.nickname = val;
      localStorage.setItem('apexNickname', val);
      this.$nicknameModal.classList.add('hidden');
      this._startGame();
    };

    nickConfirm.addEventListener('click', confirmNickname);
    nickInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') confirmNickname();
    });
    nickCancel.addEventListener('click', () => {
      this.$nicknameModal.classList.add('hidden');
      this.$startMenu.classList.remove('hidden');
    });

    // ── Full Leaderboard screen ─────────────────────────────────
    const openLb = () => this._openLeaderboard();
    document.getElementById('menuLeaderboardBtn').addEventListener('click', openLb);
    document.getElementById('closeLbBtn').addEventListener('click', () => {
      this.$leaderboardScreen.classList.add('hidden');
      this.$startMenu.classList.remove('hidden');
    });

    // Tab switching
    document.querySelectorAll('.lb-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._loadFullLeaderboard(tab.dataset.tab);
      });
    });
  }

  async _openLeaderboard() {
    this.$startMenu.classList.add('hidden');
    this.$leaderboardScreen.classList.remove('hidden');
    // Reset to "all" tab
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.lb-tab[data-tab="all"]').classList.add('active');
    await this._loadFullLeaderboard('all');
  }

  async _loadFullLeaderboard(tab = 'all') {
    const listEl = document.getElementById('fullLeaderboardList');
    const db     = window.leaderboardDB;

    if (!db || !db.isReady) {
      listEl.innerHTML = `
        <div class="lb-offline-notice" style="margin:20px">
          ⚡ Configure Supabase in db.js to enable global rankings
        </div>`;
      return;
    }

    listEl.innerHTML = '<div class="lb-loading">Loading…</div>';

    const scores = tab === 'today'
      ? await db.getTodayScores(50)
      : await db.getTopScores(50);

    // Column headers
    const header = `
      <div class="lb-col-header">
        <span>#</span>
        <span>PILOT</span>
        <span style="text-align:right">SCORE</span>
        <span style="text-align:right">WAVE</span>
        <span style="text-align:right">DATE</span>
      </div>`;

    listEl.innerHTML = header;

    const rowsEl = document.createElement('div');
    this._renderLeaderboardRows(rowsEl, scores, null);
    listEl.appendChild(rowsEl);
  }

  // Reset all touch/keyboard input — called on blur or visibility change
  _resetTouchInput() {
    this.touchInput = { up:false, down:false, left:false, right:false, shoot:false };
    this.input      = { up:false, down:false, left:false, right:false, shoot:false };
    // Also clear any stuck dpad button visuals
    document.querySelectorAll('.dpad-btn').forEach(b => b.classList.remove('pressed'));
  }

  _togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.$pause.classList.remove('hidden');
    } else if (this.state === 'paused') {
      this.$pause.classList.add('hidden');
      setTimeout(() => { this.lastTime=performance.now(); this.state='playing'; }, 100);
    }
  }

  get mergedInput() {
    return {
      up:    this.input.up    || this.touchInput.up,
      down:  this.input.down  || this.touchInput.down,
      left:  this.input.left  || this.touchInput.left,
      right: this.input.right || this.touchInput.right,
      shoot: this.input.shoot || this.touchInput.shoot,
    };
  }

  _loop(ts) {
    this.raf = requestAnimationFrame(t => this._loop(t));
    const dt = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    if (this.state === 'playing') this._update(dt);
    this._draw();
  }

  _update(dt) {
    const inp = this.mergedInput;
    this.player.update(dt, inp);

    if (inp.shoot && this.player.canShoot()) this._playerShoot();

    const waveEvent = this.waveManager.update(dt);
    if (waveEvent) {
      if (waveEvent.spawn)   this._spawnEnemy(waveEvent.type);
      if (waveEvent.newWave) this._announceWave(waveEvent.wave);
    }

    if (
      this.waveManager.waveEnemiesLeft === 0 &&
      !this.waveManager.betweenWaves &&
      !this.waveManager.waveComplete &&
      this.enemies.length === 0
    ) {
      this.waveManager.startNextWave();
    }

    for (const e of this.enemies) {
      e.update(dt, this.player.x, this.player.y);
      if (e.canShoot()) this._enemyShoot(e);
      if (e.y > this.canvas.height + 60) e.alive = false;
    }

    for (const b of this.bullets) {
      b.update(dt);
      if (b.y < -40 || b.y > this.canvas.height + 40 || b.x < -40 || b.x > this.canvas.width + 40) b.alive=false;
    }

    for (const p  of this.particles) p.update(dt);
    for (const pu of this.powerUps)  { pu.update(dt); if (pu.y > this.canvas.height + 40) pu.alive=false; }

    // Engine trail
    if (Math.random() < 0.7) {
      Emitter.trail(this.particles, this.player.x - 6, this.player.y + 22, '#00aaff');
      Emitter.trail(this.particles, this.player.x + 6, this.player.y + 22, '#0066ff');
    }

    this._checkBulletEnemyCollisions();
    this._checkPlayerCollisions();
    this._checkPowerUpCollisions();

    // Prune dead entities
    this.enemies   = this.enemies.filter(e  => e.alive);
    this.bullets   = this.bullets.filter(b  => b.alive);
    this.particles = this.particles.filter(p => p.alive);
    this.powerUps  = this.powerUps.filter(pu => pu.alive);

    // Score pops
    for (const sp of this._scorePops) { sp.y += sp.vy * dt; sp.life -= dt; }
    this._scorePops = this._scorePops.filter(sp => sp.life > 0);

    this._updateHUD();
    if (!this.player.alive) this._gameOver();
  }

  _spawnEnemy(type) {
    const x = rand(40, this.canvas.width - 40);
    this.enemies.push(new Enemy(x, -50, type, this.canvas));
  }

  _playerShoot() {
    this.player.shoot();
    const x = this.player.x, y = this.player.top;
    if (this.player.isDouble) {
      this.bullets.push(new Bullet(x-10, y, 0, -700, true, '#00f5ff', 10));
      this.bullets.push(new Bullet(x+10, y, 0, -700, true, '#00f5ff', 10));
      this.audio.shootDouble();
    } else {
      this.bullets.push(new Bullet(x, y, 0, -700, true, '#00f5ff', 10));
      this.audio.shoot();
    }
  }

  _enemyShoot(enemy) {
    const dx = this.player.x - enemy.x, dy = this.player.y - enemy.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    const speed = 280;
    this.bullets.push(new Bullet(enemy.x, enemy.bottom, (dx/dist)*speed, (dy/dist)*speed, false, '#ff4400', 15));
  }

  _aabbOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  _checkBulletEnemyCollisions() {
    for (const b of this.bullets) {
      if (!b.alive || !b.isPlayer) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (this._aabbOverlap(b, e)) {
          b.alive = false;
          e.takeDamage(b.damage);
          Emitter.explode(this.particles, b.x, b.y, 6, e.color, false);
          if (!e.alive) this._onEnemyKilled(e);
          break;
        }
      }
    }
  }

  _checkPlayerCollisions() {
    if (!this.player.alive) return;
    for (const b of this.bullets) {
      if (!b.alive || b.isPlayer) continue;
      if (this._aabbOverlap(b, this.player)) {
        b.alive = false;
        const hit = this.player.takeDamage(b.damage);
        if (hit) { this.audio.playerHit(); Emitter.explode(this.particles, b.x, b.y, 10, '#ff4400', false); }
      }
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (this._aabbOverlap(e, this.player)) {
        e.takeDamage(999);
        const hit = this.player.takeDamage(25);
        if (hit) this.audio.playerHit();
        if (!e.alive) this._onEnemyKilled(e);
        Emitter.explode(this.particles, e.x, e.y, 20, e.color, false);
      }
    }
  }

  _checkPowerUpCollisions() {
    for (const pu of this.powerUps) {
      if (!pu.alive) continue;
      const dx = pu.x - this.player.x, dy = pu.y - this.player.y;
      if (dx*dx + dy*dy < (pu.r + 24)**2) {
        pu.alive = false;
        this.player.applyPowerUp(pu.id, pu.duration);
        this.audio.powerUp();
        Emitter.powerUpEffect(this.particles, pu.x, pu.y, pu.color);
        this._updatePowerupHUD();
      }
    }
  }

  _onEnemyKilled(enemy) {
    this.kills++;
    this.score += enemy.score * this.waveManager.wave;
    this.waveManager.onEnemyKilled();
    const big = ['tank','elite','bomber'].includes(enemy.typeName);
    Emitter.explode(this.particles, enemy.x, enemy.y, big ? 40 : 20, enemy.color, big);
    if (big) this.audio.explodeLarge(); else this.audio.explodeSmall();
    if (Math.random() < this.powerUpDropChance) this.powerUps.push(new PowerUp(enemy.x, enemy.y));
    this._scorePops.push({ x: enemy.x, y: enemy.y - 10, pts: enemy.score * this.waveManager.wave, life: 1.0, maxLife: 1.0, vy: -60 });
  }

  _updateHUD() {
    document.getElementById('hudScore').textContent = this.score.toLocaleString();
    document.getElementById('hudWave').textContent  = this.waveManager.wave;
    const hp = this.player.health, pct = (hp / this.player.maxHealth) * 100;
    const fill = document.getElementById('hudHealthFill');
    fill.style.width = `${pct}%`;
    document.getElementById('hudHealthText').textContent = Math.ceil(hp);
    const color = pct > 60 ? '#00e676' : pct > 30 ? '#ffaa00' : '#ff1744';
    fill.style.background  = color;
    fill.style.boxShadow   = `0 0 8px ${color}`;
    this._updatePowerupHUD();
  }

  _updatePowerupHUD() {
    const list = document.getElementById('powerupList');
    list.innerHTML = '';
    for (const def of PowerUp.TYPES) {
      const t = this.player.powers[def.id];
      if (t > 0) {
        const badge = document.createElement('div');
        badge.className = `powerup-badge ${def.id}`;
        badge.textContent = `${def.icon} ${def.label} ${t === Infinity ? '∞' : t.toFixed(1)+'s'}`;
        list.appendChild(badge);
      }
    }
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (this.starField) {
      this.starField.draw(ctx);
    } else {
      ctx.fillStyle = '#000814'; ctx.fillRect(0,0,W,H);
    }

    if (this.state === 'menu') return;

    for (const pu of this.powerUps)  pu.draw(ctx);
    for (const b  of this.bullets)   b.draw(ctx);
    for (const e  of this.enemies)   e.draw(ctx);
    if (this.player) this.player.draw(ctx);
    for (const p  of this.particles) p.draw(ctx);

    // Score pops
    for (const sp of this._scorePops) {
      ctx.save();
      ctx.globalAlpha  = Math.max(0, sp.life / sp.maxLife);
      ctx.fillStyle    = '#ffdd00';
      ctx.font         = 'bold 14px "Orbitron", monospace';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur   = 8;
      ctx.shadowColor  = '#ffaa00';
      ctx.fillText(`+${sp.pts}`, sp.x, sp.y);
      ctx.restore();
    }

    // Between-waves line
    if (this.waveManager?.betweenWaves) {
      const pct = this.waveManager.betweenTimer / this.waveManager.betweenDuration;
      ctx.save();
      ctx.globalAlpha = pct;
      const grad = ctx.createLinearGradient(0,0,W,0);
      grad.addColorStop(0,'transparent'); grad.addColorStop(0.5,'rgba(0,245,255,0.2)'); grad.addColorStop(1,'transparent');
      ctx.fillStyle = grad; ctx.fillRect(0,0,W,3);
      ctx.restore();
    }
  }
}

/* ══════════════════════════════════════════════════════
   SECTION 12 — HELPERS
   ══════════════════════════════════════════════════════ */

/** Escape HTML special chars to prevent XSS in leaderboard names */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ══════════════════════════════════════════════════════
   SECTION 13 — BOOTSTRAP
   ══════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window._game = game;
});
