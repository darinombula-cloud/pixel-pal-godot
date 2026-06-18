import type { GameNode, SceneDoc } from "./types";
import { Input } from "./input";
import { runBehaviors, type RuntimeState2D } from "./behaviors";

interface NodeState {
  rt: RuntimeState2D;
  scriptApi?: any;
  scriptError?: string;
  overlap: Set<string>;
}

const PHYSICS_TYPES = new Set(["player2d", "rigidBody2d"]);

function isCollider(n: GameNode) {
  if (n.props.collisionEnabled === false) return false;
  if (n.props.collisionEnabled === true) return true;
  // legacy fallback so existing nodes still work
  return !!n.props.solid || PHYSICS_TYPES.has(n.type) || n.type === "area2d" || n.type === "staticBody2d";
}
function isSensor(n: GameNode) {
  return n.props.isSensor === true || n.type === "area2d";
}
function colliderTag(n: GameNode) {
  if (n.props.collisionTag) return String(n.props.collisionTag);
  if (n.type === "player2d") return "player";
  if (n.type === "area2d") return "trigger";
  if (n.type === "staticBody2d") return "static";
  return n.type;
}

export class Runtime2D {
  doc: SceneDoc;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  input = new Input();
  states = new Map<string, NodeState>();
  raf = 0;
  last = 0;
  running = false;
  cam = { x: 0, y: 0, zoom: 1 };
  onLog?: (msg: string) => void;
  images: Record<string, HTMLImageElement> = {};
  audios: HTMLAudioElement[] = [];

  constructor(doc: SceneDoc, canvas: HTMLCanvasElement) {
    this.doc = doc; this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
  }

  start() {
    this.input.attach(this.canvas);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.running = true;
    this.last = performance.now();
    this.preload();
    this.setupAudio();
    this.initScripts();
    this.raf = requestAnimationFrame(this.tick);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.audios.forEach((a) => { a.pause(); a.currentTime = 0; });
    this.audios = [];
  }

  preload() {
    const add = (url: any) => {
      if (typeof url !== "string" || !url || this.images[url]) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      this.images[url] = img;
    };
    for (const n of this.allNodes()) {
      add(n.props.image);
      const a = n.props.animations;
      if (a && typeof a === "object") for (const u of Object.values(a)) add(u);
    }
  }

  private allNodes(): GameNode[] {
    const out: GameNode[] = [];
    const w = (a: GameNode[]) => a.forEach((n) => { if (n.visible !== false) { out.push(n); w(n.children); } });
    w(this.doc.nodes);
    return out;
  }

  private setupAudio() {
    this.audios = [];
    for (const n of this.allNodes()) {
      if (n.type !== "audio2d" || !n.props.url) continue;
      const audio = new Audio(String(n.props.url));
      audio.loop = !!n.props.loop;
      audio.volume = Math.max(0, Math.min(1, Number(n.props.volume ?? 1)));
      this.audios.push(audio);
      if (n.props.autoplay) audio.play().catch((e) => this.onLog?.("audio: " + e));
    }
  }

  private stateOf(n: GameNode): NodeState {
    let s = this.states.get(n.id);
    if (!s) { s = { rt: { vx: 0, vy: 0, grounded: false }, overlap: new Set() }; this.states.set(n.id, s); }
    return s;
  }

  private initScripts() {
    for (const n of this.allNodes()) {
      const s = this.stateOf(n);
      if (n.script) this.compile(n, s);
    }
  }

  /** Public: recompile a single node's script (e.g. on live-edit). */
  recompileScript(id: string) {
    const n = this.allNodes().find((x) => x.id === id);
    if (!n) return;
    const s = this.stateOf(n);
    if (n.script) this.compile(n, s);
    else { s.scriptApi = undefined; s.scriptError = undefined; }
  }

  private compile(n: GameNode, s: NodeState) {
    try {
      const api = this.makeApi(n);
      const body = n.script + "\nreturn { onStart: typeof onStart!=='undefined'?onStart:null, onUpdate: typeof onUpdate!=='undefined'?onUpdate:null, onCollide: typeof onCollide!=='undefined'?onCollide:null, onClick: typeof onClick!=='undefined'?onClick:null, onKey: typeof onKey!=='undefined'?onKey:null };";
      const fn = new Function("self", "scene", "input", "log", body);
      const exp = fn(api, this.sceneApi(), this.input, (m: any) => this.onLog?.(String(m)));
      s.scriptApi = exp;
      s.scriptError = undefined;
      try { exp?.onStart?.(); } catch (e) { this.onLog?.("onStart: " + e); }
    } catch (e: any) {
      s.scriptError = String(e?.message || e);
      this.onLog?.("compile [" + n.name + "]: " + s.scriptError);
    }
  }

  private makeApi(n: GameNode) {
    return {
      get x() { return n.transform.x; }, set x(v: number) { n.transform.x = v; },
      get y() { return n.transform.y; }, set y(v: number) { n.transform.y = v; },
      get rotation() { return n.transform.rz; }, set rotation(v: number) { n.transform.rz = v; },
      props: n.props, node: n, name: n.name,
    };
  }
  private sceneApi() {
    return {
      find: (name: string) => this.allNodes().find((n) => n.name === name),
      all: () => this.allNodes(),
    };
  }

  private onPointerDown = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (this.canvas.width / r.width) - this.canvas.width / 2 + this.cam.x;
    const my = (e.clientY - r.top) * (this.canvas.height / r.height) - this.canvas.height / 2 + this.cam.y;
    for (const n of this.allNodes()) {
      const w = n.props.w ?? 0, h = n.props.h ?? 0;
      if (Math.abs(mx - n.transform.x) < w / 2 && Math.abs(my - n.transform.y) < h / 2) {
        for (const b of n.behaviors) {
          if (b.kind === "clickAction" && b.params.script) {
            try { new Function("log", "self", b.params.script)((m: any) => this.onLog?.(String(m)), this.makeApi(n)); }
            catch (err) { this.onLog?.("click: " + err); }
          }
        }
        const s = this.stateOf(n);
        try { s.scriptApi?.onClick?.(); } catch (err) { this.onLog?.("onClick: " + err); }
        if (n.type === "button") this.onLog?.(`Button "${n.name}" clicked`);
      }
    }
  };

  tick = (t: number) => {
    if (!this.running) return;
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.update(dt);
    this.render();
    this.input.endFrame();
    this.raf = requestAnimationFrame(this.tick);
  };

  private collectSolids(): GameNode[] {
    const solids = this.allNodes().filter((n) => isCollider(n) && !isSensor(n));
    const g = this.doc.settings.ground2d;
    if (g.enabled) {
      solids.push({
        id: "__ground", name: "__ground", type: "staticBody2d",
        transform: { x: 0, y: g.y, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
        props: { w: g.infinite ? 1e6 : g.width, h: g.height, color: g.color, solid: true, collisionEnabled: true },
        behaviors: [], children: [],
      });
    }
    return solids;
  }

  private update(dt: number) {
    const g = this.doc.settings.gravity;
    const solids = this.collectSolids();
    const all = this.allNodes();

    // KEY ACTION (behavior) + script onKey hook
    for (const n of all) {
      for (const b of n.behaviors) {
        if (b.kind === "keyAction" && b.params.key && this.input.wasPressed(b.params.key) && b.params.script) {
          try { new Function("log", "self", b.params.script)((m: any) => this.onLog?.(String(m)), this.makeApi(n)); }
          catch (err) { this.onLog?.("key: " + err); }
        }
      }
      const s = this.stateOf(n);
      if (s.scriptApi?.onKey) {
        for (const code of this.input.pressed) {
          try { s.scriptApi.onKey(code); } catch (e) { this.onLog?.("onKey: " + e); }
        }
      }
    }

    for (const n of all) {
      const s = this.stateOf(n);
      runBehaviors(n, { doc: this.doc, input: this.input, dt, state: s.rt, mode: "2d", solids, log: this.onLog });

      if (PHYSICS_TYPES.has(n.type)) {
        if (n.type === "player2d" || (n.type === "rigidBody2d" && n.props.gravity !== false)) {
          s.rt.vy += g * dt;
        }
        n.transform.x += s.rt.vx * dt;
        for (const sd of solids) {
          if (sd.id === n.id) continue;
          if (this.aabb(n, sd)) {
            if (s.rt.vx > 0) n.transform.x = sd.transform.x - sd.props.w / 2 - (n.props.w ?? 1) / 2;
            else if (s.rt.vx < 0) n.transform.x = sd.transform.x + sd.props.w / 2 + (n.props.w ?? 1) / 2;
            s.rt.vx = 0;
          }
        }
        n.transform.y += s.rt.vy * dt;
        s.rt.grounded = false;
        for (const sd of solids) {
          if (sd.id === n.id) continue;
          if (this.aabb(n, sd)) {
            if (s.rt.vy > 0) { n.transform.y = sd.transform.y - sd.props.h / 2 - (n.props.h ?? 1) / 2; s.rt.grounded = true; }
            else if (s.rt.vy < 0) n.transform.y = sd.transform.y + sd.props.h / 2 + (n.props.h ?? 1) / 2;
            s.rt.vy = 0;
          }
        }
        if (s.rt.grounded && Math.abs(this.input.axis().x) < 0.05 && !s.rt.vx) s.rt.vx = 0;
      }

      if (s.scriptApi?.onUpdate) {
        try { s.scriptApi.onUpdate(dt); } catch (e) { this.onLog?.("onUpdate: " + e); }
      }
    }

    // ---- Bullet step (lightweight, sensor-only) ----
    for (const n of all) {
      if (!n.props.__bullet) continue;
      n.transform.x += Number(n.props.__vx || 0) * dt;
      n.transform.y += Number(n.props.__vy || 0) * dt;
      n.props.__life = Number(n.props.__life ?? 0) - dt;
      if (n.props.__life <= 0) (n as any).__destroy = true;
      const tag = String(n.props.__targetTag || "player");
      for (const t of all) {
        if (t === n || t.id === n.props.__owner) continue;
        if (String(t.props.collisionTag || "") !== tag) continue;
        if (this.aabb(n, t)) {
          t.props.hp = Number(t.props.hp ?? 100) - Number(n.props.__dmg ?? 0);
          this.onLog?.(`Bullet hit ${t.name} (hp=${t.props.hp})`);
          if (t.props.hp <= 0) (t as any).__destroy = true;
          (n as any).__destroy = true;
          break;
        }
      }
    }

    // ---- Generalized collision dispatch (sensors + onCollide + damageOnContact) ----
    const colliders = all.filter(isCollider);
    for (let i = 0; i < colliders.length; i++) {
      for (let j = i + 1; j < colliders.length; j++) {
        const a = colliders[i], b = colliders[j];
        const hit = this.aabb(a, b);
        const sa = this.stateOf(a), sb = this.stateOf(b);
        const wasHit = sa.overlap.has(b.id);
        if (hit) {
          if (!wasHit) {
            sa.overlap.add(b.id); sb.overlap.add(a.id);
            this.dispatchCollide(a, b); this.dispatchCollide(b, a);
          }
          // continuous damage tick
          this.tickDamage(a, b, dt);
          this.tickDamage(b, a, dt);
        } else if (wasHit) {
          sa.overlap.delete(b.id); sb.overlap.delete(a.id);
        }
      }
    }

    // Cleanup destroyed nodes
    const destroy = (arr: GameNode[]) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        if ((arr[i] as any).__destroy) { this.states.delete(arr[i].id); arr.splice(i, 1); }
        else destroy(arr[i].children);
      }
    };
    destroy(this.doc.nodes);

    // Camera follow with offset + lerp
    const cam = all.find((n) => n.type === "camera2d");
    if (cam) {
      const followName: string = cam.props.follow;
      const follow = followName ? all.find((n) => n.name === followName || n.id === followName) : null;
      const ox = Number(cam.props.offsetX ?? 0);
      const oy = Number(cam.props.offsetY ?? 0);
      const k = Math.max(0, Math.min(1, Number(cam.props.lerp ?? 1)));
      const tx = (follow ? follow.transform.x : cam.transform.x) + ox;
      const ty = (follow ? follow.transform.y : cam.transform.y) + oy;
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
      this.cam.zoom = cam.props.zoom || 1;
    }
  }

  private dispatchCollide(self: GameNode, other: GameNode) {
    const s = this.stateOf(self);
    // script onCollide
    if (s.scriptApi?.onCollide) {
      try { s.scriptApi.onCollide({ node: other, name: other.name, tag: colliderTag(other) }); }
      catch (e) { this.onLog?.("onCollide: " + e); }
    }
    // behavior onCollide (script only — damageOnContact ticks elsewhere)
    for (const b of self.behaviors) {
      if (b.kind === "onCollide" && b.params.script) {
        try {
          new Function("log", "self", "other", b.params.script)(
            (m: any) => this.onLog?.(String(m)),
            this.makeApi(self),
            { node: other, name: other.name, tag: colliderTag(other), props: other.props },
          );
        } catch (e) { this.onLog?.("onCollide behavior: " + e); }
      }
    }
  }

  private tickDamage(self: GameNode, other: GameNode, dt: number) {
    const s = this.stateOf(self) as any;
    s._dmgT = s._dmgT || {};
    for (const b of self.behaviors) {
      if (b.kind !== "damageOnContact") continue;
      const tag = String(b.params.targetTag || "player");
      if (colliderTag(other) !== tag) continue;
      const key = b.kind + ":" + other.id;
      s._dmgT[key] = (s._dmgT[key] ?? 0) - dt;
      if (s._dmgT[key] > 0) continue;
      s._dmgT[key] = Number(b.params.interval ?? 0.6);
      const dmg = Number(b.params.damage ?? 10);
      other.props.hp = Number(other.props.hp ?? 100) - dmg;
      this.onLog?.(`${self.name} hit ${other.name} for ${dmg} (hp=${other.props.hp})`);
      if (other.props.hp <= 0) (other as any).__destroy = true;
    }
  }

  private aabb(a: GameNode, b: GameNode) {
    const aw = Number(a.props.collisionW ?? a.props.w ?? 1);
    const ah = Number(a.props.collisionH ?? a.props.h ?? 1);
    const bw = Number(b.props.collisionW ?? b.props.w ?? 1);
    const bh = Number(b.props.collisionH ?? b.props.h ?? 1);
    return Math.abs(a.transform.x - b.transform.x) < (aw + bw) / 2 &&
           Math.abs(a.transform.y - b.transform.y) < (ah + bh) / 2;
  }

  render() {
    const { ctx, canvas } = this;
    ctx.fillStyle = this.doc.settings.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    const g = this.doc.settings.ground2d;
    if (g.enabled) {
      ctx.fillStyle = g.color;
      const w = g.infinite ? canvas.width / this.cam.zoom + 200 : g.width;
      ctx.fillRect(-w / 2 + this.cam.x, g.y - g.height / 2, w, g.height);
    }

    for (const n of this.allNodes()) this.drawNode(n);
    ctx.restore();
  }

  private drawNode(n: GameNode) {
    const { ctx } = this;
    const { x, y, rz, sx, sy } = n.transform;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rz);
    ctx.scale(sx, sy);
    const style = n.style || {};
    const opacity = n.props.opacity ?? style.opacity ?? 1;
    ctx.globalAlpha = opacity;
    const radius = Number(style.borderRadius ?? 0);

    const fillRR = (w: number, h: number, fill: string) => {
      ctx.fillStyle = fill;
      if (radius > 0 && (ctx as any).roundRect) {
        ctx.beginPath(); (ctx as any).roundRect(-w/2, -h/2, w, h, radius); ctx.fill();
      } else ctx.fillRect(-w/2, -h/2, w, h);
    };

    if (n.props.__bullet) {
      const r = Number(n.props.r ?? n.props.w ?? 6) / 2;
      ctx.fillStyle = n.props.color || "#ffffff";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
      return;
    }

    switch (n.type) {
      case "sprite":
      case "animatedSprite":
      case "player2d":
      case "rigidBody2d":
      case "staticBody2d": {
        const w = n.props.w ?? 40, h = n.props.h ?? 40;
        let url: string | undefined = n.props.image;
        let flip = false;
        if (n.type === "player2d") {
          const anims = (n.props.animations || {}) as Record<string, string>;
          const st = this.stateOf(n).rt;
          const ax = this.input.axis().x;
          const hurt = (n.props.hp ?? Infinity) < (n.props.maxHp ?? 100) * 0.25;
          let key: string;
          if (!st.grounded || Math.abs(st.vy) > 30) key = "jump";
          else if (this.input.isRun() && Math.abs(ax) > 0.1) key = "run";
          else if (Math.abs(ax) > 0.1 || Math.abs(st.vx) > 20) key = "walk";
          else key = "idle";
          if (hurt && anims.hurt) key = "hurt";
          if ((n.props.hp ?? 1) <= 0 && anims.die) key = "die";
          url = anims[key] || anims.idle || anims.walk || n.props.image;
          if (ax < -0.1) flip = true;
        }
        const img = url && this.images[url];
        if (flip) { ctx.save(); ctx.scale(-1, 1); }
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, -w/2, -h/2, w, h);
        } else fillRR(w, h, n.props.color || "#7bf1a8");
        if (flip) ctx.restore();
        break;
      }
      case "panel": fillRR(n.props.w ?? 100, n.props.h ?? 100, n.props.color || "#0f2a1e"); break;
      case "area2d": fillRR(n.props.w ?? 40, n.props.h ?? 40, n.props.color || "#22c08a55"); break;
      case "text": {
        ctx.fillStyle = style.color || n.props.color || "#fff";
        ctx.font = `${style.fontWeight || ""} ${n.props.size || 20}px ${n.props.font || "system-ui"}`.trim();
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(n.props.text || "", 0, 0);
        break;
      }
      case "button": {
        const w = n.props.w ?? 120, h = n.props.h ?? 40;
        fillRR(w, h, n.props.color || "#22c08a");
        ctx.fillStyle = style.color || "#0a1612"; ctx.font = `${style.fontWeight || 700} 14px system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(n.props.label || "Button", 0, 0);
        break;
      }
      case "line2d": {
        const pts = String(n.props.points || "").split(/\s+/).map((p) => p.split(",").map(Number));
        ctx.strokeStyle = n.props.color || "#7bf1a8";
        ctx.lineWidth = n.props.width || 2;
        ctx.beginPath();
        pts.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
        ctx.stroke();
        break;
      }
      case "polygon2d": {
        const pts = String(n.props.points || "").split(/\s+/).map((p) => p.split(",").map(Number));
        ctx.fillStyle = n.props.color || "#22c08a";
        ctx.beginPath();
        pts.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
        ctx.closePath(); ctx.fill();
        break;
      }
      case "tilemap": {
        const ts = n.props.tileSize || 32;
        const rows = String(n.props.grid || "").split("\n").map((r) => r.split(",").map(Number));
        ctx.fillStyle = n.props.color || "#1c3a2a";
        rows.forEach((row, ry) => row.forEach((v, cx) => { if (v) ctx.fillRect(cx * ts, ry * ts, ts, ts); }));
        break;
      }
      case "light2d": {
        const r = n.props.radius || 200;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        grad.addColorStop(0, (n.props.color || "#fff") + Math.round((n.props.intensity ?? 0.6) * 255).toString(16).padStart(2, "0"));
        grad.addColorStop(1, "#0000");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "particles2d": {
        const c = n.props.count || 16;
        const sp = n.props.spread || 50;
        ctx.fillStyle = n.props.color || "#7bf1a8";
        for (let i = 0; i < c; i++) {
          const a = (i / c) * Math.PI * 2 + performance.now() / 1000;
          ctx.beginPath(); ctx.arc(Math.cos(a) * sp * (0.5 + 0.5 * Math.sin(i)), Math.sin(a) * sp, 2, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "camera2d":
        ctx.strokeStyle = "#7bf1a8"; ctx.lineWidth = 2;
        ctx.strokeRect(-80, -45, 160, 90);
        break;
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
