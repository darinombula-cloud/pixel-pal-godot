import { Link } from "@tanstack/react-router";
import { useEditor } from "@/engine/store";
import { exportHTML, download } from "@/engine/exporter";
import { Play, Square, Download, ArrowLeft, Save, BookOpen, Gamepad2, Skull, PanelLeft, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ProjectSwitcher } from "./ProjectSwitcher";

export function Topbar({
  playing, onPlay, onStop, onToggleLeft, onToggleRight,
}: {
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
}) {
  const doc = useEditor((s) => s.doc);
  const rename = useEditor((s) => s.rename);
  const save = useEditor((s) => s.save);
  const enemyMode = useEditor((s) => s.enemyMode);
  const setEnemyMode = useEditor((s) => s.setEnemyMode);
  const { t } = useI18n();
  if (!doc) return null;
  return (
    <div className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 h-11 sm:h-12 border-b bg-sidebar overflow-x-auto">
      <Link to="/" className="p-1.5 hover:bg-accent rounded-md transition-colors shrink-0"><ArrowLeft className="w-4 h-4" /></Link>
      {onToggleLeft && (
        <button onClick={onToggleLeft} className="md:hidden p-1.5 hover:bg-accent rounded-md shrink-0" aria-label={t("topbar.nodes")}>
          <PanelLeft className="w-4 h-4" />
        </button>
      )}
      <ProjectSwitcher currentId={doc.id} />
      <Gamepad2 className="w-4 h-4 text-primary shrink-0 hidden sm:block" />
      <Input
        value={doc.name}
        onChange={(e) => rename(e.target.value)}
        className="h-7 sm:h-8 w-24 sm:w-56 bg-background/50 shrink-0 text-xs sm:text-sm"
      />
      <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md bg-primary/15 text-primary uppercase font-semibold tracking-wider shrink-0">{doc.mode}</span>
      <div className="flex-1" />
      <Button
        size="sm"
        variant={enemyMode ? "default" : "outline"}
        onClick={() => setEnemyMode(!enemyMode)}
        className={`shrink-0 ${enemyMode ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
        title={t("enemy.click.hint")}
      >
        <Skull className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">{t("topbar.enemy")}</span>
      </Button>
      <Link to="/docs" className="text-xs text-muted-foreground hover:text-primary hidden md:flex items-center gap-1 px-2 shrink-0"><BookOpen className="w-3.5 h-3.5" />{t("nav.docs")}</Link>
      <div className="hidden md:block shrink-0"><LanguageSwitch compact /></div>
      <Button variant="ghost" size="sm" onClick={save} className="shrink-0"><Save className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">{t("topbar.save")}</span></Button>
      {!playing
        ? <Button size="sm" onClick={onPlay} className="bg-grad-primary text-primary-foreground glow-primary hover:opacity-90 shrink-0"><Play className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">{t("topbar.play")}</span></Button>
        : <Button size="sm" variant="destructive" onClick={onStop} className="shrink-0"><Square className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">{t("topbar.stop")}</span></Button>}
      <Button variant="outline" size="sm" onClick={() => download(`${doc.name}.html`, exportHTML(doc))} className="shrink-0">
        <Download className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">{t("topbar.export")}</span>
      </Button>
      {onToggleRight && (
        <button onClick={onToggleRight} className="md:hidden p-1.5 hover:bg-accent rounded-md shrink-0" aria-label={t("topbar.inspector")}>
          <PanelRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
