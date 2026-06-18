export type Mode = "2d" | "3d";

export interface Transform {
  x: number; y: number; z: number;
  rx: number; ry: number; rz: number;
  sx: number; sy: number; sz: number;
}

export type NodeType =
  // 2D base
  | "node2d" | "sprite" | "animatedSprite" | "text" | "button" | "panel"
  | "line2d" | "polygon2d" | "tilemap" | "parallax"
  | "light2d" | "particles2d" | "raycast2d" | "area2d"
  | "player2d" | "rigidBody2d" | "staticBody2d" | "camera2d" | "audio2d"
  // 3D base
  | "node3d" | "box" | "sphere" | "plane" | "cylinder" | "capsule"
  | "sprite3d" | "label3d" | "model" | "decal"
  | "light" | "particles3d" | "raycast3d"
  | "player3d" | "rigidBody3d" | "staticBody3d" | "area3d" | "camera3d" | "audio3d";

export type BehaviorKind =
  | "walk" | "run" | "jump" | "platformer" | "topdown"
  | "follow" | "orbit" | "rotate" | "oscillate" | "patrol"
  | "lookAt" | "billboard" | "screenWrap" | "bounce" | "chase"
  | "destroyAfter" | "spawnInterval" | "opacityPulse" | "scalePulse"
  | "dash" | "limitToMap" | "teleportTo"
  | "clickAction" | "keyAction"
  | "onJoystick" | "moveOnJoystick" | "onCollide" | "damageOnContact"
  | "playerAttack" | "shoot";

export interface Behavior {
  kind: BehaviorKind;
  params: Record<string, any>;
}

export interface GameNode {
  id: string;
  name: string;
  type: NodeType;
  transform: Transform;
  props: Record<string, any>;
  /** Visual / DOM style overrides (for button/text/panel) */
  style?: Record<string, any>;
  behaviors: Behavior[];
  script?: string;
  visible?: boolean;
  children: GameNode[];
}

export interface JoystickConfig {
  enabled: boolean;
  size: number;
  color: string;
  knobColor: string;
  opacity: number;
  position: "bottom-left" | "bottom-right";
}
export interface ActionButton {
  label: string;
  key: string;
  color: string;
  size: number;
  x: number;
  y: number;
}

export interface Ground2D {
  enabled: boolean;
  infinite: boolean;
  width: number;
  height: number;
  y: number;
  color: string;
}

export interface SceneSettings {
  width: number;
  height: number;
  gravity: number;
  background: string;
  mobileControls: boolean;
  joystick: JoystickConfig;
  buttons: ActionButton[];
  ground2d: Ground2D;
  usePhysics3d: boolean;
}

export interface ScenePage {
  id: string;
  name: string;
  nodes: GameNode[];
}

export interface SceneDoc {
  id: string;
  name: string;
  mode: Mode;
  settings: SceneSettings;
  nodes: GameNode[];
  scenes?: ScenePage[];
  activeSceneId?: string;
  createdAt: number;
  updatedAt: number;
}

export const defaultTransform = (): Transform => ({
  x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1,
});

export const defaultJoystick = (): JoystickConfig => ({
  enabled: true, size: 110, color: "#0f2a1e", knobColor: "#7bf1a8",
  opacity: 0.85, position: "bottom-left",
});
export const defaultButtons = (): ActionButton[] => ([
  { label: "A", key: "jump",   color: "#22c08a", size: 64, x: 24,  y: 32 },
  { label: "X", key: "attack", color: "#ff6a6a", size: 60, x: 96,  y: 24 },
  { label: "B", key: "action", color: "#178a64", size: 52, x: 168, y: 88 },
]);
export const defaultGround = (): Ground2D => ({
  enabled: true, infinite: true, width: 2400, height: 80, y: 220, color: "#1c3a2a",
});
