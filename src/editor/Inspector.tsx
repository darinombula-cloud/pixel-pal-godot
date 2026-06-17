import { useEditor, findNode, flatNodes } from "@/engine/store";
import { BEHAVIOR_META } from "@/engine/behaviors";
import type { BehaviorKind, GameNode } from "@/engine/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X, Upload, Loader2 } from "lucide-react";
import { CodeEditor } from "./CodeEditor";
import { removeBackground } from "@/lib/bg-remove";
import { useState } from "react";
import { toast } from "sonner";

/** Reusable scene-node picker — replaces "type the target name" text inputs. */
function NodePicker({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude?: string }) {
  const doc = useEditor((s) => s.doc);
  if (!doc) return null;
  const nodes = flatNodes(doc).filter((n) => n.id !== exclude);
  return (
    <Select value={value || "__none"} onValueChange={(v) => onChange(v === "__none" ? "" : v)}>
      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="— pick a node —" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">— none —</SelectItem>
        {nodes.map((n) => (
          <SelectItem key={n.id} value={n.name}>
            <span className="font-medium">{n.name}</span>
            <span className="text-muted-foreground text-[10px] ml-2">{n.type}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const TARGET_KEYS = new Set(["target", "follow", "template"]);

export function Inspector() {
  const doc = useEditor((s) => s.doc);
  const sel = useEditor((s) => s.selectedId);
  const update = useEditor((s) => s.updateNode);
  const [removingBg, setRemovingBg] = useState(false);
  if (!doc) return null;
  const node = sel ? findNode(doc, sel) : null;
  if (!node) return <SceneSettingsPanel />;

  const set = (fn: (n: GameNode) => void) => update(node.id, fn);


  const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(f);
    });
    setRemovingBg(true);
    try {
      const out = await removeBackground(dataUrl);
      set((n) => { n.props.image = out; });
      toast.success("Background removed");
    } catch {
      set((n) => { n.props.image = dataUrl; });
    } finally {
      setRemovingBg(false);
      e.target.value = "";
    }
  };

  const onAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(f);
    });
    set((n) => { n.props.url = dataUrl; });
    toast.success("Audio imported");
    e.target.value = "";
  };

  return (
    <div className="overflow-auto h-full text-sm">
      <Tabs defaultValue="props" className="w-full">
        <TabsList className="w-full grid grid-cols-3 rounded-none border-b h-9">
          <TabsTrigger value="props" className="text-[11px]">Node</TabsTrigger>
          <TabsTrigger value="style" className="text-[11px]">Style</TabsTrigger>
          <TabsTrigger value="behaviors" className="text-[11px]">Logic</TabsTrigger>
        </TabsList>

        <TabsContent value="props" className="m-0">
          <Section title="Identity">
            <Field label="Name"><Input value={node.name} onChange={(e) => set((n) => { n.name = e.target.value; })} className="h-7" /></Field>
            <Field label="Visible">
              <Switch checked={node.visible !== false} onCheckedChange={(v) => set((n) => { n.visible = v; })} />
            </Field>
          </Section>
          <Section title="Transform">
            <div className="grid grid-cols-3 gap-1">
              {Num("X", node.transform.x, (v) => set((n) => (n.transform.x = v)))}
              {Num("Y", node.transform.y, (v) => set((n) => (n.transform.y = v)))}
              {Num("Z", node.transform.z, (v) => set((n) => (n.transform.z = v)))}
            </div>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {Num("RX", node.transform.rx, (v) => set((n) => (n.transform.rx = v)))}
              {Num("RY", node.transform.ry, (v) => set((n) => (n.transform.ry = v)))}
              {Num("RZ", node.transform.rz, (v) => set((n) => (n.transform.rz = v)))}
            </div>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {Num("SX", node.transform.sx, (v) => set((n) => (n.transform.sx = v)))}
              {Num("SY", node.transform.sy, (v) => set((n) => (n.transform.sy = v)))}
              {Num("SZ", node.transform.sz, (v) => set((n) => (n.transform.sz = v)))}
            </div>
          </Section>

          <Section title="Collision">
            <Field label="Collision enabled">
              <Switch checked={node.props.collisionEnabled === true} onCheckedChange={(v) => set((n) => { n.props.collisionEnabled = v; })} />
            </Field>
            <Field label="Is sensor (overlap only)">
              <Switch checked={node.props.isSensor === true} onCheckedChange={(v) => set((n) => { n.props.isSensor = v; })} />
            </Field>
            <Field label="Tag"><Input value={node.props.collisionTag ?? ""} placeholder="e.g. player, enemy, pickup" onChange={(e) => set((n) => { n.props.collisionTag = e.target.value; })} className="h-7" /></Field>
            <div className="grid grid-cols-3 gap-1">
              <Field label="Col W"><Input type="number" step="0.1" value={node.props.collisionW ?? ""} placeholder="auto" onChange={(e) => set((n) => { n.props.collisionW = e.target.value ? parseFloat(e.target.value) : undefined; })} className="h-7" /></Field>
              <Field label="Col H"><Input type="number" step="0.1" value={node.props.collisionH ?? ""} placeholder="auto" onChange={(e) => set((n) => { n.props.collisionH = e.target.value ? parseFloat(e.target.value) : undefined; })} className="h-7" /></Field>
              <Field label="Col D"><Input type="number" step="0.1" value={node.props.collisionD ?? ""} placeholder="auto" onChange={(e) => set((n) => { n.props.collisionD = e.target.value ? parseFloat(e.target.value) : undefined; })} className="h-7" /></Field>
            </div>
            <p className="text-[10px] text-muted-foreground">Leave size blank to match render width/height/depth.</p>
          </Section>

          <Section title="Properties">
            {Object.entries(node.props)
              .filter(([k]) => !["collisionEnabled", "isSensor", "collisionTag", "collisionW", "collisionH", "collisionD"].includes(k))
              .map(([k, v]) => (
              <Field key={k} label={k}>
                {k === "follow" ? (
                  <NodePicker value={String(v ?? "")} onChange={(val) => set((n) => { n.props[k] = val; })} exclude={node.id} />
                ) : typeof v === "boolean" ? (
                  <Switch checked={v} onCheckedChange={(val) => set((n) => { n.props[k] = val; })} />
                ) : typeof v === "number" ? (
                  <Input type="number" step="0.1" value={v} onChange={(e) => set((n) => { n.props[k] = parseFloat(e.target.value) || 0; })} className="h-7" />
                ) : k === "color" ? (
                  <div className="flex gap-1">
                    <input type="color" value={v || "#7bf1a8"} onChange={(e) => set((n) => { n.props[k] = e.target.value; })} className="h-7 w-10 rounded border bg-transparent" />
                    <Input value={v ?? ""} onChange={(e) => set((n) => { n.props[k] = e.target.value; })} className="h-7" />
                  </div>
                ) : k === "image" ? (
                  <div className="space-y-1">
                    <Input value={v ?? ""} placeholder="URL or data:..." onChange={(e) => set((n) => { n.props[k] = e.target.value; })} className="h-7" />
                    <label className="flex items-center gap-1 text-[10px] cursor-pointer hover:text-primary">
                      {removingBg ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {removingBg ? "Removing background…" : "Upload image (auto-removes background)"}
                      <input type="file" accept="image/*" className="hidden" onChange={onImage} disabled={removingBg} />
                    </label>
                  </div>
                ) : k === "url" && (node.type === "audio2d" || node.type === "audio3d") ? (
                  <div className="space-y-1">
                    <Input value={v ?? ""} placeholder="URL or data:audio..." onChange={(e) => set((n) => { n.props[k] = e.target.value; })} className="h-7" />
                    <label className="flex items-center gap-1 text-[10px] cursor-pointer hover:text-primary">
                      <Upload className="w-3 h-3" /> Import audio from phone
                      <input type="file" accept="audio/*" className="hidden" onChange={onAudio} />
                    </label>
                  </div>
                ) : k === "grid" || k === "points" ? (
                  <Textarea value={v ?? ""} onChange={(e) => set((n) => { n.props[k] = e.target.value; })} className="font-mono text-[11px] h-20" />
                ) : (
                  <Input value={v ?? ""} onChange={(e) => set((n) => { n.props[k] = e.target.value; })} className="h-7" />
                )}
              </Field>
            ))}
          </Section>
        </TabsContent>

        <TabsContent value="style" className="m-0">
          <Section title="Visual Style">
            <p className="text-[10px] text-muted-foreground mb-2">Applied to text / buttons / panels.</p>
            {StyleEntry("borderRadius", "number", node.style?.borderRadius ?? 0, set)}
            {StyleEntry("opacity", "number", node.style?.opacity ?? 1, set)}
            {StyleEntry("zIndex", "number", node.style?.zIndex ?? 0, set)}
            {StyleEntry("fontWeight", "number", node.style?.fontWeight ?? 400, set)}
            {StyleEntry("color", "color", node.style?.color ?? "#ffffff", set)}
            {StyleEntry("borderColor", "color", node.style?.borderColor ?? "#7bf1a8", set)}
            {StyleEntry("borderWidth", "number", node.style?.borderWidth ?? 0, set)}
            {StyleEntry("shadow", "text", node.style?.shadow ?? "", set)}
          </Section>
        </TabsContent>

        <TabsContent value="behaviors" className="m-0">
          <Section title="Behaviors">
            {node.behaviors.map((b, i) => (
              <div key={i} className="rounded-md border bg-muted/30 p-2 mb-2 animate-fade-in">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-xs text-primary">{BEHAVIOR_META[b.kind]?.label || b.kind}</span>
                  <button onClick={() => set((n) => { n.behaviors.splice(i, 1); })} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                </div>
                {(BEHAVIOR_META[b.kind]?.params || []).map((p) => (
                  <Field key={p.key} label={p.label}>
                    {TARGET_KEYS.has(p.key) ? (
                      <NodePicker value={String(b.params[p.key] ?? "")} onChange={(val) => set((n) => { n.behaviors[i].params[p.key] = val; })} exclude={node.id} />
                    ) : p.type === "number" ? (
                      <Input type="number" step="0.1" value={b.params[p.key] ?? p.default} onChange={(e) => set((n) => { n.behaviors[i].params[p.key] = parseFloat(e.target.value) || 0; })} className="h-7" />
                    ) : p.type === "boolean" ? (
                      <Switch checked={!!b.params[p.key]} onCheckedChange={(val) => set((n) => { n.behaviors[i].params[p.key] = val; })} />
                    ) : p.key === "script" ? (
                      <CodeEditor value={b.params[p.key] ?? p.default} onChange={(v) => set((n) => { n.behaviors[i].params[p.key] = v; })} minHeight={80} />
                    ) : (
                      <Input value={b.params[p.key] ?? p.default} onChange={(e) => set((n) => { n.behaviors[i].params[p.key] = e.target.value; })} className="h-7" />
                    )}
                  </Field>
                ))}
              </div>
            ))}
            <Select value="" onValueChange={(k) => {
              if (!k) return;
              const meta = BEHAVIOR_META[k as BehaviorKind];
              const params: Record<string, any> = {};
              meta?.params.forEach((p) => (params[p.key] = p.default));
              set((n) => n.behaviors.push({ kind: k as BehaviorKind, params }));
            }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Add behavior…" /></SelectTrigger>
              <SelectContent>
                {Object.keys(BEHAVIOR_META).map((k) => (
                  <SelectItem key={k} value={k}>{BEHAVIOR_META[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>
        </TabsContent>

      </Tabs>
    </div>
  );
}

function StyleEntry(key: string, type: "number" | "text" | "color", value: any, set: (fn: (n: GameNode) => void) => void) {
  return (
    <Field label={key} key={key}>
      {type === "color" ? (
        <input type="color" value={value} onChange={(e) => set((n) => { (n.style ||= {})[key] = e.target.value; })} className="h-7 w-full rounded border bg-transparent" />
      ) : type === "number" ? (
        <Input type="number" step="0.05" value={value} onChange={(e) => set((n) => { (n.style ||= {})[key] = parseFloat(e.target.value) || 0; })} className="h-7" />
      ) : (
        <Input value={value} onChange={(e) => set((n) => { (n.style ||= {})[key] = e.target.value; })} className="h-7" />
      )}
    </Field>
  );
}

function Num(label: string, value: number, onChange: (v: number) => void) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input type="number" step="0.1" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="h-7" />
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1.5">
      <Label className="text-[10px] capitalize text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-3 border-b">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-primary/70 mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SceneSettingsPanel() {
  const doc = useEditor((s) => s.doc);
  const setSettings = useEditor((s) => s.updateSettings);
  if (!doc) return null;
  const s = doc.settings;
  return (
    <div className="overflow-auto h-full text-sm animate-fade-in">
      <div className="p-3 text-[11px] text-muted-foreground border-b">
        Select a node to edit it — or tweak the scene settings below.
      </div>
      <Section title="Scene">
        <Field label="Background"><input type="color" value={s.background} onChange={(e) => setSettings((x) => { x.background = e.target.value; })} className="h-7 w-full rounded border bg-transparent" /></Field>
        <div className="grid grid-cols-2 gap-1">
          <Field label="Width"><Input type="number" value={s.width} onChange={(e) => setSettings((x) => { x.width = +e.target.value; })} className="h-7" /></Field>
          <Field label="Height"><Input type="number" value={s.height} onChange={(e) => setSettings((x) => { x.height = +e.target.value; })} className="h-7" /></Field>
        </div>
        <Field label="Gravity"><Input type="number" value={s.gravity} onChange={(e) => setSettings((x) => { x.gravity = +e.target.value; })} className="h-7" /></Field>
      </Section>

      {doc.mode === "2d" && (
        <Section title="Ground (2D)">
          <Field label="Enabled"><Switch checked={s.ground2d.enabled} onCheckedChange={(v) => setSettings((x) => { x.ground2d.enabled = v; })} /></Field>
          <Field label="Infinite"><Switch checked={s.ground2d.infinite} onCheckedChange={(v) => setSettings((x) => { x.ground2d.infinite = v; })} /></Field>
          {!s.ground2d.infinite && <Field label="Width"><Input type="number" value={s.ground2d.width} onChange={(e) => setSettings((x) => { x.ground2d.width = +e.target.value; })} className="h-7" /></Field>}
          <Field label="Height"><Input type="number" value={s.ground2d.height} onChange={(e) => setSettings((x) => { x.ground2d.height = +e.target.value; })} className="h-7" /></Field>
          <Field label="Y position"><Input type="number" value={s.ground2d.y} onChange={(e) => setSettings((x) => { x.ground2d.y = +e.target.value; })} className="h-7" /></Field>
          <Field label="Color"><input type="color" value={s.ground2d.color} onChange={(e) => setSettings((x) => { x.ground2d.color = e.target.value; })} className="h-7 w-full rounded border bg-transparent" /></Field>
        </Section>
      )}

      {doc.mode === "3d" && (
        <Section title="3D Physics">
          <Field label="Enable Rapier physics">
            <Switch checked={s.usePhysics3d} onCheckedChange={(v) => setSettings((x) => { x.usePhysics3d = v; })} />
          </Field>
          <p className="text-[10px] text-muted-foreground">Loads Rapier on Play. Nodes with <em>collisionEnabled</em> get colliders; players become dynamic bodies.</p>
        </Section>
      )}

      <Section title="Mobile Controls">
        <Field label="Show on Play"><Switch checked={s.mobileControls} onCheckedChange={(v) => setSettings((x) => { x.mobileControls = v; })} /></Field>
        <Field label="Joystick enabled"><Switch checked={s.joystick.enabled} onCheckedChange={(v) => setSettings((x) => { x.joystick.enabled = v; })} /></Field>
        <div className="grid grid-cols-2 gap-1">
          <Field label="Size"><Input type="number" value={s.joystick.size} onChange={(e) => setSettings((x) => { x.joystick.size = +e.target.value; })} className="h-7" /></Field>
          <Field label="Opacity"><Input type="number" step="0.05" value={s.joystick.opacity} onChange={(e) => setSettings((x) => { x.joystick.opacity = +e.target.value; })} className="h-7" /></Field>
        </div>
        <Field label="Base color"><input type="color" value={s.joystick.color} onChange={(e) => setSettings((x) => { x.joystick.color = e.target.value; })} className="h-7 w-full rounded border bg-transparent" /></Field>
        <Field label="Knob color"><input type="color" value={s.joystick.knobColor} onChange={(e) => setSettings((x) => { x.joystick.knobColor = e.target.value; })} className="h-7 w-full rounded border bg-transparent" /></Field>
        <Field label="Position">
          <Select value={s.joystick.position} onValueChange={(v) => setSettings((x) => { x.joystick.position = v as any; })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bottom-left">Bottom Left</SelectItem>
              <SelectItem value="bottom-right">Bottom Right</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title="Action Buttons">
        {s.buttons.map((b, i) => (
          <div key={i} className="border rounded-md p-2 mb-2 bg-muted/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{b.label} → {b.key}</span>
              <button onClick={() => setSettings((x) => { x.buttons.splice(i, 1); })}><X className="w-3 h-3" /></button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <Field label="Label"><Input value={b.label} onChange={(e) => setSettings((x) => { x.buttons[i].label = e.target.value; })} className="h-7" /></Field>
              <Field label="Key"><Input value={b.key} onChange={(e) => setSettings((x) => { x.buttons[i].key = e.target.value; })} className="h-7" /></Field>
              <Field label="Size"><Input type="number" value={b.size} onChange={(e) => setSettings((x) => { x.buttons[i].size = +e.target.value; })} className="h-7" /></Field>
              <Field label="Color"><input type="color" value={b.color} onChange={(e) => setSettings((x) => { x.buttons[i].color = e.target.value; })} className="h-7 w-full rounded border bg-transparent" /></Field>
              <Field label="X (right)"><Input type="number" value={b.x} onChange={(e) => setSettings((x) => { x.buttons[i].x = +e.target.value; })} className="h-7" /></Field>
              <Field label="Y (bottom)"><Input type="number" value={b.y} onChange={(e) => setSettings((x) => { x.buttons[i].y = +e.target.value; })} className="h-7" /></Field>
            </div>
          </div>
        ))}
        <button
          onClick={() => setSettings((x) => { x.buttons.push({ label: "C", key: "action", color: "#22c08a", size: 56, x: 24, y: 160 }); })}
          className="w-full h-8 text-xs border border-dashed rounded-md hover:bg-accent hover:text-primary transition-colors"
        >+ Add button</button>
      </Section>
    </div>
  );
}
