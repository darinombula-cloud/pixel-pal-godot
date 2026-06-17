import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getProject } from "@/engine/store";
import { Runtime2D } from "@/engine/runtime2d";
import { Runtime3D } from "@/engine/runtime3d";
import { MobileControls } from "@/editor/MobileControls";
import type { SceneDoc } from "@/engine/types";
import type { Input } from "@/engine/input";

export const Route = createFileRoute("/play/$id")({
  head: () => ({ meta: [{ title: "Play — Web Game Builder" }] }),
  component: PlayPage,
});

function PlayPage() {
  const { id } = Route.useParams();
  const wrap = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState<Input | null>(null);
  const [doc, setDoc] = useState<SceneDoc | null>(null);

  useEffect(() => {
    const d = getProject(id);
    if (!d || !wrap.current) return;
    setDoc(d);
    if (d.mode === "2d") {
      const cv = document.createElement("canvas");
      cv.width = d.settings.width; cv.height = d.settings.height;
      cv.style.cssText = "display:block;margin:auto;max-width:100%;max-height:100vh";
      wrap.current.appendChild(cv);
      const rt = new Runtime2D(d, cv); rt.start();
      setInput(rt.input);
      return () => { rt.stop(); cv.remove(); };
    } else {
      const rt = new Runtime3D(d, wrap.current); rt.start();
      setInput(rt.input);
      return () => rt.dispose();
    }
  }, [id]);

  return (
    <div className="fixed inset-0 bg-black">
      <div ref={wrap} className="w-full h-full flex items-center justify-center" />
      {input && doc?.settings.mobileControls && (
        <MobileControls input={input} joystick={doc.settings.joystick} buttons={doc.settings.buttons} />
      )}
    </div>
  );
}
