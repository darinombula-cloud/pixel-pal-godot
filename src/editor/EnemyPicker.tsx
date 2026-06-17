import { useState } from "react";
import { useI18n } from "@/i18n";
import { ENEMY_PRESETS, type EnemyKind } from "@/engine/enemies";
import { EnemyAnimationsDialog, type EnemyAnimations } from "@/components/EnemyAnimationsDialog";
import { Sparkles, Upload } from "lucide-react";

export type EnemyPickResult =
  | { kind: EnemyKind }
  | { kind: "custom"; anims: EnemyAnimations };

export function EnemyPicker({
  x, y, onPick, onClose,
}: {
  x: number; y: number;
  onPick: (res: EnemyPickResult) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [showCustom, setShowCustom] = useState(false);
  const left = Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 800) - 280);
  const top  = Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 600) - 380);

  if (showCustom) {
    return (
      <EnemyAnimationsDialog
        open
        onSkip={onClose}
        onConfirm={(anims) => onPick({ kind: "custom", anims })}
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-[280px] rounded-lg border bg-popover text-popover-foreground shadow-2xl ring-1 ring-primary/30 animate-fade-in"
        style={{ left: Math.max(8, left), top: Math.max(8, top) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("enemy.choose")}
        </div>

        <div className="p-1.5">
          <button
            onClick={() => setShowCustom(true)}
            className="w-full text-left flex items-start gap-2 px-2 py-2 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 transition-colors mb-1.5"
          >
            <Upload className="w-5 h-5 mt-0.5 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold flex items-center gap-1">
                {t("enemy.custom")} <Sparkles className="w-3 h-3 text-primary" />
              </div>
              <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                {t("enemy.custom.desc")}
              </div>
            </div>
          </button>

          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 py-1">
            {t("enemy.defaults")}
          </div>

          {ENEMY_PRESETS.map((p) => (
            <button
              key={p.kind}
              onClick={() => onPick({ kind: p.kind })}
              className="w-full text-left flex items-start gap-2 px-2 py-2 rounded-md hover:bg-accent hover:text-primary border border-transparent hover:border-primary/30 transition-colors"
            >
              <span className="text-xl leading-none mt-0.5">{p.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t(p.labelKey)}</div>
                <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{t(p.descKey)}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="px-2 py-1.5 border-t flex justify-end">
          <button onClick={onClose} className="text-xs px-2 py-1 rounded-md hover:bg-accent text-muted-foreground">{t("enemy.cancel")}</button>
        </div>
      </div>
    </>
  );
}
