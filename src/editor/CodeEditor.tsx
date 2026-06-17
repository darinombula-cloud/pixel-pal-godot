import { useEffect, useMemo } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import { AlertTriangle } from "lucide-react";

export function CodeEditor({ value, onChange, placeholder, minHeight = 160 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; minHeight?: number;
}) {
  useEffect(() => { Prism.highlightAll(); }, []);

  // Surface parse-time syntax errors immediately, so users see why their
  // script "doesn't work" before hitting Play.
  const error = useMemo(() => {
    if (!value || !value.trim()) return null;
    try { new Function(value); return null; }
    catch (e: any) { return String(e?.message || e); }
  }, [value]);

  return (
    <div className="space-y-1">
      <div className="code-editor rounded-md border bg-[#0a1612] overflow-auto" style={{ minHeight }}>
        <Editor
          value={value || ""}
          onValueChange={onChange}
          highlight={(code) => Prism.highlight(code || "", Prism.languages.javascript, "javascript")}
          placeholder={placeholder}
          padding={10}
          tabSize={2}
          insertSpaces={true}
          textareaClassName="outline-none"
          style={{ fontFamily: "var(--font-mono)", fontSize: 12, minHeight, color: "#cfeede", caretColor: "#7bf1a8" }}
        />
      </div>
      {error && (
        <div className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-2 py-1.5 text-[11px]">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span className="font-mono break-all">{error}</span>
        </div>
      )}
    </div>
  );
}
