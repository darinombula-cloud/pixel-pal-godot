import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/engine/store";
import { Topbar } from "./Topbar";
import { NodePalette } from "./NodePalette";
import { SceneTree } from "./SceneTree";
import { Inspector } from "./Inspector";
import { Viewport2D } from "./Viewport2D";
import { Viewport3D } from "./Viewport3D";
import { Terminal, X, Square } from "lucide-react";
import { useI18n } from "@/i18n";
import { lockLandscape, unlockOrientation } from "@/lib/orientation";

export function EditorShell({ id }: { id: string }) {
  const load = useEditor((s) => s.load);
  const doc = useEditor((s) => s.doc);
  const enemyMode = useEditor((s) => s.enemyMode);
  const [playing, setPlaying] = useState(false);
  const [logs, setLogs] = useState<{ t: number; m: string }[]>([]);
  const [mobile, setMobile] = useState<"none" | "left" | "right">("none");
  const { t } = useI18n();
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => { load(id); }, [id, load]);

  if (!doc) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t("notfound")}</div>;

  const log = (m: string) => setLogs((l) => [...l.slice(-100), { t: Date.now(), m }]);

  const onPlay = () => {
    setLogs([]);
    setPlaying(true);
    lockLandscape(shellRef.current || undefined);
  };
  const onStop = () => { setPlaying(false); unlockOrientation(); };

  return (
    <div ref={shellRef} className="h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
      {/* Hide topbar on small screens while playing — gives the game the full screen. */}
      <div className={playing ? "hidden md:block" : ""}>
        <Topbar
          playing={playing}
          onPlay={onPlay}
          onStop={onStop}
          onToggleLeft={() => setMobile(mobile === "left" ? "none" : "left")}
          onToggleRight={() => setMobile(mobile === "right" ? "none" : "right")}
        />
      </div>

      {enemyMode && (
        <div className="bg-destructive/15 border-b border-destructive/40 text-destructive px-4 py-1.5 text-xs text-center animate-fade-in">
          {t("enemy.click.hint")}
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative">
        {/* Left aside — hidden while playing */}
        <aside className={`${playing ? "hidden" : ""} ${mobile === "left" ? "fixed inset-y-0 left-0 top-11 z-40 w-[78vw] max-w-xs shadow-2xl flex" : "hidden"} md:relative md:flex md:w-60 md:top-0 border-r flex-col bg-sidebar animate-fade-in`}>
          {mobile === "left" && (
            <div className="md:hidden flex justify-end p-1.5 border-b">
              <button onClick={() => setMobile("none")} className="p-1.5 hover:bg-accent rounded-md"><X className="w-4 h-4" /></button>
            </div>
          )}
          <NodePalette />
          <SceneTree />
        </aside>
        {!playing && mobile !== "none" && <div onClick={() => setMobile("none")} className="md:hidden fixed inset-0 top-11 z-30 bg-background/60 backdrop-blur-sm" />}

        <div className="flex-1 flex flex-col min-w-0 relative">
          {doc.mode === "2d"
            ? <Viewport2D playing={playing} onLog={log} />
            : <Viewport3D playing={playing} onLog={log} />}
          {/* Console — hidden on mobile while playing so the game viewport fills the screen */}
          <div className={`${playing ? "hidden sm:block" : ""} h-16 sm:h-32 border-t bg-sidebar overflow-auto`}>
            <div className="sticky top-0 flex items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground bg-sidebar border-b">
              <Terminal className="w-3 h-3" /> {t("console.title")}
              <span className="ml-auto">{t("console.entries", { n: logs.length })}</span>
              {logs.length > 0 && <button onClick={() => setLogs([])} className="hover:text-primary">{t("console.clear")}</button>}
            </div>
            <div className="font-mono text-[11px] p-2 space-y-0.5">
              {logs.length === 0 && <div className="text-muted-foreground">{t("console.empty")}</div>}
              {logs.map((l, i) => (
                <div key={i} className="flex gap-2 animate-fade-in">
                  <span className="text-muted-foreground">{new Date(l.t).toLocaleTimeString()}</span>
                  <span className="text-foreground/90 break-all">{l.m}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Floating Stop button — only visible on mobile during Play (since topbar is hidden) */}
          {playing && (
            <button
              onClick={onStop}
              className="md:hidden absolute top-3 right-3 z-50 flex items-center gap-1 rounded-full bg-destructive text-destructive-foreground px-3 py-1.5 text-xs font-semibold shadow-lg"
            >
              <Square className="w-3.5 h-3.5" /> {t("topbar.stop")}
            </button>
          )}
        </div>

        {/* Right aside — hidden while playing */}
        <aside className={`${playing ? "hidden" : ""} ${mobile === "right" ? "fixed inset-y-0 right-0 top-11 z-40 w-[85vw] max-w-sm shadow-2xl block" : "hidden"} md:relative md:block md:w-80 md:top-0 border-l bg-sidebar animate-fade-in`}>
          {mobile === "right" && (
            <div className="md:hidden flex justify-end p-1.5 border-b">
              <button onClick={() => setMobile("none")} className="p-1.5 hover:bg-accent rounded-md"><X className="w-4 h-4" /></button>
            </div>
          )}
          <Inspector />
        </aside>
      </div>
    </div>
  );
}
