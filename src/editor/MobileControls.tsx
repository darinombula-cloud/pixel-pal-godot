import { useEffect, useRef } from "react";
import type { Input } from "@/engine/input";
import type { JoystickConfig, ActionButton } from "@/engine/types";

export function MobileControls({ input, joystick, buttons }: {
  input: Input; joystick: JoystickConfig; buttons: ActionButton[];
}) {
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!joystick.enabled) return;
    const s = stick.current!, k = knob.current!;
    if (!s) return;
    let active: number | null = null;
    const max = joystick.size * 0.4;
    const move = (cx: number, cy: number) => {
      const r = s.getBoundingClientRect();
      const dx = cx - r.left - r.width / 2, dy = cy - r.top - r.height / 2;
      const len = Math.hypot(dx, dy) || 1;
      const mag = Math.min(max, len);
      const nx = dx / len, ny = dy / len;
      input.axisVec.x = nx * (mag / max);
      input.axisVec.y = ny * (mag / max);
      k.style.transform = `translate(${nx * mag}px, ${ny * mag}px)`;
      // visual quadrant hint
      if (hint.current) {
        const d = input.dir();
        hint.current.dataset.up = d.up ? "1" : "0";
        hint.current.dataset.down = d.down ? "1" : "0";
        hint.current.dataset.left = d.left ? "1" : "0";
        hint.current.dataset.right = d.right ? "1" : "0";
      }
    };
    const down = (e: PointerEvent) => { active = e.pointerId; s.setPointerCapture(e.pointerId); move(e.clientX, e.clientY); };
    const mv = (e: PointerEvent) => { if (active === e.pointerId) move(e.clientX, e.clientY); };
    const up = () => {
      active = null; input.axisVec.x = 0; input.axisVec.y = 0;
      k.style.transform = "translate(0,0)";
      if (hint.current) { hint.current.dataset.up = hint.current.dataset.down = hint.current.dataset.left = hint.current.dataset.right = "0"; }
    };
    s.addEventListener("pointerdown", down);
    s.addEventListener("pointermove", mv);
    s.addEventListener("pointerup", up);
    s.addEventListener("pointercancel", up);
    return () => {
      s.removeEventListener("pointerdown", down);
      s.removeEventListener("pointermove", mv);
      s.removeEventListener("pointerup", up);
      s.removeEventListener("pointercancel", up);
    };
  }, [input, joystick]);

  const stickStyle: React.CSSProperties = {
    position: "fixed",
    [joystick.position === "bottom-right" ? "right" : "left"]: 16,
    bottom: 16,
    width: joystick.size, height: joystick.size,
    borderRadius: "50%",
    background: joystick.color,
    opacity: joystick.opacity,
    pointerEvents: "auto",
    touchAction: "none",
    border: "2px solid " + joystick.knobColor + "55",
    backdropFilter: "blur(8px)",
    zIndex: 61,
  };
  const knobStyle: React.CSSProperties = {
    position: "absolute",
    left: joystick.size / 4, top: joystick.size / 4,
    width: joystick.size / 2, height: joystick.size / 2,
    borderRadius: "50%",
    background: joystick.knobColor,
    boxShadow: "0 0 16px " + joystick.knobColor + "88",
    transition: "transform 60ms",
  };
  const dot = (side: "up" | "down" | "left" | "right"): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute", width: 10, height: 10, borderRadius: "50%",
      background: joystick.knobColor,
      transition: "opacity 80ms",
      opacity: 0.25,
    };
    if (side === "up") return { ...base, top: 6, left: "50%", transform: "translateX(-50%)" };
    if (side === "down") return { ...base, bottom: 6, left: "50%", transform: "translateX(-50%)" };
    if (side === "left") return { ...base, left: 6, top: "50%", transform: "translateY(-50%)" };
    return { ...base, right: 6, top: "50%", transform: "translateY(-50%)" };
  };

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60 }}>
      {joystick.enabled && (
        <div ref={stick} style={stickStyle}>
          <div ref={hint} data-up="0" data-down="0" data-left="0" data-right="0" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <div className="joy-dot" data-side="up" style={dot("up")} />
            <div className="joy-dot" data-side="down" style={dot("down")} />
            <div className="joy-dot" data-side="left" style={dot("left")} />
            <div className="joy-dot" data-side="right" style={dot("right")} />
          </div>
          <div ref={knob} style={knobStyle} />
          <style>{`
            [data-up="1"] .joy-dot[data-side="up"],
            [data-down="1"] .joy-dot[data-side="down"],
            [data-left="1"] .joy-dot[data-side="left"],
            [data-right="1"] .joy-dot[data-side="right"] { opacity: 1 !important; box-shadow: 0 0 10px ${joystick.knobColor}; }
          `}</style>
        </div>
      )}
      <div style={{ pointerEvents: "auto" }}>
        {buttons.map((b, i) => (
          <button
            key={i}
            onPointerDown={(e) => { e.preventDefault(); input.buttons.add(b.key); }}
            onPointerUp={() => input.buttons.delete(b.key)}
            onPointerCancel={() => input.buttons.delete(b.key)}
            style={{
              position: "fixed", right: b.x, bottom: b.y,
              width: b.size, height: b.size, borderRadius: "50%",
              background: b.color, color: "#0a1612", border: "none",
              fontWeight: 700, fontSize: b.size * 0.35,
              touchAction: "none", boxShadow: "0 4px 16px " + b.color + "66",
              zIndex: 61,
            }}
          >{b.label}</button>
        ))}
      </div>
    </div>
  );
}
