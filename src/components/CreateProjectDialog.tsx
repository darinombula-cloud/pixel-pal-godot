import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Box, Square, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n";

export function CreateProjectDialog({
  open, mode, onCancel, onConfirm,
}: {
  open: boolean;
  mode: "2d" | "3d" | null;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const m = (mode ?? "2d").toUpperCase();
  const submit = () => {
    const v = (name || t("home.project.default", { mode: m })).trim();
    if (!v) return;
    onConfirm(v);
    setName("");
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onCancel(); setName(""); } }}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-grad-surface shadow-2xl shadow-primary/20">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-grad-primary glow-primary flex items-center justify-center text-primary-foreground">
              {mode === "3d" ? <Box className="w-6 h-6" /> : <Square className="w-6 h-6" />}
            </div>
            <div>
              <DialogTitle className="text-lg bg-grad-primary bg-clip-text text-transparent inline-flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" /> {t("home.project.prompt", { mode: m })}
              </DialogTitle>
              <DialogDescription className="text-xs">{t("create.subtitle")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder={t("home.project.default", { mode: m })}
            className="h-11 text-base bg-background/60 border-primary/30 focus-visible:ring-primary"
          />
          <p className="text-[11px] text-muted-foreground">{t("create.hint")}</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel}>{t("enemy.cancel")}</Button>
          <Button onClick={submit} className="bg-grad-primary text-primary-foreground glow-primary hover:opacity-90">
            <Sparkles className="w-4 h-4 mr-1.5" /> {t("create.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
