

import { DROP, INTERACT, PHYSICS, SIM, chipShadow, type TagItem } from "./data";

export type PileRead = {
  list: readonly TagItem[];
  physics: typeof PHYSICS;
  interact: typeof INTERACT;
  drop: typeof DROP;
  look: { shadow: boolean; gloss: boolean };
  onReveal?: () => void; onSelect?: (index: number) => void;
};

type Body = {
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  w: number;
  hl: number;
  r: number;
  bw: number;
  bh: number;
  im: number;
  iI: number;
  alive: boolean;
  z: number;
  e1x: number;
  e1y: number;
  e2x: number;
  e2y: number;
  vs: number;
  vsv: number;
  sq: number;
  sqv: number;
  kick: number;
  lift: number;
  dim: number;
  op: number;
  sk: number;
  ox: number;
  oy: number;
  oa: number;
  rest: number;
  zz: boolean;
};

type Contact = {
  a: number;
  b: number;
  nx: number;
  ny: number;
  px: number;
  py: number;
  pen: number;
  wvx: number;
  wvy: number;
  wt: number;
};

type Grip = {
  i: number;
  lx: number;
  ly: number;
  tx: number;
  ty: number;
  id: number;
  sx: number;
  sy: number;
  t0: number;
  moved: boolean;
};

type Ring = {
  el: HTMLElement | null;
  on: boolean;
  t: number;
  x: number;
  y: number;
  k: number;
};

function createBody(): Body {
  return {
    x: 0,
    y: 0,
    a: 0,
    vx: 0,
    vy: 0,
    w: 0,
    hl: 0,
    r: 10,
    bw: 20,
    bh: 20,
    im: 1,
    iI: 1,
    alive: false,
    z: 0,
    e1x: 0,
    e1y: 0,
    e2x: 0,
    e2y: 0,
    vs: 1,
    vsv: 0,
    sq: 0,
    sqv: 0,
    kick: 0,
    lift: 0,
    dim: 1,
    op: -1,
    sk: -1,
    ox: 0,
    oy: 0,
    oa: 0,
    rest: 0,
    zz: false,
  };
}

function fitBody(body: Body, w: number, h: number) {
  body.bw = w;
  body.bh = h;
  const r = Math.max(4, Math.min(w, h) / 2);
  body.r = r;
  body.hl = Math.max(0, (w - 2 * r) / 2);
  const mass = (4 * body.hl * r + Math.PI * r * r) * 0.001;
  const width = 2 * body.hl + 2 * r;
  const height = 2 * r;
  body.im = 1 / mass;
  body.iI = 12 / (mass * (width * width + height * height));
}

function shuffle(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  return order;
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function closestOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  out: number[],
) {
  const sx = bx - ax;
  const sy = by - ay;
  const len2 = sx * sx + sy * sy;
  const u = len2 > SIM.eps ? clamp01(((px - ax) * sx + (py - ay) * sy) / len2) : 0;
  out[0] = ax + sx * u;
  out[1] = ay + sy * u;
}

function closestSegments(
  out: number[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) {
  const rx = bx - ax;
  const ry = by - ay;
  const sx = dx - cx;
  const sy = dy - cy;
  const qx = ax - cx;
  const qy = ay - cy;
  const rr = rx * rx + ry * ry;
  const ss = sx * sx + sy * sy;
  const b = sx * qx + sy * qy;
  let u = 0;
  let v = 0;
  if (rr <= SIM.eps && ss <= SIM.eps) {
    u = 0;
    v = 0;
  } else if (rr <= SIM.eps) {
    v = clamp01(b / ss);
  } else {
    const a = rx * qx + ry * qy;
    if (ss <= SIM.eps) {
      u = clamp01(-a / rr);
    } else {
      const c = rx * sx + ry * sy;
      const denom = rr * ss - c * c;
      u = denom > SIM.eps ? clamp01((c * b - a * ss) / denom) : 0;
      v = (c * u + b) / ss;
      if (v < 0) {
        v = 0;
        u = clamp01(-a / rr);
      } else if (v > 1) {
        v = 1;
        u = clamp01((c - a) / rr);
      }
    }
  }
  out[0] = ax + rx * u;
  out[1] = ay + ry * u;
  out[2] = cx + sx * v;
  out[3] = cy + sy * v;
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export class TagPile {
  bodies: Body[] = [];
  queue: { i: number; at: number; lift: number }[] = [];
  time = 0;
  W = 700;
  H = 700;
  chips: (HTMLElement | null)[] = [];
  rings: Ring[] = [];
  root: HTMLElement | null = null;
  permit = false;
  reduced = false;
  dropped = false;
  away = false;
  revealed = false;
  private raf = 0;
  private running = false;
  private last = 0;
  private acc = 0;
  private still = 0;
  private zTop = 1;
  private hover = -1;
  private focus = -1;
  private fade = -1;
  private vbusy = false;
  private grip: Grip | null = null;
  private cursor = { on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0 };
  private pool: Contact[] = [];
  private nc = 0;
  private tmp = [0, 0, 0, 0];

  constructor(private read: () => PileRead) {}

  setSize(w: number, h: number) {
    this.W = Math.max(1, w);
    // Rotated pill corners and shadows extend beyond the capsule collider.
    this.H = Math.max(1, h - 36);
  }

  reveal() {
    if (this.revealed) return;
    this.revealed = true;
    const fn = this.read().onReveal;
    if (typeof fn === "function") fn();
  }

  load(sizes: { w: number; h: number }[]) {
    this.grip = null;
    this.hover = -1;
    this.fade = -1;
    this.bodies = sizes.map((size) => {
      const body = createBody();
      fitBody(body, size.w, size.h);
      return body;
    });
    this.queue = [];
    this.dropped = false;
    this.away = false;
    this.still = 0;
    this.hideAll();
    if (this.reduced) {
      this.settleNow();
      this.dropped = true;
      this.paint();
      this.reveal();
      return;
    }
    if (this.permit) {
      this.beginDrop();
      this.wake();
    }
  }

  refit(sizes: { w: number; h: number }[]) {
    for (let i = 0; i < this.bodies.length; i++) {
      const size = sizes[i];
      if (size) fitBody(this.bodies[i], size.w, size.h);
      this.rouse(this.bodies[i]);
    }
    if (!this.running) {
      this.paint();
      this.wake();
    }
  }

  setPermit(on: boolean) {
    const prev = this.permit;
    this.permit = on;
    if (!on) {
      if (prev) this.away = true;
      this.park();
      return;
    }
    if (prev) return;
    if (this.dropped) {
      if (this.away && this.read().drop.replay && !this.reduced) this.beginDrop();
    } else if (this.reduced) {
      this.settleNow();
      this.dropped = true;
      this.paint();
      this.reveal();
    } else {
      this.beginDrop();
    }
    this.away = false;
    this.wake();
  }

  hideAll() {
    for (const chip of this.chips) {
      if (chip) chip.style.visibility = "hidden";
    }
  }

  beginDrop() {
    const drop = this.read().drop;
    const count = this.bodies.length;
    const burst = drop.order === "Burst";
    const order =
      drop.order === "In Order" ? Array.from({ length: count }, (_, i) => i) : shuffle(count);
    const interval = burst ? 0 : Math.max(0, Number(drop.interval) || 0);
    for (const body of this.bodies) body.alive = false;
    this.hideAll();
    this.zTop = 1;
    this.queue = order.map((i, t) => ({
      i,
      at: this.time + 0.18 + t * interval,
      lift: burst ? t * 70 : 0,
    }));
    this.dropped = true;
    this.still = 0;
    this.reveal();
  }

  settleNow() {
    shuffle(this.bodies.length).forEach((i, t) => this.spawn(i, t * 80));
    this.queue = [];
    for (let i = 0; i < 1800 && (this.step(), !(this.still > 2)); i++);
    for (const body of this.bodies) {
      body.kick = 0;
      body.sq = 0;
      body.sqv = 0;
    }
  }

  spawn(index: number, lift: number) {
    const body = this.bodies[index];
    if (!body) return;
    const drop = this.read().drop;
    const reach = body.hl + body.r;
    const zone = Math.min(100, Math.max(10, Number(drop.zone) || 80)) / 100;
    const span = this.W * zone;
    const minX = Math.max(reach, this.W / 2 - span / 2 + reach);
    const maxX = Math.min(this.W - reach, this.W / 2 + span / 2 - reach);
    let y = -(reach + 24 + lift + Math.random() * 90);
    let x = this.W / 2;
    for (let attempt = 0; attempt < 14; attempt++) {
      x = maxX > minX ? minX + Math.random() * (maxX - minX) : this.W / 2;
      let clear = true;
      for (const other of this.bodies) {
        if (!other.alive || other === body) continue;
        const gap = reach + other.hl + other.r + 6;
        if (
          Math.abs(other.x - x) < gap &&
          Math.abs(other.y - y) < body.r + other.r + 6 + (attempt > 7 ? gap : 0)
        ) {
          clear = false;
          break;
        }
      }
      if (clear) break;
      if (attempt === 13) y -= reach * 2 + 40;
    }
    body.x = x;
    body.y = y;
    body.a = (Math.random() - 0.5) * 1.3;
    body.vx = (Math.random() - 0.5) * 140;
    body.vy = 60 + Math.random() * 120;
    body.w = (Math.random() - 0.5) * 3.5;
    body.alive = true;
    body.zz = false;
    body.rest = 0;
    body.z = ++this.zTop;
    body.vs = 1;
    body.vsv = 0;
    body.sq = 0;
    body.sqv = 0;
    body.kick = 0;
    body.lift = 0;
    body.dim = 1;
    body.op = -1;
    body.sk = -1;
    const chip = this.chips[index];
    if (chip) {
      chip.style.visibility = "visible";
      chip.style.zIndex = String(body.z);
    }
  }

  wake() {
    if (!this.permit || this.running || typeof requestAnimationFrame === "undefined") return;
    this.running = true;
    this.still = 0;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  park() {
    if (this.raf && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.running = false;
    this.last = 0;
    this.acc = 0;
    if (this.grip) {
      this.grip = null;
      if (this.root) this.root.style.cursor = "";
    }
    this.hover = -1;
    this.cursor.on = false;
    this.cursor.vx = 0;
    this.cursor.vy = 0;
    if (this.fade >= 0) {
      this.fade = -1;
      this.beginDrop();
    }
    for (const ring of this.rings) {
      ring.on = false;
      if (ring.el) ring.el.style.opacity = "0";
    }
    for (const body of this.bodies) {
      body.vs = 1;
      body.vsv = 0;
      body.sq = 0;
      body.sqv = 0;
      body.lift = 0;
      body.dim = 1;
    }
    this.paint();
  }

  private frame = (stamp: number) => {
    this.raf = 0;
    if (!this.permit) {
      this.running = false;
      this.last = 0;
      return;
    }
    const dt = this.last ? Math.min((stamp - this.last) / 1000, 0.1) : SIM.step;
    this.last = stamp;
    this.acc += dt;
    let steps = 0;
    for (; this.acc >= SIM.step - 1e-4 && steps < 3; ) {
      this.step();
      this.acc -= SIM.step;
      steps++;
    }
    if (steps === 3) this.acc = 0;
    this.animate(dt);
    this.paint();
    const ringing = this.rings.some((ring) => ring.on);
    if (
      !(
        this.grip ||
        this.queue.length > 0 ||
        this.fade >= 0 ||
        this.vbusy ||
        ringing ||
        (this.cursor.on && stamp - this.cursor.t < 160)
      ) &&
      this.still > 2
    ) {
      this.running = false;
      this.last = 0;
      this.acc = 0;
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private animate(dt: number) {
    const read = this.read();
    const interact = read.interact;
    const squish = this.reduced ? 0 : Math.max(0, Number(read.physics.squish) || 0);
    const dimOthers = 1 - Math.min(0.8, Math.max(0, Number(interact.focusDim) || 0));
    const held = this.grip ? this.grip.i : -1;
    const highlighted = held >= 0 ? held : this.focus;
    let busy = false;
    const sub = Math.max(1, Math.ceil(dt / (1 / 90)));
    const h = dt / sub;
    const liftLerp = 1 - Math.exp(-dt * 13);
    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      if (!body.alive) continue;
      let scale = 1;
      let lift = 0;
      let dim = 1;
      if (i === held) {
        scale = 1.09;
        lift = 1;
      } else if (i === this.focus) {
        scale = 1.05;
        lift = 0.55;
      } else if (i === this.hover && interact.hoverLift && held < 0) {
        scale = 1.045;
        lift = 0.4;
      }
      if (highlighted >= 0 && i !== highlighted) dim = dimOthers;
      if (this.reduced) {
        body.vs = scale;
        body.vsv = 0;
        body.sq = 0;
        body.sqv = 0;
        body.kick = 0;
        body.lift = lift;
        body.dim = dim;
        continue;
      }
      if (body.kick > 0) {
        body.sqv += body.kick * squish * 7.5;
        body.kick = 0;
      }
      for (let s = 0; s < sub; s++) {
        const scaleAcc = (scale - body.vs) * 420 - body.vsv * 24;
        body.vsv += scaleAcc * h;
        body.vs += body.vsv * h;
        const squishAcc = -body.sq * 560 - body.sqv * 15;
        body.sqv += squishAcc * h;
        body.sq += body.sqv * h;
      }
      if (body.sq > 0.2) body.sq = 0.2;
      else if (body.sq < -0.2) body.sq = -0.2;
      body.lift += (lift - body.lift) * liftLerp;
      body.dim = dim;
      if (
        Math.abs(scale - body.vs) > 0.001 ||
        Math.abs(body.vsv) > 0.01 ||
        Math.abs(body.sq) > 0.002 ||
        Math.abs(body.sqv) > 0.02 ||
        Math.abs(lift - body.lift) > 0.004 ||
        Math.abs(dim - body.dim) > 0.004
      ) {
        busy = true;
      }
    }
    for (const ring of this.rings) {
      if (!ring.on || !ring.el) continue;
      ring.t += dt;
      const p = ring.t / SIM.ringDuration;
      if (p >= 1) {
        ring.on = false;
        ring.el.style.opacity = "0";
        continue;
      }
      const scale = (0.12 + (1 - (1 - p) ** 3) * ring.k).toFixed(4);
      ring.el.style.transform = `translate3d(${(ring.x - SIM.ringSize / 2).toFixed(1)}px, ${(ring.y - SIM.ringSize / 2).toFixed(1)}px, 0) scale(${scale})`;
      ring.el.style.opacity = ((1 - p) * 0.85).toFixed(3);
    }
    if (this.fade >= 0) {
      this.fade += dt;
      busy = true;
      if (this.fade >= SIM.fade) {
        this.fade = -1;
        this.beginDrop();
      }
    }
    this.vbusy = busy;
  }

  paint() {
    const look = this.read().look;
    const fade = this.fade >= 0 ? Math.max(0, 1 - this.fade / SIM.fade) : 1;
    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      const chip = this.chips[i];
      if (!chip || !body.alive) continue;
      const sx = body.vs * (1 + body.sq);
      const sy = body.vs * (1 - body.sq);
      chip.style.transform = `translate3d(${(body.x - body.bw / 2).toFixed(2)}px, ${(body.y - body.bh / 2).toFixed(2)}px, 0) rotate(${body.a.toFixed(4)}rad) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      const opacity = body.dim * fade;
      if (Math.abs(opacity - body.op) > 0.003) {
        chip.style.opacity = opacity > 0.997 ? "" : opacity.toFixed(3);
        body.op = opacity;
      }
      const shadow = Math.round(body.lift * 30);
      if (shadow !== body.sk) {
        body.sk = shadow;
        chip.style.boxShadow = chipShadow(shadow / 30, !!look.shadow, !!look.gloss);
      }
    }
  }

  step() {
    const physics = this.read().physics;
    this.time += SIM.step;
    while (this.queue.length && this.queue[0].at <= this.time + 1e-6) {
      const item = this.queue.shift();
      if (item) this.spawn(item.i, item.lift);
    }
    const cursor = this.cursor;
    if (cursor.on && now() - cursor.t > 50) {
      cursor.vx *= 0.6;
      cursor.vy *= 0.6;
    }
    const dt = SIM.step / SIM.substeps;
    const gravity = Number(physics.gravity) || 2600;
    const linDamp = 1 - 0.5 * dt;
    const angDamp = 1 - 1.8 * dt;
    const bodies = this.bodies;
    for (const body of bodies) {
      body.ox = body.x;
      body.oy = body.y;
      body.oa = body.a;
    }
    for (let sub = 0; sub < SIM.substeps; sub++) {
      for (const body of bodies) {
        if (!body.alive || body.zz) continue;
        body.vy += gravity * dt;
        body.vx *= linDamp;
        body.vy *= linDamp;
        body.w *= angDamp;
      }
      if (this.grip) this.pull(dt);
      this.collect();
      for (let iter = 0; iter < SIM.iterations; iter++) {
        for (let c = 0; c < this.nc; c++) this.solve(this.pool[c], physics);
      }
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (!body.alive || body.zz) continue;
        const speed = Math.hypot(body.vx, body.vy);
        if (speed > SIM.maxSpeed) {
          body.vx *= SIM.maxSpeed / speed;
          body.vy *= SIM.maxSpeed / speed;
        }
        if (body.w > SIM.maxSpin) body.w = SIM.maxSpin;
        else if (body.w < -28) body.w = -28;
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        body.a += body.w * dt;
        if (body.y > this.H + 400 || body.x < -400 || body.x > this.W + 400) {
          if (this.grip && this.grip.i === i) this.grip = null;
          this.spawn(i, 0);
        }
      }
      this.collect();
      this.correct();
    }
    let moving = 0;
    const held = this.grip ? this.grip.i : -1;
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (!body.alive || body.zz) continue;
      const speed =
        (Math.hypot(body.x - body.ox, body.y - body.oy) +
          Math.abs(body.a - body.oa) * (body.hl + body.r)) /
        SIM.step;
      if (speed < 10 && i !== held && body.y > 0) body.rest++;
      else body.rest = 0;
      if (body.rest > 40) {
        body.zz = true;
        body.vx = 0;
        body.vy = 0;
        body.w = 0;
        continue;
      }
      moving++;
      if (speed > 80) {
        const reach = body.hl + body.r + 24;
        for (const other of bodies) {
          if (!other.zz || !other.alive) continue;
          const gap = reach + other.hl + other.r;
          if (Math.abs(other.x - body.x) < gap && Math.abs(other.y - body.y) < gap) {
            this.rouse(other);
          }
        }
      }
    }
    this.still = moving === 0 && this.queue.length === 0 ? this.still + 1 : 0;
  }

  rouse(body: Body) {
    body.zz = false;
    body.rest = 0;
  }

  rouseAll() {
    for (const body of this.bodies) {
      if (body.alive) this.rouse(body);
    }
  }

  private add(
    a: number,
    b: number,
    nx: number,
    ny: number,
    px: number,
    py: number,
    pen: number,
    wvx: number,
    wvy: number,
    wt: number,
  ) {
    let contact = this.pool[this.nc];
    if (!contact) {
      contact = { a: 0, b: 0, nx: 0, ny: 0, px: 0, py: 0, pen: 0, wvx: 0, wvy: 0, wt: 1 };
      this.pool.push(contact);
    }
    contact.a = a;
    contact.b = b;
    contact.nx = nx;
    contact.ny = ny;
    contact.px = px;
    contact.py = py;
    contact.pen = pen;
    contact.wvx = wvx;
    contact.wvy = wvy;
    contact.wt = wt;
    this.nc++;
  }

  private wall(index: number, x: number, y: number, r: number) {
    let pen = y + r - this.H;
    if (pen > 0) this.add(index, -1, 0, 1, x, this.H, pen, 0, 0, 1);
    pen = r + 36 - x;
    if (pen > 0) this.add(index, -1, -1, 0, 36, y, pen, 0, 0, 1);
    pen = x + r - (this.W - 36);
    if (pen > 0) this.add(index, -1, 1, 0, this.W - 36, y, pen, 0, 0, 1);
  }

  private tip(
    a: number,
    b: number,
    px: number,
    py: number,
    other: Body,
    radius: number,
    sum: number,
    pointOnA: boolean,
  ) {
    const tmp = this.tmp;
    closestOnSegment(px, py, other.e1x, other.e1y, other.e2x, other.e2y, tmp);
    const dx = pointOnA ? tmp[0] - px : px - tmp[0];
    const dy = pointOnA ? tmp[1] - py : py - tmp[1];
    const d2 = dx * dx + dy * dy;
    if (d2 >= sum * sum || d2 < 1e-8) return;
    const dist = Math.sqrt(d2);
    const nx = dx / dist;
    const ny = dy / dist;
    const ox = pointOnA ? px : tmp[0];
    const oy = pointOnA ? py : tmp[1];
    this.add(a, b, nx, ny, ox + nx * radius, oy + ny * radius, sum - dist, 0, 0, 1);
  }

  private uncross(a: number, b: number, body: Body, other: Body, sum: number) {
    let nx = -Math.sin(body.a);
    let ny = Math.cos(body.a);
    if (
      (other.x - body.x) * nx + (other.y - body.y) * ny < 0 ||
      (Math.abs(other.x - body.x) < 0.001 && Math.abs(other.y - body.y) < 0.001 && ny > 0)
    ) {
      nx = -nx;
      ny = -ny;
    }
    const d1 = (other.e1x - body.x) * nx + (other.e1y - body.y) * ny;
    const d2 = (other.e2x - body.x) * nx + (other.e2y - body.y) * ny;
    const pen = sum - Math.min(d1, d2);
    if (pen <= 0) return;
    this.add(a, b, nx, ny, body.x + nx * body.r, body.y + ny * body.r, pen, 0, 0, 1);
  }

  private collect() {
    this.nc = 0;
    const bodies = this.bodies;
    const count = bodies.length;
    for (let i = 0; i < count; i++) {
      const body = bodies[i];
      if (!body.alive) continue;
      const c = Math.cos(body.a) * body.hl;
      const s = Math.sin(body.a) * body.hl;
      body.e1x = body.x - c;
      body.e1y = body.y - s;
      body.e2x = body.x + c;
      body.e2y = body.y + s;
      this.wall(i, body.e1x, body.e1y, body.r);
      if (body.hl > 0.5) this.wall(i, body.e2x, body.e2y, body.r);
    }
    for (let i = 0; i < count; i++) {
      const a = bodies[i];
      if (!a.alive) continue;
      const reach = a.hl + a.r;
      for (let j = i + 1; j < count; j++) {
        const b = bodies[j];
        if (!b.alive) continue;
        const broad = reach + b.hl + b.r;
        if (Math.abs(a.x - b.x) > broad || Math.abs(a.y - b.y) > broad) continue;
        const sum = a.r + b.r;
        const before = this.nc;
        const tmp = this.tmp;
        closestSegments(tmp, a.e1x, a.e1y, a.e2x, a.e2y, b.e1x, b.e1y, b.e2x, b.e2y);
        if (Math.hypot(tmp[2] - tmp[0], tmp[3] - tmp[1]) < 0.5) {
          this.uncross(i, j, a, b, sum);
          continue;
        }
        this.tip(i, j, a.e1x, a.e1y, b, a.r, sum, true);
        if (a.hl > 0.5) this.tip(i, j, a.e2x, a.e2y, b, a.r, sum, true);
        this.tip(i, j, b.e1x, b.e1y, a, a.r, sum, false);
        if (b.hl > 0.5) this.tip(i, j, b.e2x, b.e2y, a, a.r, sum, false);
        if (this.nc === before) {
          closestSegments(tmp, a.e1x, a.e1y, a.e2x, a.e2y, b.e1x, b.e1y, b.e2x, b.e2y);
          let nx = tmp[2] - tmp[0];
          let ny = tmp[3] - tmp[1];
          let dist = Math.hypot(nx, ny);
          if (dist < sum) {
            if (dist < 1e-4) {
              nx = b.x - a.x;
              ny = b.y - a.y;
              const center = Math.hypot(nx, ny);
              if (center < 1e-4) {
                nx = 0;
                ny = 1;
              } else {
                nx /= center;
                ny /= center;
              }
              dist = 0;
            } else {
              nx /= dist;
              ny /= dist;
            }
            this.add(i, j, nx, ny, tmp[0] + nx * a.r, tmp[1] + ny * a.r, sum - dist, 0, 0, 1);
          }
        }
        const added = this.nc - before;
        if (added > 1) {
          for (let c = before; c < this.nc; c++) this.pool[c].wt = 1 / added;
        }
      }
    }
    const cursor = this.cursor;
    if (cursor.on && Math.hypot(cursor.vx, cursor.vy) > 250) {
      const physics = this.read().physics;
      const push = Math.max(4, Number(physics.pushSize) || 46);
      const tmp = this.tmp;
      for (let i = 0; i < count; i++) {
        const body = bodies[i];
        if (!body.alive || (this.grip && this.grip.i === i)) continue;
        closestOnSegment(cursor.x, cursor.y, body.e1x, body.e1y, body.e2x, body.e2y, tmp);
        const dx = cursor.x - tmp[0];
        const dy = cursor.y - tmp[1];
        const dist = Math.hypot(dx, dy);
        const reach = body.r + push;
        if (dist >= reach || dist < 1e-4) continue;
        const nx = dx / dist;
        const ny = dy / dist;
        this.add(i, -1, nx, ny, tmp[0] + nx * body.r, tmp[1] + ny * body.r, reach - dist, cursor.vx, cursor.vy, 1);
      }
    }
  }

  private push(
    a: Body,
    b: Body | null,
    ix: number,
    iy: number,
    rax: number,
    ray: number,
    rbx: number,
    rby: number,
  ) {
    a.vx -= ix * a.im;
    a.vy -= iy * a.im;
    a.w -= (rax * iy - ray * ix) * a.iI;
    if (b) {
      b.vx += ix * b.im;
      b.vy += iy * b.im;
      b.w += (rbx * iy - rby * ix) * b.iI;
    }
  }

  private solve(contact: Contact, physics: PileRead["physics"]) {
    const a = this.bodies[contact.a];
    const other = contact.b >= 0 ? this.bodies[contact.b] : null;
    if (a.zz && (!other || other.zz) && contact.wvx === 0 && contact.wvy === 0) return;
    const rax = contact.px - a.x;
    const ray = contact.py - a.y;
    let b: Body | null = null;
    let wvx = contact.wvx;
    let wvy = contact.wvy;
    let rbx = 0;
    let rby = 0;
    let bim = 0;
    let biI = 0;
    if (contact.b >= 0) {
      b = this.bodies[contact.b];
      rbx = contact.px - b.x;
      rby = contact.py - b.y;
      wvx = b.vx - b.w * rby;
      wvy = b.vy + b.w * rbx;
      bim = b.im;
      biI = b.iI;
    }
    const avx = a.vx - a.w * ray;
    const avy = a.vy + a.w * rax;
    const rvx = wvx - avx;
    const rvy = wvy - avy;
    const vn = rvx * contact.nx + rvy * contact.ny;
    if (vn >= 0) return;
    if (vn < -60) {
      if (a.zz) this.rouse(a);
      if (b && b.zz) this.rouse(b);
    }
    if (a.zz || (b && b.zz)) {
      if (a.zz && b && !b.zz) {
        this.push1(b, -contact.nx, -contact.ny, vn, contact.px - b.x, contact.py - b.y, physics);
      } else if (b && b.zz && !a.zz) {
        this.push1(a, contact.nx, contact.ny, vn, rax, ray, physics);
      }
      return;
    }
    if (vn < -320) {
      const kick = Math.min(1, (-vn - 320) / 2200);
      if (kick > a.kick) a.kick = kick;
      if (b && kick > b.kick) b.kick = kick;
    }
    const raCross = rax * contact.ny - ray * contact.nx;
    const rbCross = rbx * contact.ny - rby * contact.nx;
    const kn = a.im + bim + raCross * raCross * a.iI + rbCross * rbCross * biI;
    const bounce = vn < -90 ? Math.max(0, Number(physics.bounce) || 0) : 0;
    const jn = (-(1 + bounce) * vn) / kn;
    this.push(a, b, contact.nx * jn, contact.ny * jn, rax, ray, rbx, rby);
    const tx = rvx - vn * contact.nx;
    const ty = rvy - vn * contact.ny;
    const tangent = Math.hypot(tx, ty);
    if (tangent < 1e-6) return;
    const nx = tx / tangent;
    const ny = ty / tangent;
    const raT = rax * ny - ray * nx;
    const rbT = rbx * ny - rby * nx;
    const kt = a.im + bim + raT * raT * a.iI + rbT * rbT * biI;
    const friction = Math.max(0, Number(physics.friction) || 0) * jn;
    let jt = -tangent / kt;
    if (jt < -friction) jt = -friction;
    else if (jt > friction) jt = friction;
    this.push(a, b, nx * jt, ny * jt, rax, ray, rbx, rby);
  }

  private push1(
    body: Body,
    nx: number,
    ny: number,
    vn: number,
    rx: number,
    ry: number,
    physics: PileRead["physics"],
  ) {
    const cross = rx * ny - ry * nx;
    const k = body.im + cross * cross * body.iI;
    const jn = -vn / k;
    body.vx -= nx * jn * body.im;
    body.vy -= ny * jn * body.im;
    body.w -= cross * jn * body.iI;
    const vx = body.vx - body.w * ry;
    const vy = body.vy + body.w * rx;
    const vn2 = vx * nx + vy * ny;
    let tx = vx - vn2 * nx;
    let ty = vy - vn2 * ny;
    const tangent = Math.hypot(tx, ty);
    if (tangent < 1e-6) return;
    tx /= tangent;
    ty /= tangent;
    const tCross = rx * ty - ry * tx;
    const kt = body.im + tCross * tCross * body.iI;
    const friction = Math.max(0, Number(physics.friction) || 0) * jn;
    let jt = tangent / kt;
    if (jt > friction) jt = friction;
    body.vx -= tx * jt * body.im;
    body.vy -= ty * jt * body.im;
    body.w -= tCross * jt * body.iI;
  }

  private correct() {
    for (let i = 0; i < this.nc; i++) {
      const contact = this.pool[i];
      if (contact.pen <= SIM.slop) continue;
      const a = this.bodies[contact.a];
      const b = contact.b >= 0 ? this.bodies[contact.b] : null;
      const aim = a.zz ? 0 : a.im;
      const bim = b && !b.zz ? b.im : 0;
      const sum = aim + bim;
      if (sum <= 0) continue;
      const corr = ((contact.pen - SIM.slop) * 0.45 * contact.wt) / sum;
      a.x -= contact.nx * corr * aim;
      a.y -= contact.ny * corr * aim;
      if (b) {
        b.x += contact.nx * corr * bim;
        b.y += contact.ny * corr * bim;
      }
    }
  }

  private pull(dt: number) {
    const grip = this.grip;
    if (!grip) return;
    const body = this.bodies[grip.i];
    if (!body || !body.alive) {
      this.grip = null;
      return;
    }
    const c = Math.cos(body.a);
    const s = Math.sin(body.a);
    const ox = grip.lx * c - grip.ly * s;
    const oy = grip.lx * s + grip.ly * c;
    const ex = grip.tx - (body.x + ox);
    const ey = grip.ty - (body.y + oy);
    const vx = body.vx - body.w * oy;
    const vy = body.vy + body.w * ox;
    const fx = ex * SIM.pointerStiffness - vx;
    const fy = ey * SIM.pointerStiffness - vy;
    const m00 = body.im + body.iI * oy * oy;
    const m01 = -body.iI * ox * oy;
    const m11 = body.im + body.iI * ox * ox;
    const det = m00 * m11 - m01 * m01;
    if (Math.abs(det) < 1e-14) return;
    let ix = (m11 * fx - m01 * fy) / det;
    let iy = (m00 * fy - m01 * fx) / det;
    const cap = (SIM.pointerForce * dt) / body.im;
    const mag = Math.hypot(ix, iy);
    if (mag > cap) {
      ix *= cap / mag;
      iy *= cap / mag;
    }
    body.vx += ix * body.im;
    body.vy += iy * body.im;
    body.w += (ox * iy - oy * ix) * body.iI;
    body.w *= 0.99;
  }

  ring(x: number, y: number, k: number) {
    if (this.reduced || !this.rings.length) return;
    let ring = this.rings.find((item) => !item.on);
    if (!ring) ring = this.rings.reduce((best, item) => (best.t > item.t ? best : item));
    ring.on = true;
    ring.t = 0;
    ring.x = x;
    ring.y = y;
    ring.k = k;
  }

  pop(index: number) {
    const body = this.bodies[index];
    if (!body || !body.alive) return;
    this.rouse(body);
    body.vy = Math.min(body.vy, 0) - (1350 + Math.random() * 500);
    body.vx += (Math.random() - 0.5) * 320;
    body.w += (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 6);
    body.kick = 1;
    this.ring(body.x, body.y, 0.9);
    this.wake();
  }

  toss() {
    if (!this.permit) return;
    this.rouseAll();
    for (const body of this.bodies) {
      if (!body.alive) continue;
      const depth = 0.55 + 0.45 * Math.min(1, Math.max(0, body.y / this.H));
      body.vy = Math.min(body.vy, 0) - (1150 + Math.random() * 900) * depth;
      body.vx += (Math.random() - 0.5) * 640;
      body.w += (Math.random() - 0.5) * 16;
      body.kick = 0.8;
    }
    this.ring(this.W / 2, this.H - 10, 2.6);
    this.wake();
  }

  reset() {
    if (!this.permit) return;
    this.grip = null;
    if (this.reduced) {
      this.beginDrop();
      this.settleNow();
      this.paint();
      return;
    }
    if (this.fade < 0) this.fade = 0;
    this.wake();
  }

  private openLink(url: string) {
    if (!url || typeof window === "undefined") return;
    if (this.read().interact.newTab) window.open(url, "_blank", "noopener,noreferrer");
    else window.location.href = url;
  }

  key(index: number, key: string) {
    const body = this.bodies[index];
    if (!body || !body.alive) return false;
    const item = this.read().list[index];
    if (key === "Enter") {
      if (item && item.link) this.openLink(item.link);
      else this.pop(index);
      return true;
    }
    if (key === " " || key === "ArrowUp") {
      this.pop(index);
      return true;
    }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const dir = key === "ArrowLeft" ? -1 : 1;
      this.rouse(body);
      body.vx += dir * 560;
      body.vy -= 420;
      body.w += dir * 5;
      this.wake();
      return true;
    }
    return false;
  }

  setFocus(index: number) {
    this.focus = index;
    this.wake();
  }

  private local(event: PointerEvent) {
    const root = this.root;
    if (!root) return { x: 0, y: 0 };
    const rect = root.getBoundingClientRect();
    const sx = rect.width / (root.offsetWidth || 1) || 1;
    const sy = rect.height / (root.offsetHeight || 1) || 1;
    return { x: (event.clientX - rect.left) / sx, y: (event.clientY - rect.top) / sy };
  }

  private pick(x: number, y: number) {
    let index = -1;
    let z = -1;
    const tmp = this.tmp;
    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      if (!body.alive) continue;
      const c = Math.cos(body.a) * body.hl;
      const s = Math.sin(body.a) * body.hl;
      closestOnSegment(x, y, body.x - c, body.y - s, body.x + c, body.y + s, tmp);
      if (Math.hypot(x - tmp[0], y - tmp[1]) <= body.r * body.vs + 2 && body.z > z) {
        index = i;
        z = body.z;
      }
    }
    return index;
  }

  down(event: PointerEvent) {
    if (!this.permit || !this.root) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const point = this.local(event);
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-tag-index]") : null;
    const targetIndex = target ? Number(target.dataset.tagIndex) : -1;
    const index = targetIndex >= 0 && this.bodies[targetIndex]?.alive ? targetIndex : this.pick(point.x, point.y);
    if (index >= 0) {
      const body = this.bodies[index];
      this.rouse(body);
      const dx = point.x - body.x;
      const dy = point.y - body.y;
      const c = Math.cos(body.a);
      const s = Math.sin(body.a);
      this.grip = {
        i: index,
        lx: dx * c + dy * s,
        ly: -dx * s + dy * c,
        tx: point.x,
        ty: point.y,
        id: event.pointerId,
        sx: point.x,
        sy: point.y,
        t0: now(),
        moved: false,
      };
      body.z = ++this.zTop;
      const chip = this.chips[index];
      if (chip) chip.style.zIndex = String(body.z);
      try {
        this.root.setPointerCapture(event.pointerId);
      } catch {

      }
      this.root.style.cursor = "grabbing";
      event.preventDefault();
      this.wake();
      return;
    }
    if (this.read().physics.tapBump && !this.reduced) {
      this.bump(point.x, point.y);
      this.ring(point.x, point.y, 1.5);
      this.wake();
    }
  }

  private bump(x: number, y: number) {
    for (const body of this.bodies) {
      if (!body.alive) continue;
      const dx = body.x - x;
      const dy = body.y - y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > 200) continue;
      const falloff = 1 - dist / 200;
      this.rouse(body);
      body.vx += (dx / dist) * falloff * 540;
      body.vy += (dy / dist) * falloff * 360 - falloff * 1150;
      body.w += (Math.random() - 0.5) * 7 * falloff;
      body.kick = Math.max(body.kick, falloff * 0.7);
    }
  }

  move(event: PointerEvent) {
    if (!this.permit) return;
    const point = this.local(event);
    const grip = this.grip;
    if (grip && grip.id === event.pointerId) {
      grip.tx = point.x;
      grip.ty = point.y;
      if (!grip.moved && Math.hypot(point.x - grip.sx, point.y - grip.sy) > 6) grip.moved = true;
      this.wake();
      return;
    }
    if (event.pointerType !== "mouse" || grip) return;
    const index = this.pick(point.x, point.y);
    if (index !== this.hover) {
      this.hover = index;
      this.wake();
    }
    if (!this.read().physics.cursorPush || this.reduced) return;
    const t = now();
    const cursor = this.cursor;
    if (cursor.on) {
      const dt = (t - cursor.t) / 1000;
      if (dt > 0.001 && dt < 0.12) {
        const cap = 2600;
        const vx = Math.max(-cap, Math.min(cap, (point.x - cursor.x) / dt));
        const vy = Math.max(-cap, Math.min(cap, (point.y - cursor.y) / dt));
        cursor.vx = cursor.vx * 0.5 + vx * 0.5;
        cursor.vy = cursor.vy * 0.5 + vy * 0.5;
      } else {
        cursor.vx = 0;
        cursor.vy = 0;
      }
    }
    cursor.x = point.x;
    cursor.y = point.y;
    cursor.t = t;
    cursor.on = true;
    this.wake();
  }

  up(event: PointerEvent) {
    const grip = this.grip;
    if (!grip || grip.id !== event.pointerId) return;
    const body = this.bodies[grip.i];
    const read = this.read();
    const item = read.list[grip.i];
    const tap = !grip.moved;
    this.grip = null;
    if (tap && event.type !== "pointercancel") { read.onSelect?.(grip.i);
      if (item && item.link) this.openLink(item.link);
      else if (read.interact.clickAction === "Pop") this.pop(grip.i);
    } else if (body) {
      const power = Math.max(0.1, Number(read.physics.throwPower) || 1);
      body.vx *= power;
      body.vy *= power;
      body.w *= power;
    }
    if (this.root) {
      try {
        this.root.releasePointerCapture(event.pointerId);
      } catch {

      }
      this.root.style.cursor = "";
    }
    this.wake();
  }

  leave() {
    this.cursor.on = false;
    this.cursor.vx = 0;
    this.cursor.vy = 0;
    if (this.hover !== -1) {
      this.hover = -1;
      this.wake();
    }
  }
}
