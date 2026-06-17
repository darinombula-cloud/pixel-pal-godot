import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { LanguageSwitch } from "@/components/LanguageSwitch";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Docs — Forge" },
      { name: "description", content: "How to build 2D and 3D games in Forge: nodes, behaviors, scripting API, mobile controls, and one-file export." },
    ],
  }),
  component: Docs,
});

function Docs() {
  const { t } = useI18n();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded-md hover:bg-accent shrink-0"><ArrowLeft className="w-4 h-4" /></Link>
          <Gamepad2 className="w-5 h-5 text-primary shrink-0" />
          <h1 className="font-bold truncate">{t("docs.title")}</h1>
          <div className="flex-1" />
          <LanguageSwitch />
        </div>
      </header>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-10 prose prose-invert prose-headings:tracking-tight prose-p:text-muted-foreground prose-h1:text-foreground prose-h2:text-foreground prose-h3:text-foreground prose-code:text-primary prose-strong:text-foreground space-y-12 animate-fade-in">
        <Section title={t("docs.sec1")}>
          <p>Forge is a browser-based game builder. Create a <strong>2D</strong> or <strong>3D</strong> project from the home page. Each project lives in your browser and exports to a single self-contained file.</p>
          <ul>
            <li><strong>Add nodes</strong> from the left palette (drag onto the viewport, or click to add at origin).</li>
            <li><strong>Move things</strong> by clicking and dragging in 2D; orbit/zoom in 3D (wheel + drag).</li>
            <li><strong>Inspect</strong> the selected node on the right: Node properties, visual Style, Logic (behaviors), and Script tabs.</li>
            <li><strong>Play</strong> with the top button to run your scene. <strong>Stop</strong> returns to edit mode.</li>
          </ul>
        </Section>

        <Section title={t("docs.sec2")}>
          <h3>2D</h3>
          <Grid items={[
            ["Node2D", "Empty container — parent other nodes under it."],
            ["Sprite", "Colored rectangle or image (use Upload in Inspector)."],
            ["AnimatedSprite", "Frame-by-frame sprite (basic)."],
            ["Text / Label", "Renders text with size, color, font."],
            ["Button", "Clickable UI element. Use 'On Click' behavior."],
            ["Panel", "Decorative background panel (borderRadius via Style)."],
            ["Line2D / Polygon2D", "Draw points-based shapes — set 'points' as 'x,y x,y…'."],
            ["TileMap", "Comma/newline grid of 0/1 cells × tileSize."],
            ["ParallaxLayer", "Background that scrolls slower than camera."],
            ["Light2D", "Radial gradient light."],
            ["Particles2D", "Lightweight circular particle ring."],
            ["Camera2D", "Set 'follow' to a node name to track it."],
            ["Player2D", "Default platformer character — physics + input."],
            ["RigidBody2D", "Dynamic body with gravity + collisions."],
            ["StaticBody2D", "Immovable solid (a platform, wall)."],
            ["Area2D", "Trigger zone — overlap detection."],
            ["RayCast2D", "Cast a ray in a direction."],
            ["Audio2D", "Plays a sound by URL."],
          ]} />
          <h3>3D</h3>
          <Grid items={[
            ["Node3D / Box / Sphere / Cylinder / Capsule / Plane", "Standard meshes with material color."],
            ["Sprite3D", "Camera-facing image."],
            ["Label3D", "Text rendered as a sprite."],
            ["Decal", "Flat overlay (basic)."],
            ["Model", "GLTF/GLB placeholder — set 'url'."],
            ["Light", "kind: ambient / point / directional / spot."],
            ["Particles3D", "Points cloud particle system."],
            ["Camera3D", "Set 'follow' to track a node."],
            ["Player3D", "Capsule character — walk, jump, gravity."],
            ["RigidBody3D / StaticBody3D / Area3D", "Physics bodies (real with Rapier enabled)."],
            ["RayCast3D / Audio3D", "Cast ray / play 3D sound."],
          ]} />
        </Section>

        <Section title={t("docs.sec3")}>
          <p>Add behaviors from the Inspector → Logic tab. All behaviors are deterministic and stack — for example, you can put <strong>walk + jump</strong> on a 3D player, or <strong>follow + rotate</strong> on an enemy.</p>
          <Grid items={[
            ["walk", "WASD/arrow/joystick movement, optional run multiplier."],
            ["jump", "Spacebar / button — 2D force or 3D height."],
            ["platformer", "walk + jump for 2D players."],
            ["topdown", "4/8-way move (2D or 3D)."],
            ["follow", "Smooth-track a node by name."],
            ["chase", "Move toward a target at speed."],
            ["rotate", "Constant rotation around an axis."],
            ["orbit", "Circle around the origin."],
            ["oscillate", "Sin-wave motion on x/y/z."],
            ["patrol", "Move back and forth on x."],
            ["lookAt", "Face a node by name."],
            ["billboard (3D)", "Always face the camera."],
            ["screenWrap (2D)", "Wrap around the viewport."],
            ["bounce", "Travel and reflect off bounds."],
            ["destroyAfter", "Remove the node after N seconds."],
            ["spawnInterval", "Clone a named node every N seconds."],
            ["opacityPulse / scalePulse", "Animate alpha or scale on a sine."],
            ["clickAction", "Run a custom action when the node is clicked."],
            ["keyAction", "Run a custom action when a key is pressed (e.g. 'KeyE')."],
          ]} />
        </Section>

        <Section title={t("docs.sec4")}>
          <p>Open the <strong>Script</strong> tab on any node. Two optional functions: <code>onStart()</code> and <code>onUpdate(dt)</code>.</p>
          <pre className="bg-[#0a1612] border border-primary/20 rounded-md p-4 overflow-x-auto text-sm"><code>{`function onStart() {
  log('Hello from ' + self.node.name);
}

function onUpdate(dt) {
  // move at 60 px/s in 2D
  self.x += 60 * dt;

  // jump to player position when E pressed
  if (input.wasPressed('KeyE')) {
    const p = scene.find('Player');
    if (p) { self.x = p.x; self.y = p.y; }
  }
}`}</code></pre>
          <h3>API surface</h3>
          <ul>
            <li><code>self.x / self.y / self.z / self.rotation</code> — read/write transform.</li>
            <li><code>self.props</code> — node properties (color, w, h, image…).</li>
            <li><code>self.node</code> — full node object.</li>
            <li><code>scene.find(name)</code> — get another node.</li>
            <li><code>input.isDown('Space')</code>, <code>input.wasPressed('KeyE')</code>, <code>input.axis()</code>.</li>
            <li><code>log(message)</code> — print to the console panel.</li>
          </ul>
        </Section>

        <Section title={t("docs.sec5")}>
          <p>Open Scene Settings (deselect any node). The <strong>Ground (2D)</strong> section gives you a built-in ground line — either an infinite floor or fixed width. Tweak <code>y</code>, <code>height</code>, and <code>color</code> live.</p>
          <p>Cameras follow a node by name — set <code>follow</code> to "Player" (or any node) in the Camera's Properties.</p>
        </Section>

        <Section title={t("docs.sec6")}>
          <p>Set in Scene Settings → <strong>Mobile Controls</strong>. Customize joystick size, color, knob color, opacity, position (bottom-left or bottom-right). Add as many action buttons as you want — each maps to an input key (<code>jump</code>, <code>action</code>, or a custom string read by <code>input.isDown</code> / <code>buttons.has</code>).</p>
        </Section>

        <Section title={t("docs.sec7")}>
          <p>In a 3D project, open Scene Settings and enable <strong>Rapier physics</strong>. On Play, Forge dynamically loads <code>@dimforge/rapier3d-compat</code> and creates rigid bodies for nodes flagged <code>solid</code>, plus dynamic bodies for <code>Player3D</code> and <code>RigidBody3D</code>. Disable to fall back to the simple kinematic ground-clamp.</p>
        </Section>

        <Section title={t("docs.sec8")}>
          <p>Any Sprite, Player2D, RigidBody2D, or Sprite3D supports an <code>image</code> prop — paste a URL or upload from disk in the Inspector. Uploaded images are stored as data URLs inside the project, so they survive export.</p>
        </Section>

        <Section title={t("docs.sec9")}>
          <p>The <strong>Style</strong> tab on any node controls visual properties — borderRadius, opacity, zIndex, fontWeight, color, borderColor, borderWidth, shadow. These layer on top of the node's <code>props</code>.</p>
        </Section>

        <Section title={t("docs.sec10")}>
          <p>Click <strong>Export</strong> in the topbar. Forge bundles the scene + a minimal runtime into a single file. For 3D projects, Three.js loads from a CDN to keep file size down. Drop the file on any web host or share it directly.</p>
        </Section>

        <Section title={t("docs.sec11")}>
          <p>{t("docs.enemies")}</p>
        </Section>

        <Section title={t("docs.sec12")}>
          <p>{t("docs.player")}</p>
        </Section>

        <Section title={t("docs.sec13")}>
          <p>{t("docs.health")}</p>
        </Section>

        <Section title={t("docs.sec14")}>
          <p>{t("docs.terrain")}</p>
          <Grid items={[
            ["Grass / Dirt", "Solid, walkable. Tag: ground."],
            ["Sand / Stone / Wood", "Solid surfaces with their own collision tag — useful for footstep logic."],
            ["Water", "Non-solid sensor (isSensor:true). Use Area2D onCollide to slow / damage."],
          ]} />
        </Section>

        <Section title={t("docs.sec15")}>
          <p>{t("docs.rotation")}</p>
        </Section>



        <div className="pt-6">
          <Link to="/" className="text-primary hover:underline text-sm">{t("docs.back")}</Link>
        </div>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-bold border-l-2 border-primary pl-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Grid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-2 not-prose">
      {items.map(([name, desc]) => (
        <div key={name} className="rounded-md border bg-card/50 p-3">
          <div className="font-mono text-sm text-primary">{name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
        </div>
      ))}
    </div>
  );
}
