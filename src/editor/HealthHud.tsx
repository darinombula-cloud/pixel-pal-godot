import { useEffect, useState } from "react";
import type { Mode } from "@/engine/types";

interface HasDoc { doc: { nodes: any[] } }

function flat(arr: any[]): any[] {
  const out: any[] = [];
  const w = (a: any[]) => a.forEach((n) => { out.push(n); w(n.children); });
  w(arr);
  return out;
}

/** Overlay HP bars for every node with hp+maxHp props during Play. */
export function HealthHud({ rt, mode }: { rt: HasDoc | null; mode: Mode }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!rt) return;
    let raf = 0;
    const loop = () => { tick((v) => v + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [rt]);

  if (!rt) return null;
  const nodes = flat(rt.doc.nodes).filter((n) => typeof n.props?.hp === "number" && typeof n.props?.maxHp === "number");
  const player = nodes.find((n) => n.props?.collisionTag === "player") || nodes[0];
  if (!player) return null;
  const pct = Math.max(0, Math.min(1, player.props.hp / player.props.maxHp));
  const color = pct > 0.5 ? "#7bf1a8" : pct > 0.25 ? "#f5c84a" : "#ff5a5a";
  void mode;
  return (
    <div className="absolute top-2 left-2 z-20 pointer-events-none flex items-center gap-2 rounded-md bg-black/60 backdrop-blur px-2 py-1 ring-1 ring-white/10">
      <span className="text-[10px] font-bold text-white uppercase tracking-wider">{player.name}</span>
      <div className="w-32 h-2.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct * 100}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
      <span className="text-[10px] font-mono text-white tabular-nums">{Math.max(0, Math.round(player.props.hp))}/{player.props.maxHp}</span>
    </div>
  );
}
