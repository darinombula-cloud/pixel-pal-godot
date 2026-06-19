import { useEditor, newNode } from "@/engine/store";
import type { NodeType, GameNode } from "@/engine/types";
import { useState } from "react";
import { ChevronDown, ChevronRight, ImagePlus } from "lucide-react";
import { useI18n } from "@/i18n";
import { ENEMY_PRESETS, makeEnemy } from "@/engine/enemies";
import { PlayerCreateDialog } from "@/components/PlayerCreateDialog";
import { defaultTransform } from "@/engine/types";
import { nanoid } from "nanoid";

interface NodeDef { t: NodeType; label: string; icon: string; }
interface Group { titleKey: string; items: NodeDef[]; }

const GROUPS_2D: Group[] = [
  { titleKey: "palette.basics", items: [
    { t: "node2d", label: "Node2D", icon: "◯" },
    { t: "sprite", label: "Sprite", icon: "🖼" },
    { t: "animatedSprite", label: "AnimSprite", icon: "🎞" },
    { t: "text", label: "Text", icon: "🅰" },
    { t: "button", label: "Button", icon: "🔘" },
    { t: "panel", label: "Panel", icon: "▢" },
    { t: "camera2d", label: "Camera2D", icon: "🎥" },
  ]},
  { titleKey: "palette.shapes", items: [
    { t: "line2d", label: "Line2D", icon: "／" },
    { t: "polygon2d", label: "Polygon2D", icon: "▲" },
    { t: "tilemap", label: "TileMap", icon: "▦" },
    { t: "parallax", label: "Parallax", icon: "≋" },
  ]},
  { titleKey: "palette.physics", items: [
    { t: "player2d", label: "Player", icon: "🏃" },
    { t: "rigidBody2d", label: "RigidBody", icon: "⬛" },
    { t: "staticBody2d", label: "StaticBody", icon: "▭" },
    { t: "area2d", label: "Area2D", icon: "▢" },
    { t: "raycast2d", label: "RayCast2D", icon: "→" },
  ]},
  { titleKey: "palette.fx", items: [
    { t: "light2d", label: "Light2D", icon: "💡" },
    { t: "particles2d", label: "Particles", icon: "✦" },
    { t: "audio2d", label: "Audio", icon: "🔊" },
  ]},
];

const GROUPS_3D: Group[] = [
  { titleKey: "palette.basics", items: [
    { t: "node3d", label: "Node3D", icon: "◯" },
    { t: "box", label: "Box", icon: "📦" },
    { t: "sphere", label: "Sphere", icon: "⚪" },
    { t: "cylinder", label: "Cylinder", icon: "🥫" },
    { t: "capsule", label: "Capsule", icon: "💊" },
    { t: "plane", label: "Plane", icon: "▭" },
    { t: "camera3d", label: "Camera3D", icon: "🎥" },
  ]},
  { titleKey: "palette.visuals", items: [
    { t: "sprite3d", label: "Sprite3D", icon: "🖼" },
    { t: "label3d", label: "Label3D", icon: "🅰" },
    { t: "decal", label: "Decal", icon: "▢" },
    { t: "model", label: "Model", icon: "🧊" },
  ]},
  { titleKey: "palette.lighting", items: [
    { t: "light", label: "Light", icon: "💡" },
    { t: "particles3d", label: "Particles3D", icon: "✦" },
    { t: "audio3d", label: "Audio3D", icon: "🔊" },
  ]},
  { titleKey: "palette.physics", items: [
    { t: "player3d", label: "Player", icon: "🏃" },
    { t: "rigidBody3d", label: "RigidBody", icon: "⬛" },
    { t: "staticBody3d", label: "StaticBody", icon: "▭" },
    { t: "area3d", label: "Area3D", icon: "▢" },
    { t: "raycast3d", label: "RayCast3D", icon: "→" },
  ]},
];

interface GeoShape2D { name: string; icon: string; color: string; type: "polygon2d" | "staticBody2d"; points?: string; w?: number; h?: number; }
const GEO_SHAPES_2D: GeoShape2D[] = [
  { name: "Square",   icon: "■", color: "#7bf1a8", type: "staticBody2d", w: 80, h: 80 },
  { name: "Rect",     icon: "▬", color: "#22c08a", type: "staticBody2d", w: 140, h: 60 },
  { name: "Triangle", icon: "▲", color: "#f5a96b", type: "polygon2d", points: "0,-40 40,40 -40,40" },
  { name: "Diamond",  icon: "◆", color: "#7bf1a8", type: "polygon2d", points: "0,-40 40,0 0,40 -40,0" },
  { name: "Pentagon", icon: "⬟", color: "#a78bf5", type: "polygon2d", points: "0,-40 38,-12 24,38 -24,38 -38,-12" },
  { name: "Hexagon",  icon: "⬢", color: "#f56bb6", type: "polygon2d", points: "-20,-35 20,-35 40,0 20,35 -20,35 -40,0" },
  { name: "Star",     icon: "★", color: "#f5d76b", type: "polygon2d", points: "0,-40 12,-12 40,-12 18,8 26,40 0,22 -26,40 -18,8 -40,-12 -12,-12" },
  { name: "Trapezoid",icon: "⏢", color: "#6bf5e0", type: "polygon2d", points: "-40,30 -20,-30 20,-30 40,30" },
  { name: "Arrow",    icon: "➤", color: "#22c08a", type: "polygon2d", points: "-30,-15 10,-15 10,-30 40,0 10,30 10,15 -30,15" },
];

interface GeoShape3D { name: string; icon: string; color: string; type: NodeType; props: Record<string, any>; }
const GEO_SHAPES_3D: GeoShape3D[] = [
  { name: "Cube",     icon: "▣", color: "#7bf1a8", type: "box",      props: { w: 1, h: 1, d: 1, solid: true, collisionEnabled: true } },
  { name: "Sphere",   icon: "●", color: "#22c08a", type: "sphere",   props: { r: 0.6, solid: true, collisionEnabled: true } },
  { name: "Cylinder", icon: "▮", color: "#f5a96b", type: "cylinder", props: { r: 0.5, h: 1.2 } },
  { name: "Capsule",  icon: "◍", color: "#a78bf5", type: "capsule",  props: { r: 0.4, h: 1.2 } },
  { name: "Wall",     icon: "▤", color: "#6bf5e0", type: "box",      props: { w: 3, h: 1.5, d: 0.2, solid: true, collisionEnabled: true } },
  { name: "Pillar",   icon: "▯", color: "#f5d76b", type: "cylinder", props: { r: 0.3, h: 2.5, solid: true, collisionEnabled: true } },
  { name: "Ramp",     icon: "◢", color: "#f56bb6", type: "box",      props: { w: 2, h: 0.2, d: 2, solid: true, collisionEnabled: true } },
  { name: "Slab",     icon: "▭", color: "#2a4a3a", type: "box",      props: { w: 4, h: 0.3, d: 4, solid: true, collisionEnabled: true } },
];

function makeShape2D(s: GeoShape2D): GameNode {
  const props: Record<string, any> = { color: s.color, collisionEnabled: true };
  if (s.type === "polygon2d") props.points = s.points;
  if (s.type === "staticBody2d") { props.w = s.w; props.h = s.h; props.solid = true; }
  return {
    id: nanoid(8), name: s.name, type: s.type,
    transform: defaultTransform(), props, behaviors: [], children: [], visible: true,
  };
}
function makeShape3D(s: GeoShape3D): GameNode {
  return {
    id: nanoid(8), name: s.name, type: s.type,
    transform: defaultTransform(), props: { color: s.color, ...s.props }, behaviors: [], children: [], visible: true,
  };
}

export function NodePalette() {
  const doc = useEditor((s) => s.doc);
  const add = useEditor((s) => s.addNode);
  const { t } = useI18n();
  const [open, setOpen] = useState<Record<string, boolean>>({
    "palette.basics": true, "palette.physics": true, "palette.visuals": true, "palette.enemies": true, "palette.terrain": true,
  });
  const [askPlayer, setAskPlayer] = useState<NodeType | null>(null);

  if (!doc) return null;
  const groups = doc.mode === "2d" ? GROUPS_2D : GROUPS_3D;

  const tryAdd = (type: NodeType) => {
    if (type === "player2d" || type === "player3d") { setAskPlayer(type); return; }
    add(newNode(type));
  };

  const importPlatform = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const url = String(r.result);
      const img = new Image();
      img.onload = () => {
        const max = 200;
        const scale = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
        const w = Math.round((img.naturalWidth || 120) * scale);
        const h = Math.round((img.naturalHeight || 40) * scale);
        if (doc.mode === "2d") {
          const node: GameNode = {
            id: nanoid(8), name: file.name.replace(/\.[^.]+$/, "") || "Platform",
            type: "staticBody2d",
            transform: defaultTransform(),
            // transparent color so the imported image renders alone (no green/grey block behind it)
            props: { w, h, image: url, color: "transparent", solid: true, collisionEnabled: true },
            behaviors: [], children: [], visible: true,
          };
          add(node);
        } else {
          const node: GameNode = {
            id: nanoid(8), name: file.name.replace(/\.[^.]+$/, "") || "Platform",
            type: "sprite3d",
            transform: defaultTransform(),
            props: { image: url, color: "#ffffff", w: 2, h: 2 },
            behaviors: [], children: [], visible: true,
          };
          add(node);
        }
      };
      img.src = url;
    };
    r.readAsDataURL(file);
  };

  return (
    <div className="p-2 border-b max-h-[40vh] overflow-auto">
      <div className="text-[10px] font-semibold mb-2 text-muted-foreground uppercase tracking-wider">{t("palette.add")}</div>

      <label className="mb-2 flex items-center gap-2 px-2 py-2 text-[11px] rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 cursor-pointer transition-colors">
        <ImagePlus className="w-4 h-4 text-primary" />
        <span className="font-semibold text-primary">{t("palette.importPlatform")}</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { importPlatform(e.target.files?.[0]); e.currentTarget.value = ""; }} />
      </label>

      {groups.map((g) => {
        const isOpen = open[g.titleKey] ?? false;
        return (
          <div key={g.titleKey} className="mb-1">
            <button
              onClick={() => setOpen((o) => ({ ...o, [g.titleKey]: !isOpen }))}
              className="w-full flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary py-1"
            >
              {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {t(g.titleKey)}
            </button>
            {isOpen && (
              <div className="grid grid-cols-2 gap-1 mt-1 animate-fade-in">
                {g.items.map((n) => (
                  <button
                    key={n.t}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("node-type", n.t)}
                    onClick={() => tryAdd(n.t)}
                    title={n.label}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] rounded-md hover:bg-accent hover:text-primary text-left transition-colors hover-scale border border-transparent hover:border-primary/30"
                  >
                    <span className="text-sm">{n.icon}</span>
                    <span className="truncate">{n.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Geometric shapes (2D) */}
      {doc.mode === "2d" && (
        <div className="mb-1">
          <button
            onClick={() => setOpen((o) => ({ ...o, "palette.shapesgeo": !(o["palette.shapesgeo"] ?? true) }))}
            className="w-full flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary py-1"
          >
            {(open["palette.shapesgeo"] ?? true) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Geometric Shapes
          </button>
          {(open["palette.shapesgeo"] ?? true) && (
            <div className="grid grid-cols-3 gap-1 mt-1 animate-fade-in">
              {GEO_SHAPES_2D.map((s) => (
                <button
                  key={s.name}
                  onClick={() => add(makeShape2D(s))}
                  title={s.name}
                  className="flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] rounded-md hover:bg-accent hover:text-primary text-center transition-colors border border-transparent hover:border-primary/30"
                >
                  <span className="text-base leading-none">{s.icon}</span>
                  <span className="truncate w-full">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Geometric primitives (3D) */}
      {doc.mode === "3d" && (
        <div className="mb-1">
          <button
            onClick={() => setOpen((o) => ({ ...o, "palette.shapesgeo": !(o["palette.shapesgeo"] ?? true) }))}
            className="w-full flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary py-1"
          >
            {(open["palette.shapesgeo"] ?? true) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Geometric Shapes
          </button>
          {(open["palette.shapesgeo"] ?? true) && (
            <div className="grid grid-cols-3 gap-1 mt-1 animate-fade-in">
              {GEO_SHAPES_3D.map((s) => (
                <button
                  key={s.name}
                  onClick={() => add(makeShape3D(s))}
                  title={s.name}
                  className="flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] rounded-md hover:bg-accent hover:text-primary text-center transition-colors border border-transparent hover:border-primary/30"
                >
                  <span className="text-base leading-none">{s.icon}</span>
                  <span className="truncate w-full">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enemies quick-add */}
      <div className="mb-1">
        <button
          onClick={() => setOpen((o) => ({ ...o, "palette.enemies": !(o["palette.enemies"] ?? true) }))}
          className="w-full flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary py-1"
        >
          {(open["palette.enemies"] ?? true) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {t("palette.enemies")}
        </button>
        {(open["palette.enemies"] ?? true) && (
          <div className="grid grid-cols-2 gap-1 mt-1 animate-fade-in">
            {ENEMY_PRESETS.map((p) => (
              <button
                key={p.kind}
                onClick={() => add(makeEnemy(p.kind, doc.mode, { x: 0, y: doc.mode === "2d" ? 0 : 0.5, z: 0 }))}
                title={t(p.descKey)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] rounded-md hover:bg-destructive/10 hover:text-destructive text-left transition-colors border border-transparent hover:border-destructive/40"
              >
                <span className="text-sm">{p.icon}</span>
                <span className="truncate">{t(p.labelKey)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <PlayerCreateDialog
        open={askPlayer !== null}
        onCancel={() => setAskPlayer(null)}
        onConfirm={(image) => {
          const node = newNode(askPlayer!);
          if (image) node.props.image = image;
          add(node);
          setAskPlayer(null);
        }}
      />
    </div>
  );
}
