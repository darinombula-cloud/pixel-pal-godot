import { create } from "zustand";
import { nanoid } from "nanoid";
import type { SceneDoc, GameNode, Mode, NodeType, Behavior } from "./types";
import { defaultTransform, defaultJoystick, defaultButtons, defaultGround } from "./types";

const STORAGE_KEY = "gamebuilder.projects.v2";

function loadAll(): Record<string, SceneDoc> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveAll(map: Record<string, SceneDoc>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function listProjects(): SceneDoc[] {
  return Object.values(loadAll()).sort((a, b) => b.updatedAt - a.updatedAt);
}
export function getProject(id: string): SceneDoc | null { return loadAll()[id] ?? null; }
export function deleteProject(id: string) { const all = loadAll(); delete all[id]; saveAll(all); }

function withScenes(doc: SceneDoc): SceneDoc {
  if (!doc.scenes?.length) {
    const id = nanoid(8);
    doc.scenes = [{ id, name: "Level 1", nodes: doc.nodes }];
    doc.activeSceneId = id;
    return doc;
  }
  const active = doc.scenes.find((s) => s.id === doc.activeSceneId) || doc.scenes[0];
  doc.activeSceneId = active.id;
  doc.nodes = active.nodes;
  return doc;
}

function syncActiveScene(doc: SceneDoc) {
  if (!doc.scenes?.length) return withScenes(doc);
  const active = doc.scenes.find((s) => s.id === doc.activeSceneId);
  if (active) active.nodes = doc.nodes;
  return doc;
}

/** Set per-state animation images on the project's first Player node. */
export function setPlayerAnimations(id: string, anims: Record<string, string>) {
  const all = loadAll();
  const doc = all[id];
  if (!doc) return;
  const walk = (arr: GameNode[]): GameNode | null => {
    for (const n of arr) {
      if (n.type === "player2d" || n.type === "player3d") return n;
      const c = walk(n.children); if (c) return c;
    }
    return null;
  };
  const player = walk(doc.nodes);
  if (!player) return;
  player.props.animations = { ...(player.props.animations || {}), ...anims };
  if (anims.idle) player.props.image = anims.idle;
  else if (!player.props.image) {
    const first = Object.values(anims).find(Boolean);
    if (first) player.props.image = first;
  }
  doc.updatedAt = Date.now();
  saveAll(all);
}

export function createProject(name: string, mode: Mode): SceneDoc {
  const nodes = defaultStarterNodes(mode);
  const firstSceneId = nanoid(8);
  const doc: SceneDoc = {
    id: nanoid(10),
    name,
    mode,
    settings: {
      width: mode === "2d" ? 1920 : 1280,
      height: mode === "2d" ? 540 : 720,
      gravity: mode === "2d" ? 1400 : 25,
      background: mode === "2d" ? "#0d1f17" : "#0a1612",
      mobileControls: true,
      joystick: defaultJoystick(),
      buttons: defaultButtons(),
      ground2d: defaultGround(),
      usePhysics3d: false,
    },
    nodes,
    scenes: [{ id: firstSceneId, name: "Level 1", nodes }],
    activeSceneId: firstSceneId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const all = loadAll();
  all[doc.id] = doc;
  saveAll(all);
  return doc;
}

function defaultStarterNodes(mode: Mode): GameNode[] {
  if (mode === "2d") {
    return [
      makeNode("camera2d", "Camera", { x: -820, y: 0 }, { zoom: 1, follow: "Player", offsetX: 0, offsetY: 0, lerp: 0.15 }),
      makeNode("player2d", "Player", { x: -820, y: 0 }, { color: "#7bf1a8", w: 40, h: 56, image: "", hp: 100, maxHp: 100, collisionEnabled: true, collisionTag: "player" }, [
        { kind: "platformer", params: { speed: 280, runMul: 1.8, force: 560 } },
        { kind: "playerAttack", params: { damage: 1, range: 90, cooldown: 0.4, targetTag: "enemy" } },
      ]),
    ];
  }
  return [
    makeNode("camera3d", "Camera", { x: 0, y: 4, z: 10 }, { fov: 60, follow: "Player", distance: 10, pitch: 0.4, yaw: 0, offsetY: 2, lerp: 0.15 }),
    makeNode("light", "Sun", { x: 5, y: 10, z: 5 }, { kind: "directional", color: "#ffffff", intensity: 1.2 }),
    makeNode("light", "Ambient", { x: 0, y: 0, z: 0 }, { kind: "ambient", color: "#3a5a4a", intensity: 0.7 }),
    makeNode("plane", "Ground", { x: 0, y: 0, z: 0 }, { color: "#1a3a2a", w: 60, h: 60, solid: true, collisionEnabled: true, collisionH: 0.2 }),
    makeNode("player3d", "Player", { x: 0, y: 1, z: 0 }, { color: "#7bf1a8", h: 1.6, r: 0.4, image: "", hp: 100, maxHp: 100, collisionEnabled: true, collisionTag: "player" }, [
      { kind: "walk", params: { speed: 5, runMul: 1.6 } },
      { kind: "jump", params: { height: 1.8 } },
      { kind: "playerAttack", params: { damage: 1, range: 2.2, cooldown: 0.4, targetTag: "enemy" } },
    ]),
    makeNode("box", "Crate", { x: 3, y: 0.5, z: -2 }, { color: "#22c08a", w: 1, h: 1, d: 1, solid: true, collisionEnabled: true }),
  ];
}

function makeNode(type: NodeType, name: string, pos: Partial<{ x: number; y: number; z: number }>, props: Record<string, any> = {}, behaviors: Behavior[] = []): GameNode {
  return {
    id: nanoid(8), name, type,
    transform: { ...defaultTransform(), x: pos.x ?? 0, y: pos.y ?? 0, z: pos.z ?? 0 },
    props, behaviors, children: [], visible: true,
  };
}

const PRESETS: Record<string, { name: string; props: Record<string, any>; behaviors?: Behavior[]; style?: Record<string, any> }> = {
  // 2D
  node2d:         { name: "Node2D", props: {} },
  sprite:         { name: "Sprite", props: { color: "#7bf1a8", w: 64, h: 64, image: "" } },
  animatedSprite: { name: "AnimatedSprite", props: { color: "#7bf1a8", w: 64, h: 64, frames: "", fps: 8 } },
  text:           { name: "Text", props: { text: "Hello", size: 24, color: "#ffffff", font: "system-ui" }, style: { fontWeight: 600 } },
  button:         { name: "Button", props: { label: "Click", w: 140, h: 44, color: "#22c08a" }, style: { borderRadius: 10, color: "#0a1612", fontWeight: 700, zIndex: 10 } },
  panel:          { name: "Panel", props: { w: 200, h: 100, color: "#0f2a1e" }, style: { borderRadius: 12, opacity: 0.9 } },
  line2d:         { name: "Line2D", props: { color: "#7bf1a8", width: 4, points: "0,0 100,0 100,100" } },
  polygon2d:      { name: "Polygon2D", props: { color: "#22c08a", points: "0,-30 30,30 -30,30" } },
  tilemap:        { name: "TileMap", props: { tileSize: 32, color: "#1c3a2a", grid: "1,1,1\n1,0,1\n1,1,1" } },
  parallax:       { name: "ParallaxLayer", props: { color: "#0f2a1e", w: 2000, h: 200, factor: 0.3 } },
  light2d:        { name: "Light2D", props: { color: "#7bf1a8", radius: 200, intensity: 0.6 } },
  particles2d:    { name: "Particles2D", props: { color: "#7bf1a8", count: 24, lifetime: 1.2, spread: 60 } },
  raycast2d:      { name: "RayCast2D", props: { dirX: 1, dirY: 0, length: 100 } },
  area2d:         { name: "Area2D", props: { w: 60, h: 60, color: "#22c08a55", collisionEnabled: true, isSensor: true, collisionTag: "trigger" } },
  player2d:       { name: "Player", props: { color: "#7bf1a8", w: 40, h: 56, image: "", hp: 100, maxHp: 100, collisionEnabled: true, collisionTag: "player" }, behaviors: [{ kind: "platformer", params: { speed: 280, runMul: 1.8, force: 560 } }, { kind: "playerAttack", params: { damage: 1, range: 90, cooldown: 0.4, targetTag: "enemy" } }] },
  rigidBody2d:    { name: "RigidBody2D", props: { color: "#f5a96b", w: 40, h: 40, mass: 1, solid: true, gravity: true, collisionEnabled: true } },
  staticBody2d:   { name: "StaticBody2D", props: { color: "#2a4a3a", w: 120, h: 24, solid: true, collisionEnabled: true } },
  camera2d:       { name: "Camera", props: { zoom: 1, follow: "", offsetX: 0, offsetY: 0, lerp: 0.15 } },
  audio2d:        { name: "Audio", props: { url: "", loop: false, volume: 1, autoplay: false } },
  // 3D
  node3d:         { name: "Node3D", props: {} },
  box:            { name: "Box", props: { color: "#22c08a", w: 1, h: 1, d: 1, solid: true, collisionEnabled: true } },
  sphere:         { name: "Sphere", props: { color: "#7bf1a8", r: 0.5, solid: true, collisionEnabled: true } },
  cylinder:       { name: "Cylinder", props: { color: "#7bf1a8", r: 0.5, h: 1 } },
  capsule:        { name: "Capsule", props: { color: "#7bf1a8", r: 0.4, h: 1 } },
  plane:          { name: "Plane", props: { color: "#1a3a2a", w: 10, h: 10, solid: true, collisionEnabled: true, collisionH: 0.2 } },
  sprite3d:       { name: "Sprite3D", props: { image: "", color: "#7bf1a8", w: 1, h: 1 } },
  label3d:        { name: "Label3D", props: { text: "Label", size: 0.4, color: "#ffffff" } },
  decal:          { name: "Decal", props: { color: "#7bf1a8", w: 1, h: 1 } },
  light:          { name: "Light", props: { kind: "point", color: "#ffffff", intensity: 1 } },
  particles3d:    { name: "Particles3D", props: { color: "#7bf1a8", count: 40, lifetime: 1.5 } },
  raycast3d:      { name: "RayCast3D", props: { dirX: 0, dirY: -1, dirZ: 0, length: 5 } },
  player3d:       { name: "Player", props: { color: "#7bf1a8", h: 1.6, r: 0.4, image: "", hp: 100, maxHp: 100, collisionEnabled: true, collisionTag: "player" }, behaviors: [{ kind: "walk", params: { speed: 5 } }, { kind: "jump", params: { height: 1.6 } }, { kind: "playerAttack", params: { damage: 1, range: 2.2, cooldown: 0.4, targetTag: "enemy" } }] },
  rigidBody3d:    { name: "RigidBody3D", props: { color: "#f5a96b", w: 1, h: 1, d: 1, mass: 1, solid: true, collisionEnabled: true } },
  staticBody3d:   { name: "StaticBody3D", props: { color: "#2a4a3a", w: 4, h: 0.4, d: 4, solid: true, collisionEnabled: true } },
  area3d:         { name: "Area3D", props: { w: 1, h: 1, d: 1, color: "#22c08a55", collisionEnabled: true, isSensor: true, collisionTag: "trigger" } },
  camera3d:       { name: "Camera", props: { fov: 60, follow: "", distance: 10, pitch: 0.4, yaw: 0, offsetY: 2, lerp: 0.15 } },
  audio3d:        { name: "Audio", props: { url: "", loop: false, volume: 1, autoplay: false } },
  model:          { name: "Model", props: { url: "" } },
};

export function newNode(type: NodeType, pos: { x?: number; y?: number; z?: number } = {}): GameNode {
  const p = PRESETS[type] || { name: type, props: {} };
  const n = makeNode(type, p.name, pos, { ...p.props }, p.behaviors ? p.behaviors.map((b) => ({ kind: b.kind, params: { ...b.params } })) : []);
  if (p.style) n.style = { ...p.style };
  return n;
}

interface EditorState {
  doc: SceneDoc | null;
  selectedId: string | null;
  enemyMode: boolean;
  load: (id: string) => void;
  setDoc: (d: SceneDoc) => void;
  save: () => void;
  select: (id: string | null) => void;
  addNode: (n: GameNode) => void;
  addChildNode: (parentId: string, n: GameNode) => void;
  addScene: () => void;
  switchScene: (id: string) => void;
  updateNode: (id: string, fn: (n: GameNode) => void) => void;
  removeNode: (id: string) => void;
  rename: (name: string) => void;
  updateSettings: (fn: (s: SceneDoc["settings"]) => void) => void;
  setEnemyMode: (v: boolean) => void;
}

export const useEditor = create<EditorState>((set, get) => ({
  doc: null,
  selectedId: null,
  enemyMode: false,
  setEnemyMode: (v) => set({ enemyMode: v }),
  load: (id) => set({ doc: getProject(id) ? withScenes(getProject(id)!) : null, selectedId: null, enemyMode: false }),
  setDoc: (d) => set({ doc: d }),
  save: () => {
    const d = get().doc; if (!d) return;
    const all = loadAll(); syncActiveScene(d); d.updatedAt = Date.now(); all[d.id] = d; saveAll(all);
  },
  select: (id) => set({ selectedId: id }),
  addNode: (n) => {
    const d = get().doc; if (!d) return;
    d.nodes.push(n);
    set({ doc: { ...d }, selectedId: n.id });
    get().save();
  },
  addChildNode: (parentId, n) => {
    const d = get().doc; if (!d) return;
    const parent = findNode(d, parentId);
    if (!parent) return;
    parent.children.push(n);
    set({ doc: { ...d }, selectedId: n.id });
    get().save();
  },
  addScene: () => {
    const d = get().doc; if (!d) return;
    syncActiveScene(d);
    const index = (d.scenes?.length || 0) + 1;
    // New page is intentionally empty — a blank canvas for the next level.
    const scene = { id: nanoid(8), name: `Level ${index}`, nodes: [] as GameNode[] };
    d.scenes = [...(d.scenes || []), scene];
    d.activeSceneId = scene.id;
    d.nodes = scene.nodes;
    set({ doc: { ...d }, selectedId: null });
    get().save();
  },
  switchScene: (id) => {
    const d = get().doc; if (!d || !d.scenes?.length) return;
    syncActiveScene(d);
    const scene = d.scenes.find((s) => s.id === id);
    if (!scene) return;
    d.activeSceneId = scene.id;
    d.nodes = scene.nodes;
    set({ doc: { ...d }, selectedId: null });
    get().save();
  },
  updateNode: (id, fn) => {
    const d = get().doc; if (!d) return;
    const walk = (arr: GameNode[]): boolean => {
      for (const n of arr) { if (n.id === id) { fn(n); return true; } if (walk(n.children)) return true; }
      return false;
    };
    walk(d.nodes);
    set({ doc: { ...d } });
    get().save();
  },
  removeNode: (id) => {
    const d = get().doc; if (!d) return;
    const filter = (arr: GameNode[]): GameNode[] => arr.filter((n) => n.id !== id).map((n) => ({ ...n, children: filter(n.children) }));
    d.nodes = filter(d.nodes);
    set({ doc: { ...d }, selectedId: null });
    get().save();
  },
  rename: (name) => {
    const d = get().doc; if (!d) return;
    d.name = name;
    set({ doc: { ...d } });
    get().save();
  },
  updateSettings: (fn) => {
    const d = get().doc; if (!d) return;
    fn(d.settings);
    set({ doc: { ...d } });
    get().save();
  },
}));

export function findNode(doc: SceneDoc, id: string): GameNode | null {
  const walk = (arr: GameNode[]): GameNode | null => {
    for (const n of arr) { if (n.id === id) return n; const c = walk(n.children); if (c) return c; }
    return null;
  };
  return walk(doc.nodes);
}
export function findByName(doc: SceneDoc, name: string): GameNode | null {
  const walk = (arr: GameNode[]): GameNode | null => {
    for (const n of arr) { if (n.name === name) return n; const c = walk(n.children); if (c) return c; }
    return null;
  };
  return walk(doc.nodes);
}
export function flatNodes(doc: SceneDoc): GameNode[] {
  const out: GameNode[] = [];
  const walk = (a: GameNode[]) => a.forEach((n) => { out.push(n); walk(n.children); });
  walk(doc.nodes);
  return out;
}
