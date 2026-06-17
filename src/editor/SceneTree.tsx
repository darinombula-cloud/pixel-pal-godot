import { useState } from "react";
import { newNode, useEditor } from "@/engine/store";
import type { GameNode } from "@/engine/types";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useI18n } from "@/i18n";

export function SceneTree() {
  const doc = useEditor((s) => s.doc);
  const sel = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const remove = useEditor((s) => s.removeNode);
  const addChildNode = useEditor((s) => s.addChildNode);
  const [toDelete, setToDelete] = useState<GameNode | null>(null);
  const [menu, setMenu] = useState<{ node: GameNode; x: number; y: number } | null>(null);
  const { t } = useI18n();
  if (!doc) return null;

  let longPressTimer: number | undefined;

  const Row = ({ n, depth }: { n: GameNode; depth: number }) => (
    <>
      <div
        onClick={() => select(n.id)}
        onDoubleClick={(e) => { e.stopPropagation(); setToDelete(n); }}
        onPointerDown={(e) => {
          if (e.pointerType !== "touch") return;
          longPressTimer = window.setTimeout(() => setMenu({ node: n, x: e.clientX, y: e.clientY }), 520);
        }}
        onPointerUp={() => { if (longPressTimer) window.clearTimeout(longPressTimer); }}
        onPointerCancel={() => { if (longPressTimer) window.clearTimeout(longPressTimer); }}
        className={`group flex items-center gap-1 px-2 py-1.5 text-xs cursor-pointer hover:bg-accent select-none ${sel === n.id ? "bg-accent" : ""}`}
        style={{ paddingLeft: 8 + depth * 12 }}
        title="Long press to add child, double-tap to delete"
      >
        <span className="flex-1 truncate">{n.name}</span>
        <span className="text-[10px] text-muted-foreground">{n.type}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setToDelete(n); }}
          className="md:opacity-0 md:group-hover:opacity-100 p-1 hover:text-destructive"
          aria-label="Delete node"
        ><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      {n.children.map((c) => <Row key={c.id} n={c} depth={depth + 1} />)}
    </>
  );

  return (
    <div className="flex-1 overflow-auto">
      <div className="text-xs font-semibold p-2 text-muted-foreground uppercase flex items-center justify-between">
        <span>Scene</span>
        <span className="text-[9px] normal-case text-muted-foreground/70 md:hidden">double-tap = delete</span>
      </div>
      {doc.nodes.length === 0 && (
        <div className="px-3 py-4 text-[11px] text-muted-foreground italic">Tap a node above to add it to the scene.</div>
      )}
      {doc.nodes.map((n) => <Row key={n.id} n={n} depth={0} />)}
      {menu && (
        <div className="fixed z-50 min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-xl" style={{ left: menu.x, top: menu.y }}>
          <button
            onClick={() => {
              addChildNode(menu.node.id, newNode(doc.mode === "2d" ? "node2d" : "node3d"));
              setMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-xs hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter une node dans la scène
          </button>
        </div>
      )}
      {menu && <div className="fixed inset-0 z-40" onPointerDown={() => setMenu(null)} />}
      <ConfirmDialog
        open={!!toDelete}
        title={toDelete ? t("home.project.delete", { name: toDelete.name }) : ""}
        confirmLabel={t("topbar.stop") === "Arrêter" ? "Supprimer" : t("topbar.stop") === "Detener" ? "Eliminar" : "Delete"}
        cancelLabel={t("enemy.cancel")}
        onCancel={() => setToDelete(null)}
        onConfirm={() => { if (toDelete) remove(toDelete.id); setToDelete(null); }}
      />
    </div>
  );
}
