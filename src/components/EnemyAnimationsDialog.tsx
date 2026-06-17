import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Sparkles, X, Bug } from "lucide-react";
import { removeBackground } from "@/lib/bg-remove";
import { toast } from "sonner";

export type EnemyAnimations = {
  idle?: string;
  walk?: string;
  attack?: string;
  jump?: string;
  hurt?: string;
  die?: string;
};

const SLOTS: { key: keyof EnemyAnimations; label: string; hint: string }[] = [
  { key: "idle",   label: "Idle",   hint: "Au repos" },
  { key: "walk",   label: "Marche", hint: "Se déplace" },
  { key: "attack", label: "Attaque", hint: "Attaque le joueur" },
  { key: "jump",   label: "Saute",  hint: "En l'air" },
  { key: "hurt",   label: "Touché", hint: "Reçoit des dégâts" },
  { key: "die",    label: "Meurt",  hint: "Mort / disparaît" },
];

export function EnemyAnimationsDialog({
  open, onSkip, onConfirm,
}: {
  open: boolean;
  onSkip: () => void;
  onConfirm: (anims: EnemyAnimations) => void;
}) {
  const [anims, setAnims] = useState<EnemyAnimations>({});
  const [busy, setBusy] = useState<string | null>(null);

  const pick = async (key: keyof EnemyAnimations, file: File | undefined) => {
    if (!file) return;
    setBusy(key);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      let out = dataUrl;
      try { out = await removeBackground(dataUrl); }
      catch { /* fallback to original */ }
      setAnims((a) => ({ ...a, [key]: out }));
    } catch {
      toast.error("Impossible de lire l'image");
    } finally { setBusy(null); }
  };

  const clear = (key: keyof EnemyAnimations) =>
    setAnims((a) => { const c = { ...a }; delete c[key]; return c; });

  const hasAny = Object.values(anims).some(Boolean);
  const submit = () => { onConfirm(anims); setAnims({}); };
  const skip = () => { setAnims({}); onSkip(); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) skip(); }}>
      <DialogContent className="sm:max-w-lg border-primary/30 bg-grad-surface shadow-2xl shadow-primary/20 max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-lg bg-grad-primary bg-clip-text text-transparent inline-flex items-center gap-1.5">
            <Bug className="w-4 h-4 text-primary" /> Images d'animation de l'ennemi
          </DialogTitle>
          <DialogDescription className="text-xs">
            Importez une image par action. Le fond est retiré automatiquement par l'IA.
            Vous pouvez n'en importer que quelques-unes (au minimum « Idle » ou « Marche »).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
          {SLOTS.map(({ key, label, hint }) => {
            const url = anims[key];
            const loading = busy === key;
            return (
              <div key={key} className="rounded-lg border border-primary/20 bg-background/40 p-2 flex flex-col items-center gap-1.5">
                <div className="text-[11px] font-semibold text-primary">{label}</div>
                <label className="relative w-full aspect-square rounded-md border border-dashed border-primary/30 bg-background/60 flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden">
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : url ? (
                    <>
                      <img src={url} alt={label} className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); clear(key); }}
                        className="absolute top-1 right-1 bg-destructive/80 hover:bg-destructive text-destructive-foreground rounded-full p-0.5"
                      ><X className="w-3 h-3" /></button>
                    </>
                  ) : (
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  )}
                  <input
                    type="file" accept="image/*" className="hidden"
                    onChange={(e) => pick(key, e.target.files?.[0])}
                    disabled={loading}
                  />
                </label>
                <div className="text-[9px] text-muted-foreground text-center leading-tight">{hint}</div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="ghost" onClick={skip}>Annuler</Button>
          <Button
            onClick={submit}
            disabled={!hasAny}
            className="bg-grad-primary text-primary-foreground glow-primary hover:opacity-90"
          >
            <Sparkles className="w-4 h-4 mr-1.5" /> Créer le monstre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
