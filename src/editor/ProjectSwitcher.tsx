import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { listProjects, createProject } from "@/engine/store";
import type { Mode } from "@/engine/types";
import { Plus, FolderOpen, Square, Box, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ProjectSwitcher({ currentId }: { currentId: string }) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const projects = listProjects();

  const create = (mode: Mode) => {
    const d = createProject(`Untitled ${mode.toUpperCase()}`, mode);
    setOpen(false);
    nav({ to: "/editor/$id", params: { id: d.id } });
  };

  const go = (id: string) => {
    if (id === currentId) { setOpen(false); return; }
    setOpen(false);
    nav({ to: "/editor/$id", params: { id } });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="shrink-0 p-1.5 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
          aria-label="Switch project"
          title="Switch or create project"
        >
          <Plus className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">New project</div>
        <div className="grid grid-cols-2 gap-1 px-1">
          <button onClick={() => create("2d")} className="flex items-center gap-1.5 px-2 py-2 text-xs rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-medium">
            <Square className="w-3.5 h-3.5" /> New 2D
          </button>
          <button onClick={() => create("3d")} className="flex items-center gap-1.5 px-2 py-2 text-xs rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-medium">
            <Box className="w-3.5 h-3.5" /> New 3D
          </button>
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5 mt-2 flex items-center gap-1">
          <FolderOpen className="w-3 h-3" /> Switch project
        </div>
        <div className="max-h-64 overflow-auto">
          {projects.length === 0 && <div className="px-2 py-2 text-[11px] text-muted-foreground italic">No projects yet.</div>}
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => go(p.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-accent text-left ${p.id === currentId ? "bg-accent/50" : ""}`}
            >
              <span className="text-[9px] uppercase font-semibold text-primary/70 w-7 shrink-0">{p.mode}</span>
              <span className="truncate flex-1">{p.name}</span>
              {p.id === currentId && <Check className="w-3 h-3 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
