import { useEffect, useRef, useState } from "react";
import { useEditor, newNode } from "@/engine/store";
import type { NodeType } from "@/engine/types";
import { Runtime2D } from "@/engine/runtime2d";
import { MobileControls } from "./MobileControls";
import { EnemyPicker } from "./EnemyPicker";
import { HealthHud } from "./HealthHud";
import { makeEnemy, makeCustomEnemy } from "@/engine/enemies";

export function Viewport2D({ playing, onLog }: { playing: boolean; onLog: (m: string) => void }) {
  const doc = useEditor((s) => s.doc);
  const sel = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const update = useEditor((s) => s.updateNode);
  const add = useEditor((s) => s.addNode);
  const enemyMode = useEditor((s) => s.enemyMode);
  const setEnemyMode = useEditor((s) => s.setEnemyMode);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rtRef = useRef<Runtime2D | null>(null);
  const [, force] = useState(0);
  const [picker, setPicker] = useState<{ sx: number; sy: number; lx: number; ly: number } | null>(null);
  const [sceneMenu, setSceneMenu] = useState<{ sx: number; sy: number; lx: number; ly: number } | null>(null);
  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const longPress = useRef<number | null>(null);
  const imgCache = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    if (!doc || !cvRef.current) return;
    if (playing) {
      const rt = new Runtime2D(structuredClone(doc), cvRef.current);
      rt.onLog = onLog;
      rt.start();
      rtRef.current = rt;
      force((v) => v + 1);
      return () => { rt.stop(); rtRef.current = null; };
    } else {
      drawStatic();
    }
  }, [playing, doc?.id, doc?.mode, doc?.activeSceneId]);

  useEffect(() => { if (!playing) drawStatic(); });

  // Hot-reload scripts while playing — push edits from the editor doc
  // into the running runtime's cloned doc and recompile only changed nodes.
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

  function drawStatic() {
    if (!doc || !cvRef.current) return;
    const cv = cvRef.current, ctx = cv.getContext("2d")!;
    ctx.fillStyle = doc.settings.background;
    ctx.fillRect(0, 0, cv.width, cv.height);
    // grid
    ctx.strokeStyle = "#7bf1a818";
    ctx.lineWidth = 1;
    for (let x = 0; x < cv.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); ctx.stroke(); }
    for (let y = 0; y < cv.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke(); }
    // axes
    ctx.strokeStyle = "#7bf1a855"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, cv.height/2); ctx.lineTo(cv.width, cv.height/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cv.width/2, 0); ctx.lineTo(cv.width/2, cv.height); ctx.stroke();

    ctx.save();
    ctx.translate(cv.width / 2, cv.height / 2);

    // ground preview
    const g = doc.settings.ground2d;
    if (g.enabled) {
      ctx.fillStyle = g.color;
      const w = g.infinite ? cv.width + 200 : g.width;
      ctx.fillRect(-w/2, g.y - g.height/2, w, g.height);
    }

    const walk = (arr: any[]) => arr.forEach((n) => {
      ctx.save(); ctx.translate(n.transform.x, n.transform.y); ctx.rotate(n.transform.rz);
      const w = n.props.w ?? 40, h = n.props.h ?? 40;
      const fill = (color: string) => { ctx.fillStyle = color; ctx.fillRect(-w/2, -h/2, w, h); };
      if (n.props.image) {
        let img = imgCache.current[n.props.image];
        if (!img) { img = new Image(); img.crossOrigin = "anonymous"; img.src = n.props.image; imgCache.current[n.props.image] = img; img.onload = () => force((v) => v + 1); }
        if (img.complete && img.naturalWidth) ctx.drawImage(img, -w/2, -h/2, w, h);
        else fill(n.props.color || "#7bf1a8");
      } else if (n.type === "text") {
        ctx.fillStyle = n.props.color || "#fff"; ctx.font = `${n.props.size || 20}px ${n.props.font || "system-ui"}`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n.props.text || "", 0, 0);
      } else if (n.type === "button") {
        ctx.fillStyle = n.props.color || "#22c08a"; ctx.fillRect(-w/2, -h/2, w, h);
        ctx.fillStyle = "#0a1612"; ctx.font = "bold 14px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(n.props.label || "", 0, 0);
      } else if (n.type === "camera2d") {
        ctx.strokeStyle = "#7bf1a8"; ctx.lineWidth = 2; ctx.strokeRect(-80, -45, 160, 90);
        ctx.fillStyle = "#7bf1a8"; ctx.font = "10px system-ui"; ctx.fillText("CAM", 0, 0);
      } else if (n.type === "light2d") {
        ctx.strokeStyle = n.props.color || "#7bf1a8"; ctx.beginPath(); ctx.arc(0,0,n.props.radius||100,0,Math.PI*2); ctx.stroke();
      } else if (n.type === "area2d") {
        ctx.fillStyle = "#22c08a33"; ctx.fillRect(-w/2,-h/2,w,h); ctx.strokeStyle="#7bf1a8"; ctx.setLineDash([4,4]); ctx.strokeRect(-w/2,-h/2,w,h); ctx.setLineDash([]);
      } else if (n.type === "polygon2d") {
        const pts = String(n.props.points || "").split(/\s+/).map((p: string) => p.split(",").map(Number));
        ctx.fillStyle = n.props.color || "#22c08a";
        ctx.beginPath();
        pts.forEach(([px, py]: number[], i: number) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
        ctx.closePath(); ctx.fill();
      } else if (n.type === "line2d") {
        const pts = String(n.props.points || "").split(/\s+/).map((p: string) => p.split(",").map(Number));
        ctx.strokeStyle = n.props.color || "#7bf1a8";
        ctx.lineWidth = n.props.width || 2;
        ctx.beginPath();
        pts.forEach(([px, py]: number[], i: number) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
        ctx.stroke();
      } else {
        fill(n.props.color || "#7bf1a8");
      }
      if (sel === n.id) {
        ctx.strokeStyle = "#7bf1a8"; ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-w/2 - 3, -h/2 - 3, w + 6, h + 6);
        ctx.setLineDash([]);
      }
      ctx.restore();
      walk(n.children);
    });
    walk(doc.nodes);
    ctx.restore();
  }

  const toLocal = (e: React.PointerEvent | React.DragEvent) => {
    const cv = cvRef.current!;
    const r = cv.getBoundingClientRect();
    return {
      x: ((e as any).clientX - r.left) * (cv.width / r.width) - cv.width / 2,
      y: ((e as any).clientY - r.top) * (cv.height / r.height) - cv.height / 2,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!doc || playing) return;
    const p = toLocal(e);
    if (e.pointerType === "touch") {
      longPress.current = window.setTimeout(() => {
        drag.current = null;
        setSceneMenu({ sx: e.clientX, sy: e.clientY, lx: Math.round(p.x), ly: Math.round(p.y) });
      }, 540);
    }
    if (enemyMode) {
      setPicker({ sx: (e as any).clientX, sy: (e as any).clientY, lx: Math.round(p.x), ly: Math.round(p.y) });
      return;
    }
    const flat: any[] = []; const w = (a: any[]) => a.forEach((n) => { flat.push(n); w(n.children); }); w(doc.nodes);
    const hit = [...flat].reverse().find((n) => {
      const w = n.props.w ?? 40, h = n.props.h ?? 40;
      return Math.abs(p.x - n.transform.x) < w / 2 && Math.abs(p.y - n.transform.y) < h / 2;
    });
    if (hit) {
      select(hit.id);
      drag.current = { id: hit.id, ox: p.x - hit.transform.x, oy: p.y - hit.transform.y };
      cvRef.current!.setPointerCapture(e.pointerId);
    } else select(null);
  };
  const onMove = (e: React.PointerEvent) => {
    if (longPress.current) { window.clearTimeout(longPress.current); longPress.current = null; }
    if (!drag.current) return;
    const p = toLocal(e);
    update(drag.current.id, (n) => {
      n.transform.x = Math.round(p.x - drag.current!.ox);
      n.transform.y = Math.round(p.y - drag.current!.oy);
    });
    force((v) => v + 1);
  };
  const onUp = () => {
    if (longPress.current) { window.clearTimeout(longPress.current); longPress.current = null; }
    drag.current = null;
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const t = e.dataTransfer.getData("node-type") as NodeType;
    if (!t) return;
    const p = toLocal(e);
    add(newNode(t, { x: Math.round(p.x), y: Math.round(p.y) }));
  };

  if (!doc) return null;
  return (
    <div
      ref={wrapRef}
      className="relative flex-1 bg-grad-surface overflow-hidden p-1 sm:p-2"
      style={{ touchAction: playing ? "none" : "pan-x" }}
    >
      <div
        className="relative w-full h-full overflow-hidden rounded-lg shadow-2xl ring-1 ring-primary/20"
        style={{ background: doc.settings.background }}
      >
        <canvas
          ref={cvRef}
          width={doc.settings.width}
          height={doc.settings.height}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="block w-full h-full"
          style={{
            background: doc.settings.background,
            objectFit: "contain",
            touchAction: playing ? "none" : "pan-x",
          }}
        />
        {playing && rtRef.current && <HealthHud rt={rtRef.current} mode="2d" />}
        {playing && doc.settings.mobileControls && rtRef.current && (
          <MobileControls input={rtRef.current.input} joystick={doc.settings.joystick} buttons={doc.settings.buttons} />
        )}
      </div>
      {picker && (
        <EnemyPicker
          x={picker.sx} y={picker.sy}
          onClose={() => setPicker(null)}
          onPick={(res) => {
            if (res.kind === "custom") {
              add(makeCustomEnemy("2d", { x: picker.lx, y: picker.ly }, res.anims));
            } else {
              add(makeEnemy(res.kind, "2d", { x: picker.lx, y: picker.ly }));
            }
            setPicker(null);
            setEnemyMode(false);
          }}
        />
      )}
      {sceneMenu && (
        <div className="fixed z-50 min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-xl" style={{ left: sceneMenu.sx, top: sceneMenu.sy }}>
          <button
            onClick={() => {
              add(newNode("node2d", { x: sceneMenu.lx, y: sceneMenu.ly }));
              setSceneMenu(null);
            }}
            className="w-full rounded-sm px-2 py-2 text-left text-xs hover:bg-accent"
          >
            Ajouter une node dans la scène
          </button>
        </div>
      )}
      {sceneMenu && <div className="fixed inset-0 z-40" onPointerDown={() => setSceneMenu(null)} />}
    </div>
  );
}
