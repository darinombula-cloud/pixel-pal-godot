import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, User, Image as ImageIcon } from "lucide-react";
import { useI18n } from "@/i18n";

export function PlayerCreateDialog({
  open, onCancel, onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  /** image is a data URL or empty string for default shape */
  onConfirm: (image: string) => void;
}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setPreview(""); };
  const close = () => { reset(); onCancel(); };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPreview(String(r.result));
    r.readAsDataURL(f);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-grad-surface">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><User className="w-5 h-5 text-primary" />{t("player.create.title")}</DialogTitle>
          <DialogDescription>{t("player.create.desc")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          <button
            onClick={() => { onConfirm(""); reset(); }}
            className="rounded-lg border-2 border-primary/30 hover:border-primary bg-background/50 p-4 flex flex-col items-center gap-2 transition-all hover-scale"
          >
            <div className="w-14 h-20 rounded-md bg-primary glow-primary" />
            <div className="text-xs font-semibold">{t("player.create.shape")}</div>
            <div className="text-[10px] text-muted-foreground">{t("player.create.shape.desc")}</div>
          </button>

          <label className="rounded-lg border-2 border-dashed border-primary/30 hover:border-primary bg-background/50 p-4 flex flex-col items-center gap-2 cursor-pointer transition-all hover-scale">
            {preview ? (
              <img src={preview} alt="" className="w-14 h-20 object-cover rounded-md" />
            ) : (
              <div className="w-14 h-20 rounded-md bg-muted flex items-center justify-center"><ImageIcon className="w-6 h-6 text-muted-foreground" /></div>
            )}
            <div className="text-xs font-semibold flex items-center gap-1"><Upload className="w-3 h-3" />{t("player.create.image")}</div>
            <div className="text-[10px] text-muted-foreground">{t("player.create.image.desc")}</div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={close}>{t("enemy.cancel")}</Button>
          {preview && (
            <Button onClick={() => { onConfirm(preview); reset(); }} className="bg-grad-primary text-primary-foreground glow-primary">
              {t("player.create.use")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
