import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useEditor, newNode } from "@/engine/store";
import type { NodeType } from "@/engine/types";
import { Runtime3D } from "@/engine/runtime3d";
import { MobileControls } from "./MobileControls";
import { EnemyPicker } from "./EnemyPicker";
import { HealthHud } from "./HealthHud";
import { makeEnemy, makeCustomEnemy } from "@/engine/enemies";

export function Viewport3D({ playing, onLog }: { playing: boolean; onLog: (m: string) => void }) {
  const doc = useEditor((s) => s.doc);
  const sel = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const add = useEditor((s) => s.addNode);
  const enemyMode = useEditor((s) => s.enemyMode);
  const setEnemyMode = useEditor((s) => s.setEnemyMode);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rtRef = useRef<Runtime3D | null>(null);
  const editorRef = useRef<EditorScene | null>(null);
  const [, force] = useState(0);
  const [picker, setPicker] = useState<{ sx: number; sy: number; x: number; z: number } | null>(null);

  useEffect(() => {
    if (!doc || !wrapRef.current) return;
    if (playing) {
      editorRef.current?.dispose();
      editorRef.current = null;
      const rt = new Runtime3D(structuredClone(doc), wrapRef.current);
      rt.onLog = onLog;
      rt.start();
      rtRef.current = rt;
      force((v) => v + 1);
      return () => rt.dispose();
    } else {
      const es = new EditorScene(doc, wrapRef.current, (id) => select(id));
      editorRef.current = es;
      return () => es.dispose();
    }
  }, [playing, doc?.id, doc?.mode, doc?.activeSceneId]);

  useEffect(() => { editorRef.current?.refresh(doc, sel); }, [doc, sel]);

  // Hot-reload scripts while playing
  useEffect(() => {
    if (!playing || !rtRef.current || !doc) return;
    const rt = rtRef.current;
    const findIn = (arr: any[], id: string): any => {
      for (const n of arr) { if (n.id === id) return n; const f = findIn(n.children, id); if (f) return f; }
      return null;
    };
    const walk = (arr: any[]) => arr.forEach((n) => {
      const target = findIn(rt.doc.nodes, n.id);
      if (target && target.script !== n.script) {
        target.script = n.script;
        rt.recompileScript(n.id);
      }
      walk(n.children);
    });
    walk(doc.nodes);
  }, [doc, playing]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const t = e.dataTransfer.getData("node-type") as NodeType;
    if (!t) return;
    add(newNode(t, { x: 0, y: 1, z: 0 }));
  };

  const onEnemyClick = (e: React.PointerEvent) => {
    if (!editorRef.current) return;
    const g = editorRef.current.screenToGround(e.clientX, e.clientY);
    if (!g) return;
    setPicker({ sx: e.clientX, sy: e.clientY, x: g.x, z: g.z });
  };

  if (!doc) return null;
  return (
    <div
      ref={wrapRef}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="relative flex-1 bg-black overflow-hidden"
      style={{ touchAction: "none" }}
    >
      {playing && rtRef.current && <HealthHud rt={rtRef.current} mode="3d" />}
      {playing && doc.settings.mobileControls && rtRef.current && (
        <MobileControls input={rtRef.current.input} joystick={doc.settings.joystick} buttons={doc.settings.buttons} />
      )}
      {!playing && enemyMode && (
        <div
          onPointerDown={onEnemyClick}
          className="absolute inset-0 z-10 cursor-crosshair bg-destructive/5"
          style={{ touchAction: "none" }}
        />
      )}
      {picker && (
        <EnemyPicker
          x={picker.sx} y={picker.sy}
          onClose={() => setPicker(null)}
          onPick={(res) => {
            if (res.kind === "custom") {
              add(makeCustomEnemy("3d", { x: picker.x, y: 0.5, z: picker.z }, res.anims));
            } else {
              add(makeEnemy(res.kind, "3d", { x: picker.x, y: 0.5, z: picker.z }));
            }
            setPicker(null);
            setEnemyMode(false);
          }}
        />
      )}
    </div>
  );
}

class EditorScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  raf = 0;
  container: HTMLElement;
  resizeObs: ResizeObserver;
  meshById = new Map<string, THREE.Object3D>();
  helper?: THREE.BoxHelper;
  ang = { x: 0.5, y: 0.7 };
  dist = 14;
  target = new THREE.Vector3();
  doc: any;
  onSelect: (id: string) => void;
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  private down = false;
  private moved = false;
  private last = { x: 0, y: 0 };
  private lastInteract = performance.now();
  private autoRotate = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

  constructor(doc: any, container: HTMLElement, onSelect: (id: string) => void) {
    this.doc = doc;
    this.container = container;
    this.onSelect = onSelect;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(doc.settings.background);

    const grid = new THREE.GridHelper(40, 40, 0x444444, 0x222222);
    this.scene.add(grid);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(5, 10, 5); this.scene.add(dl);

    this.resize();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });

    this.build();
    this.loop();
  }

  resize() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 450;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  onDown = (e: PointerEvent) => { this.down = true; this.moved = false; this.last = { x: e.clientX, y: e.clientY }; this.lastInteract = performance.now(); (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  onMove = (e: PointerEvent) => {
    if (!this.down) return;
    this.lastInteract = performance.now();
    const dx = e.clientX - this.last.x, dy = e.clientY - this.last.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
    if (e.shiftKey || e.buttons === 4) {
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
      this.target.addScaledVector(right, -dx * this.dist * 0.0015);
      this.target.addScaledVector(up, dy * this.dist * 0.0015);
    } else {
      this.ang.y -= dx * 0.005;
      this.ang.x = Math.max(-1.4, Math.min(1.4, this.ang.x - dy * 0.005));
    }
    this.last = { x: e.clientX, y: e.clientY };
  };
  onUp = (e: PointerEvent) => {
    this.down = false;
    if (!this.moved) this.pick(e);
  };
  onWheel = (e: WheelEvent) => { e.preventDefault(); this.lastInteract = performance.now(); this.dist = Math.max(2, Math.min(80, this.dist * (1 + e.deltaY * 0.001))); };

  pick(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes: THREE.Object3D[] = [];
    this.meshById.forEach((o) => meshes.push(o));
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits[0]) {
      let o: THREE.Object3D | null = hits[0].object;
      while (o && !o.userData.nodeId) o = o.parent;
      if (o?.userData.nodeId) this.onSelect(o.userData.nodeId);
    } else this.onSelect("");
  }

  screenToGround(clientX: number, clientY: number): { x: number; z: number } | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * 2 - 1;
    const py = -((clientY - r.top) / r.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(px, py), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const out = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, out)) return null;
    return { x: +out.x.toFixed(2), z: +out.z.toFixed(2) };
  }

  build() {
    this.meshById.forEach((o) => this.scene.remove(o));
    this.meshById.clear();
    const all: any[] = []; const w = (a: any[]) => a.forEach((n) => { all.push(n); w(n.children); }); w(this.doc.nodes);
    for (const n of all) {
      let obj: THREE.Object3D | null = null;
      switch (n.type) {
        case "box": obj = new THREE.Mesh(new THREE.BoxGeometry(n.props.w || 1, n.props.h || 1, n.props.d || 1), new THREE.MeshStandardMaterial({ color: n.props.color })); break;
        case "sphere": obj = new THREE.Mesh(new THREE.SphereGeometry(n.props.r || 0.5, 24, 16), new THREE.MeshStandardMaterial({ color: n.props.color })); break;
        case "plane": { const m = new THREE.Mesh(new THREE.PlaneGeometry(n.props.w || 10, n.props.h || 10), new THREE.MeshStandardMaterial({ color: n.props.color })); m.rotation.x = -Math.PI / 2; obj = m; break; }
        case "player3d": obj = new THREE.Mesh(new THREE.CapsuleGeometry(n.props.r || 0.4, n.props.h || 1.6, 4, 8), new THREE.MeshStandardMaterial({ color: n.props.color })); break;
        case "rigidBody3d": obj = new THREE.Mesh(new THREE.BoxGeometry(n.props.w || 1, n.props.h || 1, n.props.d || 1), new THREE.MeshStandardMaterial({ color: n.props.color })); break;
        case "light": {
          const g = new THREE.Group();
          const helper = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({ color: n.props.color || "#ff0", wireframe: true }));
          g.add(helper); obj = g; break;
        }
        case "camera3d": {
          const g = new THREE.Group();
          const help = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), new THREE.MeshBasicMaterial({ color: 0xffcc00, wireframe: true }));
          help.rotation.x = Math.PI / 2; g.add(help); obj = g; break;
        }
      }
      if (obj) {
        obj.position.set(n.transform.x, n.transform.y, n.transform.z);
        if (n.type !== "plane") obj.rotation.set(n.transform.rx, n.transform.ry, n.transform.rz);
        obj.userData.nodeId = n.id;
        this.scene.add(obj);
        this.meshById.set(n.id, obj);
      }
    }
  }

  refresh(doc: any, selId: string | null) {
    this.doc = doc;
    (this.scene.background as THREE.Color)?.set(doc.settings.background);
    this.build();
    if (this.helper) { this.scene.remove(this.helper); this.helper = undefined; }
    if (selId && this.meshById.has(selId)) {
      const o = this.meshById.get(selId)!;
      if ((o as THREE.Mesh).geometry) {
        this.helper = new THREE.BoxHelper(o, 0xffffff);
        this.scene.add(this.helper);
      }
    }
  }

  loop = () => {
    // Auto-rotate on mobile / touch devices when the user hasn't interacted recently.
    if (this.autoRotate && !this.down && performance.now() - this.lastInteract > 2000) {
      this.ang.y += 0.003;
    }
    const cx = this.target.x + Math.cos(this.ang.x) * Math.sin(this.ang.y) * this.dist;
    const cy = this.target.y + Math.sin(this.ang.x) * this.dist;
    const cz = this.target.z + Math.cos(this.ang.x) * Math.cos(this.ang.y) * this.dist;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.target);
    this.helper?.update();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("wheel", this.onWheel);
    this.renderer.dispose();
    el.remove();
  }
}
