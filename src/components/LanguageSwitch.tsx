import { LANGS, useI18n, type Lang } from "@/i18n";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Globe, Check } from "lucide-react";

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[1];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
        aria-label={t("lang.label")}
      >
        <Globe className="w-4 h-4" />
        <span className="text-sm leading-none">{current.flag}</span>
        {!compact && <span className="uppercase tracking-wider">{current.code}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {LANGS.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => setLang(l.code as Lang)} className="flex items-center gap-2 cursor-pointer">
            <span className="text-base">{l.flag}</span>
            <span className="flex-1">{l.label}</span>
            {lang === l.code && <Check className="w-3.5 h-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
