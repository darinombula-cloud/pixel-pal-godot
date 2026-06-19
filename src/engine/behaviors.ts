import type { GameNode, SceneDoc } from "./types";
import type { Input } from "./input";

export interface RuntimeState2D { vx: number; vy: number; grounded: boolean; jumpHeld?: boolean; _t?: number; _dir?: number; }
export interface RuntimeState3D { vx: number; vy: number; vz: number; grounded: boolean; _t?: number; }

export interface BehaviorCtx {
  doc: SceneDoc;
  input: Input;
  dt: number;
  state: RuntimeState2D | RuntimeState3D;
  mode: "2d" | "3d";
  solids: GameNode[];
  cameraPos?: { x: number; y: number; z: number };
  log?: (m: string) => void;
}

export function runBehaviors(node: GameNode, ctx: BehaviorCtx) {
  for (const b of node.behaviors) {
    const fn = REGISTRY[b.kind];
    if (fn) try { fn(node, b.params, ctx); } catch (e) { ctx.log?.("behavior " + b.kind + ": " + e); }
  }
}

type Fn = (n: GameNode, p: Record<string, any>, c: BehaviorCtx) => void;

const REGISTRY: Record<string, Fn> = {
  walk: (_n, p, c) => {
    const speed = Number(p.speed ?? (c.mode === "2d" ? 260 : 5));
    const runMul = c.input.isRun() ? Number(p.runMul ?? 1.6) : 1;
    const a = c.input.axis();
    if (c.mode === "2d") {
      (c.state as RuntimeState2D).vx = a.x * speed * runMul;
    } else {
      const s = c.state as RuntimeState3D;
      s.vx = a.x * speed * runMul;
      s.vz = a.y * speed * runMul;
    }
  },
  run: (_n, p, c) => { (c.state as any)._runMul = Number(p.multiplier ?? 1.8); },
  jump: (_n, p, c) => {
    if (c.mode === "2d") {
      const s = c.state as RuntimeState2D;
      if (c.input.isJump() && s.grounded && !s.jumpHeld) {
        s.vy = -Number(p.force ?? p.jump ?? 520);
        s.grounded = false;
      }
      s.jumpHeld = c.input.isJump();
    } else {
      const s = c.state as RuntimeState3D;
      if (c.input.isJump() && s.grounded) {
        s.vy = Math.sqrt(2 * (c.doc.settings.gravity || 25) * Number(p.height ?? 1.6));
        s.grounded = false;
      }
    }
  },
  platformer: (n, p, c) => { REGISTRY.walk(n, p, c); REGISTRY.jump(n, p, c); },
  topdown: (n, p, c) => {
    const sp = Number(p.speed ?? 220) * (c.input.isRun() ? Number(p.runMul ?? 1.6) : 1);
    const a = c.input.axis();
    if (c.mode === "2d") {
      n.transform.x += a.x * sp * c.dt;
      n.transform.y += a.y * sp * c.dt;
    } else {
      n.transform.x += a.x * sp * c.dt;
      n.transform.z += a.y * sp * c.dt;
    }
  },
  follow: (n, p, c) => {
    const target = findByName(c.doc, p.target);
    if (!target) return;
    const k = Math.min(1, Math.max(0, Number(p.smooth ?? 0.1)));
    n.transform.x += (target.transform.x - n.transform.x) * k;
    n.transform.y += (target.transform.y - n.transform.y) * k;
    n.transform.z += (target.transform.z - n.transform.z) * k;
  },
  chase: (n, p, c) => {
    const target = findByName(c.doc, p.target);
    if (!target) return;
    const sp = Number(p.speed ?? (c.mode === "2d" ? 120 : 3));
    const dx = target.transform.x - n.transform.x;
    const dy = (c.mode === "2d" ? target.transform.y - n.transform.y : 0);
    const dz = (c.mode === "3d" ? target.transform.z - n.transform.z : 0);
    const m = Math.hypot(dx, dy, dz) || 1;
    n.transform.x += (dx / m) * sp * c.dt;
    if (c.mode === "2d") n.transform.y += (dy / m) * sp * c.dt;
    else n.transform.z += (dz / m) * sp * c.dt;
  },
  rotate: (n, p, c) => {
    const sp = Number(p.speed ?? 1);
    if (c.mode === "2d") n.transform.rz += sp * c.dt;
    else {
      n.transform.rx += (p.axis === "x" ? sp : 0) * c.dt;
      n.transform.ry += (p.axis === "y" || !p.axis ? sp : 0) * c.dt;
      n.transform.rz += (p.axis === "z" ? sp : 0) * c.dt;
    }
  },
  orbit: (n, p, c) => {
    const r = Number(p.radius ?? 5);
    const sp = Number(p.speed ?? 1);
    const s = c.state as any;
    s._t = (s._t || 0) + c.dt * sp;
    n.transform.x = Math.cos(s._t) * r;
    if (c.mode === "2d") n.transform.y = Math.sin(s._t) * r;
    else n.transform.z = Math.sin(s._t) * r;
  },
  oscillate: (n, p, c) => {
    const s = c.state as any;
    s._t = (s._t || 0) + c.dt;
    const amp = Number(p.amplitude ?? 50);
    const freq = Number(p.frequency ?? 1);
    const axis = (p.axis || "y") as "x" | "y" | "z";
    if (!(s as any)._origin) (s as any)._origin = { x: n.transform.x, y: n.transform.y, z: n.transform.z };
    const o = (s as any)._origin;
    const v = Math.sin(s._t * freq * Math.PI * 2) * amp;
    n.transform[axis] = o[axis] + v;
  },
  patrol: (n, p, c) => {
    const s = c.state as RuntimeState2D;
    if (s._dir === undefined) s._dir = 1;
    const sp = Number(p.speed ?? 60);
    const dist = Number(p.distance ?? 100);
    if (!(s as any)._origin) (s as any)._origin = n.transform.x;
    n.transform.x += sp * s._dir * c.dt;
    const orig = (s as any)._origin as number;
    if (n.transform.x > orig + dist) s._dir = -1;
    if (n.transform.x < orig - dist) s._dir = 1;
  },
  lookAt: (n, p, c) => {
    const target = findByName(c.doc, p.target);
    if (!target) return;
    if (c.mode === "2d") {
      n.transform.rz = Math.atan2(target.transform.y - n.transform.y, target.transform.x - n.transform.x);
    } else {
      n.transform.ry = Math.atan2(target.transform.x - n.transform.x, target.transform.z - n.transform.z);
    }
  },
  billboard: (n, _p, c) => {
    if (c.mode === "3d" && c.cameraPos) {
      n.transform.ry = Math.atan2(c.cameraPos.x - n.transform.x, c.cameraPos.z - n.transform.z);
    }
  },
  screenWrap: (n, p, c) => {
    if (c.mode !== "2d") return;
    const w = c.doc.settings.width / 2, h = c.doc.settings.height / 2;
    if (n.transform.x > w) n.transform.x = -w;
    if (n.transform.x < -w) n.transform.x = w;
    if (n.transform.y > h) n.transform.y = -h;
    if (n.transform.y < -h) n.transform.y = h;
    void p;
  },
  bounce: (n, p, c) => {
    const s = c.state as any;
    if (!s._bv) s._bv = { x: Number(p.speedX ?? 80), y: Number(p.speedY ?? 80) };
    n.transform.x += s._bv.x * c.dt;
    n.transform.y += s._bv.y * c.dt;
    const w = c.doc.settings.width / 2, h = c.doc.settings.height / 2;
    if (n.transform.x > w || n.transform.x < -w) s._bv.x *= -1;
    if (n.transform.y > h || n.transform.y < -h) s._bv.y *= -1;
  },
  destroyAfter: (n, p, c) => {
    const s = c.state as any;
    s._t = (s._t || 0) + c.dt;
    if (s._t > Number(p.seconds ?? 3)) (n as any).__destroy = true;
  },
  spawnInterval: (_n, p, c) => {
    const s = c.state as any;
    s._t = (s._t || 0) + c.dt;
    if (s._t > Number(p.interval ?? 1)) {
      s._t = 0;
      (c as any).__spawn = (c as any).__spawn || [];
      (c as any).__spawn.push({ template: p.template, x: p.x ?? 0, y: p.y ?? 0 });
    }
  },
  opacityPulse: (n, p, c) => {
    const s = c.state as any;
    s._t = (s._t || 0) + c.dt;
    const min = Number(p.min ?? 0.2), max = Number(p.max ?? 1);
    n.props.opacity = min + (max - min) * (0.5 + 0.5 * Math.sin(s._t * Number(p.speed ?? 2)));
  },
  scalePulse: (n, p, c) => {
    const s = c.state as any;
    s._t = (s._t || 0) + c.dt;
    const base = Number(p.base ?? 1), amp = Number(p.amplitude ?? 0.15);
    const v = base + Math.sin(s._t * Number(p.speed ?? 3)) * amp;
    n.transform.sx = v; n.transform.sy = v; if (c.mode === "3d") n.transform.sz = v;
  },
  dash: (n, p, c) => {
    const s = c.state as any;
    s._dashCd = (s._dashCd ?? 0) - c.dt;
    if (!c.input.wasPressed(String(p.key || "KeyK")) || s._dashCd > 0) return;
    const a = c.input.axis();
    const dist = Number(p.distance ?? (c.mode === "2d" ? 120 : 3));
    n.transform.x += (a.x || 1) * dist;
    if (c.mode === "2d") n.transform.y += a.y * dist;
    else n.transform.z += a.y * dist;
    s._dashCd = Number(p.cooldown ?? 0.6);
  },
  limitToMap: (n, _p, c) => {
    if (c.mode !== "2d") return;
    const w = c.doc.settings.width / 2;
    const h = c.doc.settings.height / 2;
    n.transform.x = Math.max(-w, Math.min(w, n.transform.x));
    n.transform.y = Math.max(-h, Math.min(h, n.transform.y));
  },
  teleportTo: (n, p, c) => {
    if (!c.input.wasPressed(String(p.key || "KeyT"))) return;
    n.transform.x = Number(p.x ?? 0);
    n.transform.y = Number(p.y ?? n.transform.y);
    if (c.mode === "3d") n.transform.z = Number(p.z ?? 0);
  },
  clickAction: () => { /* handled by runtime click handler */ },
  keyAction: (_n, _p, _c) => { /* runtime polls and runs script */ },
  onJoystick: (n, p, c) => {
    const dir = String(p.direction || "any");
    const d = c.input.dir();
    const active = dir === "any"
      ? (d.up || d.down || d.left || d.right)
      : !!(d as any)[dir];
    if (!active || !p.script) return;
    try {
      new Function("log", "self", "dt", p.script)(
        (m: any) => c.log?.(String(m)),
        { node: n, x: n.transform.x, y: n.transform.y, z: n.transform.z, props: n.props },
        c.dt,
      );
    } catch (e) { c.log?.("onJoystick: " + e); }
  },
  moveOnJoystick: (n, p, c) => {
    const sp = Number(p.speed ?? (c.mode === "2d" ? 200 : 4));
    const a = c.input.axis();
    const axes = String(p.axes || (c.mode === "2d" ? "xy" : "xz"));
    if (axes.includes("x")) n.transform.x += a.x * sp * c.dt;
    if (axes.includes("y")) n.transform.y += a.y * sp * c.dt;
    if (axes.includes("z")) n.transform.z += a.y * sp * c.dt;
  },
  // these two are dispatched by the runtime's collision pass; the registry
  // entries exist so behaviors.add(...) flows work and metadata shows up.
  onCollide: () => { /* runtime dispatches on overlap */ },
  damageOnContact: () => { /* runtime dispatches on overlap */ },
  playerAttack: (n, p, c) => {
    const s = c.state as any;
    s._atk = (s._atk ?? 0) - c.dt;
    if (!c.input.isAttack()) return;
    if (s._atk > 0) return;
    s._atk = Number(p.cooldown ?? 0.4);
    const range = Number(p.range ?? (c.mode === "2d" ? 90 : 2.2));
    const dmg = Number(p.damage ?? 1);
    const tag = String(p.targetTag || "enemy");
    const out: GameNode[] = [];
    const walk = (a: GameNode[]) => a.forEach((nn) => { out.push(nn); walk(nn.children); });
    walk(c.doc.nodes);
    let hit = 0;
    for (const t of out) {
      if (t === n) continue;
      if (String(t.props.collisionTag || "") !== tag) continue;
      const dx = t.transform.x - n.transform.x;
      const dy = c.mode === "2d" ? (t.transform.y - n.transform.y) : (t.transform.z - n.transform.z);
      if (Math.hypot(dx, dy) > range) continue;
      t.props.hp = Number(t.props.hp ?? 1) - dmg;
      hit++;
      c.log?.(`${n.name} hits ${t.name} (hp=${t.props.hp})`);
      if (t.props.hp <= 0) (t as any).__destroy = true;
    }
    if (hit === 0) c.log?.(`${n.name} attacks (no target in range)`);
  },
  shoot: (n, p, c) => {
    const s = c.state as any;
    s._shootCd = (s._shootCd ?? 0) - c.dt;
    if (s._shootCd > 0) return;
    s._shootCd = Number(p.cooldown ?? 1);
    const targetName = String(p.target || "Player");
    const target = findByName(c.doc, targetName);
    let dx = 1, dy = 0, dz = 0;
    if (target) {
      dx = target.transform.x - n.transform.x;
      if (c.mode === "2d") dy = target.transform.y - n.transform.y;
      else dz = target.transform.z - n.transform.z;
      const m = Math.hypot(dx, dy, dz) || 1;
      dx /= m; dy /= m; dz /= m;
    }
    const sp = Number(p.bulletSpeed ?? (c.mode === "2d" ? 360 : 8));
    const size = Number(p.bulletSize ?? (c.mode === "2d" ? 10 : 0.2));
    const color = String(p.bulletColor || "#ffffff");
    const dmg = Number(p.damage ?? 8);
    const life = Number(p.lifetime ?? 2.5);
    const tag = String(p.targetTag || "player");
    const bullet: GameNode = {
      id: "bullet_" + Math.random().toString(36).slice(2, 9),
      name: "Bullet",
      type: c.mode === "2d" ? "sprite" : "sphere",
      transform: { x: n.transform.x, y: n.transform.y, z: n.transform.z, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
      props: {
        w: size, h: size, r: size, color,
        collisionEnabled: true, isSensor: true, collisionTag: "bullet",
        __bullet: true, __vx: dx * sp, __vy: dy * sp, __vz: dz * sp,
        __life: life, __dmg: dmg, __targetTag: tag, __owner: n.id,
      },
      behaviors: [], children: [], visible: true,
    };
    c.doc.nodes.push(bullet);
  },
  // ============= POWERS =============
  superSpeed: (_n, p, c) => {
    // Hold the configured key (or "run" button) to multiply movement speed.
    const key = String(p.key || "ShiftLeft");
    const active = c.input.isDown(key) || c.input.buttons.has("run") || c.input.buttons.has("superSpeed");
    const mul = active ? Number(p.multiplier ?? 2.5) : 1;
    const s = c.state as any;
    if (c.mode === "2d") {
      (c.state as RuntimeState2D).vx *= mul;
    } else {
      const s3 = c.state as RuntimeState3D;
      s3.vx *= mul; s3.vz *= mul;
    }
    s._fxSpeed = active;
  },
  doubleJump: (_n, p, c) => {
    if (c.mode !== "2d") return;
    const s = c.state as RuntimeState2D & { _jumpCount?: number; _jumpHeldDJ?: boolean };
    if (s.grounded) s._jumpCount = 0;
    const pressing = c.input.isJump();
    if (pressing && !s._jumpHeldDJ && !s.grounded && (s._jumpCount ?? 0) < Number(p.maxJumps ?? 2) - 1) {
      s.vy = -Number(p.force ?? 480);
      s._jumpCount = (s._jumpCount ?? 0) + 1;
      c.log?.("Double jump!");
    }
    s._jumpHeldDJ = pressing;
  },
  shield: (n, p, c) => {
    // While button "shield" or chosen key is held, incoming damage is reduced.
    const active = c.input.buttons.has("shield") || c.input.isDown(String(p.key || "KeyQ"));
    n.props.__shielded = active;
    n.props.__shieldReduce = Number(p.reduce ?? 0.8); // 80% reduction
  },
  healOverTime: (n, p, c) => {
    const s = c.state as any;
    s._healT = (s._healT || 0) + c.dt;
    const period = Number(p.interval ?? 1);
    if (s._healT < period) return;
    s._healT = 0;
    const max = Number(n.props.maxHp ?? 100);
    n.props.hp = Math.min(max, Number(n.props.hp ?? max) + Number(p.amount ?? 2));
  },
  gravityFlip: (_n, p, c) => {
    if (!c.input.wasPressed(String(p.key || "KeyG"))) return;
    c.doc.settings.gravity = -c.doc.settings.gravity;
    c.log?.("Gravity flipped: " + c.doc.settings.gravity);
  },
  timeSlow: (_n, p, c) => {
    // Toggle slow-mo: cuts dt for subsequent physics by scaling.
    const active = c.input.buttons.has("slowmo") || c.input.isDown(String(p.key || "KeyV"));
    (c as any).__timeScale = active ? Number(p.scale ?? 0.4) : 1;
  },
};

function findByName(doc: SceneDoc, name: string): GameNode | null {
  const w = (a: GameNode[]): GameNode | null => {
    for (const n of a) { if (n.name === name) return n; const c = w(n.children); if (c) return c; }
    return null;
  };
  return w(doc.nodes);
}

export const BEHAVIOR_META: Record<string, { label: string; mode?: "2d" | "3d" | "any"; params: { key: string; type: "number" | "text" | "boolean"; default: any; label: string }[] }> = {
  walk:        { label: "Walk",       mode: "any", params: [{ key: "speed", type: "number", default: 260, label: "Speed" }, { key: "runMul", type: "number", default: 1.6, label: "Run multiplier" }] },
  jump:        { label: "Jump",       mode: "any", params: [{ key: "force", type: "number", default: 520, label: "2D Force" }, { key: "height", type: "number", default: 1.6, label: "3D Height" }] },
  platformer:  { label: "Platformer", mode: "2d",  params: [{ key: "speed", type: "number", default: 260, label: "Speed" }, { key: "runMul", type: "number", default: 1.8, label: "Run mul" }, { key: "force", type: "number", default: 520, label: "Jump force" }] },
  topdown:     { label: "Top-down",   mode: "any", params: [{ key: "speed", type: "number", default: 220, label: "Speed" }, { key: "runMul", type: "number", default: 1.5, label: "Run mul" }] },
  follow:      { label: "Follow",     mode: "any", params: [{ key: "target", type: "text", default: "Player", label: "Target name" }, { key: "smooth", type: "number", default: 0.1, label: "Smooth (0-1)" }] },
  chase:       { label: "Chase",      mode: "any", params: [{ key: "target", type: "text", default: "Player", label: "Target" }, { key: "speed", type: "number", default: 120, label: "Speed" }] },
  rotate:      { label: "Rotate",     mode: "any", params: [{ key: "speed", type: "number", default: 1, label: "Speed (rad/s)" }, { key: "axis", type: "text", default: "y", label: "Axis x/y/z" }] },
  orbit:       { label: "Orbit",      mode: "any", params: [{ key: "radius", type: "number", default: 5, label: "Radius" }, { key: "speed", type: "number", default: 1, label: "Speed" }] },
  oscillate:   { label: "Oscillate",  mode: "any", params: [{ key: "amplitude", type: "number", default: 50, label: "Amplitude" }, { key: "frequency", type: "number", default: 1, label: "Frequency" }, { key: "axis", type: "text", default: "y", label: "Axis" }] },
  patrol:      { label: "Patrol",     mode: "2d",  params: [{ key: "distance", type: "number", default: 120, label: "Distance" }, { key: "speed", type: "number", default: 80, label: "Speed" }] },
  lookAt:      { label: "Look At",    mode: "any", params: [{ key: "target", type: "text", default: "Player", label: "Target" }] },
  billboard:   { label: "Billboard",  mode: "3d",  params: [] },
  screenWrap:  { label: "Screen Wrap", mode: "2d", params: [] },
  bounce:      { label: "Bounce",     mode: "2d",  params: [{ key: "speedX", type: "number", default: 100, label: "Speed X" }, { key: "speedY", type: "number", default: 80, label: "Speed Y" }] },
  destroyAfter:{ label: "Destroy After", mode: "any", params: [{ key: "seconds", type: "number", default: 3, label: "Seconds" }] },
  opacityPulse:{ label: "Opacity Pulse", mode: "any", params: [{ key: "min", type: "number", default: 0.2, label: "Min" }, { key: "max", type: "number", default: 1, label: "Max" }, { key: "speed", type: "number", default: 2, label: "Speed" }] },
  scalePulse:  { label: "Scale Pulse", mode: "any", params: [{ key: "base", type: "number", default: 1, label: "Base" }, { key: "amplitude", type: "number", default: 0.15, label: "Amplitude" }, { key: "speed", type: "number", default: 3, label: "Speed" }] },
  dash:        { label: "Dash", mode: "any", params: [{ key: "key", type: "text", default: "KeyK", label: "Key code" }, { key: "distance", type: "number", default: 120, label: "Distance" }, { key: "cooldown", type: "number", default: 0.6, label: "Cooldown" }] },
  limitToMap:  { label: "Limit To Map", mode: "2d", params: [] },
  teleportTo:  { label: "Teleport To", mode: "any", params: [{ key: "key", type: "text", default: "KeyT", label: "Key code" }, { key: "x", type: "number", default: 0, label: "X" }, { key: "y", type: "number", default: 0, label: "Y" }, { key: "z", type: "number", default: 0, label: "Z" }] },
  clickAction: { label: "On Click",   mode: "any", params: [{ key: "script", type: "text", default: "log('clicked')", label: "JS to run" }] },
  keyAction:   { label: "On Key",     mode: "any", params: [{ key: "key", type: "text", default: "KeyE", label: "Key code" }, { key: "script", type: "text", default: "log('pressed')", label: "JS to run" }] },
  onJoystick:  { label: "On Joystick", mode: "any", params: [{ key: "direction", type: "text", default: "any", label: "Direction (up/down/left/right/any)" }, { key: "script", type: "text", default: "log('joy')", label: "JS to run" }] },
  moveOnJoystick: { label: "Move on Joystick", mode: "any", params: [{ key: "speed", type: "number", default: 200, label: "Speed" }, { key: "axes", type: "text", default: "xy", label: "Axes (xy / xz)" }] },
  onCollide:   { label: "On Collide", mode: "any", params: [{ key: "script", type: "text", default: "log('hit ' + other.name)", label: "JS — vars: self, other, log" }] },
  damageOnContact: { label: "Damage on Contact", mode: "any", params: [{ key: "damage", type: "number", default: 10, label: "Damage" }, { key: "targetTag", type: "text", default: "player", label: "Target tag" }, { key: "interval", type: "number", default: 0.6, label: "Hit interval (s)" }] },
  playerAttack: { label: "Player Attack", mode: "any", params: [{ key: "damage", type: "number", default: 1, label: "Damage / hit" }, { key: "range", type: "number", default: 90, label: "Range" }, { key: "cooldown", type: "number", default: 0.4, label: "Cooldown (s)" }, { key: "targetTag", type: "text", default: "enemy", label: "Target tag" }] },
  shoot:       { label: "Shoot Bullets", mode: "any", params: [
    { key: "target", type: "text", default: "Player", label: "Target name" },
    { key: "cooldown", type: "number", default: 1, label: "Cooldown (s)" },
    { key: "bulletSpeed", type: "number", default: 360, label: "Bullet speed" },
    { key: "bulletSize", type: "number", default: 10, label: "Bullet size" },
    { key: "bulletColor", type: "text", default: "#ffffff", label: "Bullet color" },
    { key: "damage", type: "number", default: 8, label: "Damage" },
    { key: "lifetime", type: "number", default: 2.5, label: "Lifetime (s)" },
    { key: "targetTag", type: "text", default: "player", label: "Hit tag" },
  ] },
  superSpeed:  { label: "Super Speed (power)", mode: "any", params: [{ key: "multiplier", type: "number", default: 2.5, label: "Speed ×" }, { key: "key", type: "text", default: "ShiftLeft", label: "Key (or button 'run')" }] },
  doubleJump:  { label: "Double Jump (power)", mode: "2d",  params: [{ key: "maxJumps", type: "number", default: 2, label: "Max jumps" }, { key: "force", type: "number", default: 480, label: "Extra jump force" }] },
  shield:      { label: "Shield (power)",      mode: "any", params: [{ key: "reduce", type: "number", default: 0.8, label: "Damage reduce (0-1)" }, { key: "key", type: "text", default: "KeyQ", label: "Key (or button 'shield')" }] },
  healOverTime:{ label: "Heal Over Time",      mode: "any", params: [{ key: "amount", type: "number", default: 2, label: "HP / tick" }, { key: "interval", type: "number", default: 1, label: "Interval (s)" }] },
  gravityFlip: { label: "Gravity Flip (power)", mode: "any", params: [{ key: "key", type: "text", default: "KeyG", label: "Trigger key" }] },
  timeSlow:    { label: "Time Slow (power)",   mode: "any", params: [{ key: "scale", type: "number", default: 0.4, label: "Time scale" }, { key: "key", type: "text", default: "KeyV", label: "Key (or button 'slowmo')" }] },
};
