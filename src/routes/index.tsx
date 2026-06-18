import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listProjects, createProject, deleteProject, setPlayerAnimations } from "@/engine/store";
import type { SceneDoc } from "@/engine/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Gamepad2, Trash2, Square, BookOpen, Sparkles, Zap, Code2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PlayerAnimationsDialog, type PlayerAnimations } from "@/components/PlayerAnimationsDialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Forge — Browser game builder, 2D & 3D" },
      { name: "description", content: "A browser-based, low-code game builder. Drag-and-drop 2D canvas or three.js 3D scenes, preset behaviors, mobile joystick, and one-click export." },
    ],
  }),
  component: Home,
});

function Home() {
  const [projects, setProjects] = useState<SceneDoc[]>([]);
  const [creating, setCreating] = useState<"2d" | "3d" | null>(null);
  const [toDelete, setToDelete] = useState<SceneDoc | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const nav = useNavigate();
  const { t } = useI18n();
  useEffect(() => { setProjects(listProjects()); }, []);

  const confirmCreate = (name: string) => {
    setCreating(null);
    // Always ask for player animations BEFORE creating the project (mobile-first 2D).
    setPendingName(name);
  };

  const finalizeProject = (anims?: PlayerAnimations) => {
    const name = pendingName;
    setPendingName(null);
    if (!name) return;
    const d = createProject(name, "2d");
    if (anims && Object.keys(anims).length > 0) setPlayerAnimations(d.id, anims);
    nav({ to: "/editor/$id", params: { id: d.id } });
  };


  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b backdrop-blur sticky top-0 z-10 bg-background/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-3">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-grad-primary glow-primary flex items-center justify-center">
            <Gamepad2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">Forge<span className="text-primary">.</span></h1>
          <span className="text-xs text-muted-foreground hidden md:inline truncate">{t("brand.tag")}</span>
          <div className="flex-1" />
          <LanguageSwitch />
          <Link to="/docs" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1.5"><BookOpen className="w-4 h-4" /><span className="hidden sm:inline">{t("nav.docs")}</span></Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs mb-4">
          <Sparkles className="w-3.5 h-3.5" /> {t("home.badge")}
        </div>
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
          {t("home.title.a")} <span className="bg-grad-primary bg-clip-text text-transparent">{t("home.title.b")}</span>
        </h2>
        <p className="text-muted-foreground mt-5 max-w-2xl text-base sm:text-lg">
          {t("home.subtitle")}
        </p>

        <div className="flex flex-wrap gap-2 sm:gap-3 mt-8">
          <Button size="lg" onClick={() => setCreating("2d")} className="bg-grad-primary text-primary-foreground glow-primary hover:opacity-90">
            <Square className="w-4 h-4 mr-2" /> {t("home.cta.new2d")}
          </Button>
          <Link to="/docs">
            <Button size="lg" variant="ghost"><BookOpen className="w-4 h-4 mr-2" />{t("home.cta.docs")}</Button>
          </Link>
        </div>
        <CreateProjectDialog open={creating !== null} mode={creating} onCancel={() => setCreating(null)} onConfirm={confirmCreate} />

        <div className="grid md:grid-cols-3 gap-3 mt-14">
          <Feature icon={<Zap className="w-5 h-5" />} title={t("home.feat1.title")} desc={t("home.feat1.desc")} />
          <Feature icon={<Code2 className="w-5 h-5" />} title={t("home.feat2.title")} desc={t("home.feat2.desc")} />
          <Feature icon={<Sparkles className="w-5 h-5" />} title={t("home.feat3.title")} desc={t("home.feat3.desc")} />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <h3 className="font-semibold mb-4 text-lg">{t("home.projects")}</h3>
        {projects.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <p className="text-sm text-muted-foreground">{t("home.projects.empty")}</p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((p) => (
              <Card key={p.id} className="p-4 group hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all animate-fade-in">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">{p.mode} · {new Date(p.updatedAt).toLocaleDateString()}</div>
                  </div>
                  <button
                    onClick={() => setToDelete(p)}
                    className="opacity-60 sm:opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                  ><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="flex gap-2 mt-3">
                  <Link to="/editor/$id" params={{ id: p.id }} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90">{t("home.project.open")}</Link>
                  <Link to="/play/$id" params={{ id: p.id }} target="_blank" className="text-xs px-3 py-1.5 rounded-md border hover:border-primary hover:text-primary">{t("home.project.play")}</Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
      <ConfirmDialog
        open={!!toDelete}
        title={toDelete ? t("home.project.delete", { name: toDelete.name }) : ""}
        onCancel={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) { deleteProject(toDelete.id); setProjects(listProjects()); } setToDelete(null); }}
      />
      <PlayerAnimationsDialog
        open={!!pendingName}
        onSkip={() => finalizeProject()}
        onConfirm={(anims) => finalizeProject(anims)}
      />
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="p-5 hover:border-primary/50 transition-all hover-scale">
      <div className="w-9 h-9 rounded-md bg-primary/15 text-primary flex items-center justify-center mb-3">{icon}</div>
      <div className="font-semibold mb-1">{title}</div>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </Card>
  );
}
