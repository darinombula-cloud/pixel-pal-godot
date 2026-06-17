import * as THREE from "three";
import type { GameNode, SceneDoc } from "./types";
import { Input } from "./input";
import { runBehaviors, type RuntimeState3D } from "./behaviors";

interface NodeState {
  obj: THREE.Object3D;
  rt: RuntimeState3D;
  scriptApi?: any;
  scriptError?: string;
  overlap: Set<string>;
  lastSize?: { w: number; h: number; d: number; r: number };
}
const PHYSICS_TYPES = new Set(["player3d", "rigidBody3d"]);

function isCollider(n: GameNode) {
  if (n.props.collisionEnabled === false) return false;
  if (n.props.collisionEnabled === true) return true;
  return !!n.props.solid || PHYSICS_TYPES.has(n.type) || n.type === "area3d" || n.type === "staticBody3d";
}
function isSensor(n: GameNode) { return n.props.isSensor === true || n.type === "area3d"; }
function colliderTag(n: GameNode) {
  if (n.props.collisionTag) return String(n.props.collisionTag);
  if (n.type === "player3d") return "player";
  if (n.type === "area3d") return "trigger";
  return n.type;
}

export class Runtime3D {
  doc: SceneDoc;
  container: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  input = new Input();
  states = new Map<string, NodeState>();
  raf = 0;
  last = 0;
  running = false;
  onLog?: (m: string) => void;
  private resizeObs?: ResizeObserver;
  private rapierWorld: any = null;
  private rapierBodies = new Map<string, any>();
  private RAPIER: any = null;
  private texLoader = new THREE.TextureLoader();
  private camSmooth = new THREE.Vector3();
  private audios: HTMLAudioElement[] = [];

  constructor(doc: SceneDoc, container: HTMLElement) {
    this.doc = doc; this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.tabIndex = 0;
    this.scene.background = new THREE.Color(doc.settings.background);
    this.resize();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
  }

  private resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 450;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  async start() {
    this.input.attach(this.renderer.domElement);
    this.build();
    this.setupAudio();
    if (this.doc.settings.usePhysics3d) await this.initRapier();
    this.running = true;
    this.last = performance.now();
    this.initScripts();
    this.raf = requestAnimationFrame(this.tick);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.audios.forEach((a) => { a.pause(); a.currentTime = 0; });
    this.audios = [];
  }
  dispose() { this.stop(); this.resizeObs?.disconnect(); this.renderer.dispose(); this.renderer.domElement.remove(); }

  private async initRapier() {
    try {
      const RAPIER = await import("@dimforge/rapier3d-compat");
      await RAPIER.init();
      this.RAPIER = RAPIER;
      const g = this.doc.settings.gravity;
      this.rapierWorld = new RAPIER.World({ x: 0, y: -g, z: 0 });
      for (const n of this.allNodes()) {
        if (!isCollider(n)) continue;
        const isDynamic = PHYSICS_TYPES.has(n.type);
        const bodyDesc = isDynamic
          ? RAPIER.RigidBodyDesc.dynamic().setTranslation(n.transform.x, n.transform.y, n.transform.z)
          : RAPIER.RigidBodyDesc.fixed().setTranslation(n.transform.x, n.transform.y, n.transform.z);
        const body = this.rapierWorld.createRigidBody(bodyDesc);
        const w = (n.props.w ?? 1) / 2, h = (n.props.h ?? 1) / 2, d = (n.props.d ?? 1) / 2;
        const r = n.props.r ?? 0.5;
        let col;
        if (n.type === "sphere") col = RAPIER.ColliderDesc.ball(r);
        else if (n.type === "capsule" || n.type === "player3d") col = RAPIER.ColliderDesc.capsule((n.props.h ?? 1) / 2, r);
        else if (n.type === "cylinder") col = RAPIER.ColliderDesc.cylinder((n.props.h ?? 1) / 2, r);
        else col = RAPIER.ColliderDesc.cuboid(w, h, d);
        if (isSensor(n)) col.setSensor(true);
        this.rapierWorld.createCollider(col, body);
        this.rapierBodies.set(n.id, body);
      }
      this.onLog?.("Rapier physics initialized");
    } catch (e) { this.onLog?.("Rapier init failed: " + e); }
  }

  private allNodes(): GameNode[] {
    const out: GameNode[] = [];
    const w = (a: GameNode[]) => a.forEach((n) => { out.push(n); w(n.children); });
    w(this.doc.nodes);
    return out;
  }

  private setupAudio() {
    this.audios = [];
    for (const n of this.allNodes()) {
      if (n.type !== "audio3d" || !n.props.url) continue;
      const audio = new Audio(String(n.props.url));
      audio.loop = !!n.props.loop;
      audio.volume = Math.max(0, Math.min(1, Number(n.props.volume ?? 1)));
      this.audios.push(audio);
      if (n.props.autoplay) audio.play().catch((e) => this.onLog?.("audio: " + e));
    }
  }

  private build() {
    while (this.scene.children.length) this.scene.remove(this.scene.children[0]);
    this.states.clear();
    for (const n of this.allNodes()) {
      const obj = this.makeObject(n);
      if (obj) {
        this.scene.add(obj);
        this.states.set(n.id, {
          obj, rt: { vx: 0, vy: 0, vz: 0, grounded: false }, overlap: new Set(),
          lastSize: this.sizeKey(n),
        });
      }
    }
    const cam = this.allNodes().find((n) => n.type === "camera3d");
    if (cam) { this.camera.position.set(cam.transform.x, cam.transform.y, cam.transform.z); this.camera.lookAt(0, 1, 0); }
    this.camSmooth.copy(this.camera.position);
  }

  private sizeKey(n: GameNode) {
    return { w: Number(n.props.w ?? 1), h: Number(n.props.h ?? 1), d: Number(n.props.d ?? 1), r: Number(n.props.r ?? 0.5) };
  }

  private rebuildGeometry(n: GameNode, s: NodeState) {
    const mesh = s.obj as THREE.Mesh;
    if (!mesh || !mesh.geometry) return;
    let geo: THREE.BufferGeometry | null = null;
    switch (n.type) {
      case "box":
      case "rigidBody3d":
      case "staticBody3d":
        geo = new THREE.BoxGeometry(n.props.w ?? 1, n.props.h ?? 1, n.props.d ?? 1); break;
      case "sphere": geo = new THREE.SphereGeometry(n.props.r ?? 0.5, 24, 16); break;
      case "cylinder": geo = new THREE.CylinderGeometry(n.props.r ?? 0.5, n.props.r ?? 0.5, n.props.h ?? 1, 24); break;
      case "capsule": geo = new THREE.CapsuleGeometry(n.props.r ?? 0.4, n.props.h ?? 1, 4, 12); break;
      case "plane": geo = new THREE.PlaneGeometry(n.props.w ?? 10, n.props.h ?? 10); break;
      case "player3d": geo = new THREE.CapsuleGeometry(n.props.r ?? 0.4, n.props.h ?? 1.6, 4, 12); break;
      case "area3d": geo = new THREE.BoxGeometry(n.props.w ?? 1, n.props.h ?? 1, n.props.d ?? 1); break;
    }
    if (geo) {
      mesh.geometry.dispose();
      mesh.geometry = geo;
    }
  }

  private makeObject(n: GameNode): THREE.Object3D | null {
    let obj: THREE.Object3D | null = null;
    const matStd = (c: string) => new THREE.MeshStandardMaterial({ color: c });
    switch (n.type) {
      case "box":
      case "rigidBody3d":
      case "staticBody3d":
        obj = new THREE.Mesh(new THREE.BoxGeometry(n.props.w ?? 1, n.props.h ?? 1, n.props.d ?? 1), matStd(n.props.color || "#fff")); break;
      case "sphere":
        obj = new THREE.Mesh(new THREE.SphereGeometry(n.props.r ?? 0.5, 24, 16), matStd(n.props.color || "#fff")); break;
      case "cylinder":
        obj = new THREE.Mesh(new THREE.CylinderGeometry(n.props.r ?? 0.5, n.props.r ?? 0.5, n.props.h ?? 1, 24), matStd(n.props.color || "#fff")); break;
      case "capsule":
        obj = new THREE.Mesh(new THREE.CapsuleGeometry(n.props.r ?? 0.4, n.props.h ?? 1, 4, 12), matStd(n.props.color || "#fff")); break;
      case "plane": {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(n.props.w ?? 10, n.props.h ?? 10), matStd(n.props.color || "#444"));
        obj = m; break;
      }
      case "player3d":
        obj = new THREE.Mesh(new THREE.CapsuleGeometry(n.props.r ?? 0.4, n.props.h ?? 1.6, 4, 12), matStd(n.props.color || "#7bf1a8")); break;
      case "sprite3d": {
        const mat = new THREE.SpriteMaterial({ color: n.props.color || "#fff" });
        if (n.props.image) this.texLoader.load(n.props.image, (t) => { mat.map = t; mat.needsUpdate = true; });
        const sp = new THREE.Sprite(mat);
        sp.scale.set(n.props.w ?? 1, n.props.h ?? 1, 1);
        obj = sp; break;
      }
      case "area3d": {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(n.props.w ?? 1, n.props.h ?? 1, n.props.d ?? 1),
          new THREE.MeshBasicMaterial({ color: n.props.color || "#22c08a", transparent: true, opacity: 0.25, wireframe: true }),
        );
        obj = m; break;
      }
      case "light": {
        if (n.props.kind === "ambient") obj = new THREE.AmbientLight(n.props.color || "#fff", n.props.intensity ?? 0.5);
        else if (n.props.kind === "directional") obj = new THREE.DirectionalLight(n.props.color || "#fff", n.props.intensity ?? 1);
        else if (n.props.kind === "spot") obj = new THREE.SpotLight(n.props.color || "#fff", n.props.intensity ?? 1);
        else obj = new THREE.PointLight(n.props.color || "#fff", n.props.intensity ?? 1, 50);
        break;
      }
      case "particles3d": {
        const c = n.props.count || 40;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(c * 3);
        for (let i = 0; i < c; i++) { pos[i*3] = (Math.random()-0.5)*2; pos[i*3+1] = Math.random()*2; pos[i*3+2] = (Math.random()-0.5)*2; }
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        obj = new THREE.Points(geo, new THREE.PointsMaterial({ color: n.props.color || "#7bf1a8", size: 0.08 }));
        break;
      }
      case "label3d": {
        const cv = document.createElement("canvas");
        cv.width = 256; cv.height = 64;
        const cx = cv.getContext("2d")!;
        cx.fillStyle = n.props.color || "#fff";
        cx.font = "32px system-ui"; cx.textAlign = "center"; cx.textBaseline = "middle";
        cx.fillText(n.props.text || "Label", 128, 32);
        const tex = new THREE.CanvasTexture(cv);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        const s = n.props.size || 0.4;
        sp.scale.set(s * 4, s, 1);
        obj = sp; break;
      }
      case "camera3d":
      case "raycast3d":
      case "audio3d":
        return null;
      case "model":
        return new THREE.Group();
    }
    if (obj) this.applyTransform(obj, n);
    return obj;
  }

  private applyTransform(obj: THREE.Object3D, n: GameNode) {
    obj.position.set(n.transform.x, n.transform.y, n.transform.z);
    // Default a plane to be flat if user hasn't rotated it.
    if (n.type === "plane" && n.transform.rx === 0 && n.transform.ry === 0 && n.transform.rz === 0) {
      obj.rotation.set(-Math.PI / 2, 0, 0);
    } else {
      obj.rotation.set(n.transform.rx, n.transform.ry, n.transform.rz);
    }
    obj.scale.set(n.transform.sx, n.transform.sy, n.transform.sz);
    obj.visible = n.visible !== false;
  }

  private initScripts() {
    for (const n of this.allNodes()) {
      if (!n.script) continue;
      const s = this.states.get(n.id);
      if (!s) continue;
      this.compile(n, s);
    }
  }

  recompileScript(id: string) {
    const n = this.allNodes().find((x) => x.id === id);
    const s = n && this.states.get(n.id);
    if (!n || !s) return;
    if (n.script) this.compile(n, s);
    else { s.scriptApi = undefined; s.scriptError = undefined; }
  }

  private compile(n: GameNode, s: NodeState) {
    try {
      const api = { get x() { return n.transform.x; }, set x(v: number) { n.transform.x = v; },
        get y() { return n.transform.y; }, set y(v: number) { n.transform.y = v; },
        get z() { return n.transform.z; }, set z(v: number) { n.transform.z = v; },
        props: n.props, node: n, name: n.name };
      const body = n.script + "\nreturn { onStart: typeof onStart!=='undefined'?onStart:null, onUpdate: typeof onUpdate!=='undefined'?onUpdate:null, onCollide: typeof onCollide!=='undefined'?onCollide:null, onClick: typeof onClick!=='undefined'?onClick:null, onKey: typeof onKey!=='undefined'?onKey:null };";
      const fn = new Function("self", "scene", "input", "log", body);
      const exp = fn(api, { find: (nm: string) => this.allNodes().find((x) => x.name === nm), all: () => this.allNodes() }, this.input, (m: any) => this.onLog?.(String(m)));
      s.scriptApi = exp;
      s.scriptError = undefined;
      try { exp?.onStart?.(); } catch (e) { this.onLog?.("onStart: " + e); }
    } catch (e: any) {
      s.scriptError = String(e?.message || e);
      this.onLog?.("compile [" + n.name + "]: " + s.scriptError);
    }
  }

  tick = (t: number) => {
    if (!this.running) return;
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
    this.raf = requestAnimationFrame(this.tick);
  };

  private update(dt: number) {
    const g = this.doc.settings.gravity;
    const all = this.allNodes();
    const camPos = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z };
    const solids = all.filter((n) => isCollider(n) && !isSensor(n));

    for (const n of all) {
      for (const b of n.behaviors) {
        if (b.kind === "keyAction" && b.params.key && this.input.wasPressed(b.params.key) && b.params.script) {
          try { new Function("log", "self", b.params.script)((m: any) => this.onLog?.(String(m)), { node: n }); }
          catch (err) { this.onLog?.("key: " + err); }
        }
      }
      const s = this.states.get(n.id);
      if (s?.scriptApi?.onKey) {
        for (const code of this.input.pressed) {
          try { s.scriptApi.onKey(code); } catch (e) { this.onLog?.("onKey: " + e); }
        }
      }
    }

    for (const n of all) {
      const s = this.states.get(n.id);
      if (!s) continue;

      // Hot-rebuild geometry on size change
      const cur = this.sizeKey(n);
      const last = s.lastSize;
      if (last && (last.w !== cur.w || last.h !== cur.h || last.d !== cur.d || last.r !== cur.r)) {
        this.rebuildGeometry(n, s);
        s.lastSize = cur;
      }

      runBehaviors(n, { doc: this.doc, input: this.input, dt, state: s.rt, mode: "3d", solids, cameraPos: camPos, log: this.onLog });

      if (this.rapierWorld && this.rapierBodies.has(n.id) && PHYSICS_TYPES.has(n.type)) {
        const body = this.rapierBodies.get(n.id);
        const lv = body.linvel();
        body.setLinvel({ x: s.rt.vx, y: lv.y + (s.rt.vy ? s.rt.vy : 0), z: s.rt.vz }, true);
        s.rt.vy = 0;
      } else if (PHYSICS_TYPES.has(n.type)) {
        s.rt.vy -= g * dt;
        // X
        n.transform.x += s.rt.vx * dt;
        for (const sd of solids) if (sd.id !== n.id && this.aabb(n, sd)) {
          if (s.rt.vx > 0) n.transform.x = sd.transform.x - this.halfX(sd) - this.halfX(n);
          else if (s.rt.vx < 0) n.transform.x = sd.transform.x + this.halfX(sd) + this.halfX(n);
          s.rt.vx = 0;
        }
        // Z
        n.transform.z += s.rt.vz * dt;
        for (const sd of solids) if (sd.id !== n.id && this.aabb(n, sd)) {
          if (s.rt.vz > 0) n.transform.z = sd.transform.z - this.halfZ(sd) - this.halfZ(n);
          else if (s.rt.vz < 0) n.transform.z = sd.transform.z + this.halfZ(sd) + this.halfZ(n);
          s.rt.vz = 0;
        }
        // Y
        n.transform.y += s.rt.vy * dt;
        s.rt.grounded = false;
        for (const sd of solids) if (sd.id !== n.id && this.aabb(n, sd)) {
          if (s.rt.vy < 0) { n.transform.y = sd.transform.y + this.halfY(sd) + this.halfY(n); s.rt.grounded = true; }
          else if (s.rt.vy > 0) n.transform.y = sd.transform.y - this.halfY(sd) - this.halfY(n);
          s.rt.vy = 0;
        }
      }
    }

    if (this.rapierWorld) {
      this.rapierWorld.step();
      for (const n of all) {
        const body = this.rapierBodies.get(n.id);
        if (!body) continue;
        const t = body.translation();
        n.transform.x = t.x; n.transform.y = t.y; n.transform.z = t.z;
      }
    }

    for (const n of all) {
      const s = this.states.get(n.id);
      if (!s) continue;
      this.applyTransform(s.obj, n);
      if (s.scriptApi?.onUpdate) {
        try { s.scriptApi.onUpdate(dt); } catch (e) { this.onLog?.("onUpdate: " + e); }
      }
    }

    // Collision dispatch (onCollide / damageOnContact / script onCollide)
    const colliders = all.filter(isCollider);
    for (let i = 0; i < colliders.length; i++) {
      for (let j = i + 1; j < colliders.length; j++) {
        const a = colliders[i], b = colliders[j];
        const sa = this.states.get(a.id), sb = this.states.get(b.id);
        if (!sa || !sb) continue;
        const hit = this.aabb(a, b);
        const was = sa.overlap.has(b.id);
        if (hit && !was) { sa.overlap.add(b.id); sb.overlap.add(a.id); this.dispatchCollide(a, b); this.dispatchCollide(b, a); }
        else if (!hit && was) { sa.overlap.delete(b.id); sb.overlap.delete(a.id); }
        if (hit) { this.tickDamage(a, b, dt); this.tickDamage(b, a, dt); }
      }
    }

    // Camera follow — orbit-style with distance/pitch/yaw + lerp
    const cam = all.find((c) => c.type === "camera3d");
    if (cam) {
      const followName: string = cam.props.follow;
      const follow = followName ? all.find((c) => c.name === followName || c.id === followName) : null;
      const target = follow ? follow.transform : cam.transform;
      const dist = Number(cam.props.distance ?? 10);
      const pitch = Number(cam.props.pitch ?? 0.4);
      const yaw = Number(cam.props.yaw ?? 0);
      const oy = Number(cam.props.offsetY ?? 2);
      const lerp = Math.max(0, Math.min(1, Number(cam.props.lerp ?? 0.15)));
      const fov = Number(cam.props.fov ?? 60);
      if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
      if (follow) {
        const tx = target.x + Math.sin(yaw) * Math.cos(pitch) * dist;
        const ty = target.y + Math.sin(pitch) * dist + oy;
        const tz = target.z + Math.cos(yaw) * Math.cos(pitch) * dist;
        this.camSmooth.x += (tx - this.camSmooth.x) * lerp;
        this.camSmooth.y += (ty - this.camSmooth.y) * lerp;
        this.camSmooth.z += (tz - this.camSmooth.z) * lerp;
        this.camera.position.copy(this.camSmooth);
        this.camera.lookAt(target.x, target.y + oy * 0.5, target.z);
      } else {
        this.camera.position.set(cam.transform.x, cam.transform.y, cam.transform.z);
        this.camera.lookAt(0, 1, 0);
      }
    }

    // Cleanup destroyed
    const destroy = (arr: GameNode[]) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        if ((arr[i] as any).__destroy) {
          const st = this.states.get(arr[i].id);
          if (st) this.scene.remove(st.obj);
          this.states.delete(arr[i].id);
          arr.splice(i, 1);
        } else destroy(arr[i].children);
      }
    };
    destroy(this.doc.nodes);
  }

  private halfX(n: GameNode) { return Number(n.props.collisionW ?? n.props.w ?? n.props.r ?? 0.5) / 2; }
  private halfY(n: GameNode) { return Number(n.props.collisionH ?? n.props.h ?? n.props.r ?? 0.5) / 2; }
  private halfZ(n: GameNode) { return Number(n.props.collisionD ?? n.props.d ?? n.props.r ?? 0.5) / 2; }

  private aabb(a: GameNode, b: GameNode) {
    return Math.abs(a.transform.x - b.transform.x) < this.halfX(a) + this.halfX(b)
        && Math.abs(a.transform.y - b.transform.y) < this.halfY(a) + this.halfY(b)
        && Math.abs(a.transform.z - b.transform.z) < this.halfZ(a) + this.halfZ(b);
  }

  private dispatchCollide(self: GameNode, other: GameNode) {
    const s = this.states.get(self.id);
    if (s?.scriptApi?.onCollide) {
      try { s.scriptApi.onCollide({ node: other, name: other.name, tag: colliderTag(other) }); }
      catch (e) { this.onLog?.("onCollide: " + e); }
    }
    for (const b of self.behaviors) {
      if (b.kind === "onCollide" && b.params.script) {
        try {
          new Function("log", "self", "other", b.params.script)(
            (m: any) => this.onLog?.(String(m)),
            { node: self, name: self.name, props: self.props },
            { node: other, name: other.name, tag: colliderTag(other), props: other.props },
          );
        } catch (e) { this.onLog?.("onCollide behavior: " + e); }
      }
    }
  }

  private tickDamage(self: GameNode, other: GameNode, dt: number) {
    const s = this.states.get(self.id) as any;
    if (!s) return;
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
}
