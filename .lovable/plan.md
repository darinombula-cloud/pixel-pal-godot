
# Forge: Engine + Editor Overhaul

Big batch. I'll group everything you listed and tackle it in one coherent pass so the editor and the runtime stay in sync.

## 1. Collisions

Today only `player2d`/`rigidBody2d` collide, and only against nodes with `props.solid=true`. In 3D, `props.solid` is read but the non-Rapier path skips it entirely.

Changes:
- Add a per-node **Collision** section in the Inspector (not just a hidden `solid` prop): `collisionEnabled`, `collisionShape` (`box` / `circle` / `capsule`), `collisionSize` (override of render size), `isSensor` (overlap only, no resolve), `collisionMask` (string tag).
- Runtime2D: resolve collisions for any node with `collisionEnabled` against any other with `collisionEnabled && !isSensor`. Sensors fire an `onEnter` script hook with the other node.
- Runtime3D non-Rapier path: same AABB pass on Y/X/Z using `collisionSize`. With Rapier on, use the same fields to build the collider (currently it ignores everything except w/h/d). Sphere/capsule pick the right Rapier shape.
- Default `Player`/`RigidBody`/`StaticBody`/`Area` nodes ship with `collisionEnabled=true`; everything else defaults off.

## 2. 3D width/height/depth (and rotation) not working

Right now `box`/`rigidBody3d`/`staticBody3d` only read `w/h/d` once at geometry creation, and changing them in the inspector doesn't rebuild. Also `applyTransform` skips rotation for `plane`.

- Detect prop changes in `Runtime3D.update` for size-affecting props (`w`,`h`,`d`,`r`) and rebuild the geometry in place.
- Drop the `n.type !== "plane"` rotation skip; let user rotate planes freely (still default a ground plane to rotated-flat in `newNode`).
- Sphere uses `r`, cylinder/capsule use `r`+`h`, etc. — surface these in the inspector with proper labels per node type.

## 3. Camera follow & adjustable camera

- 2D and 3D camera: replace `props.follow` text with a node-picker (see #6).
- New camera props: `offsetX/Y/Z`, `lerp` (smoothing 0–1), `lookAhead`, `zoom` (2D) / `fov`,`distance`,`pitch`,`yaw` (3D orbit follow).
- Auto-create a `camera2d`/`camera3d` if a scene has none, so follow works without ceremony.
- 3D: implement orbit-follow (camera trails the target at `distance` with `pitch`/`yaw`, smoothed). Mouse-drag on the viewport in Play rotates yaw/pitch when the camera has `controllable=true`.

## 4. Joystick direction listener

Add named directional events the joystick emits and that scripts/behaviors can listen to:

- `input.dir` → `{ up, down, left, right }` booleans (threshold 0.4).
- `input.dirPressed('left')` → true on the frame that direction crossed the threshold.
- New behavior **`onJoystick`** with params `direction` (up/down/left/right/any) + `script` — runs the script while the joystick is held in that direction. Plus a sibling **`moveOnJoystick`** preset: pick a target node + axis + speed and have it move whenever the joystick points that way (no scripting needed).
- The on-screen joystick visually highlights the active quadrant so users see the direction being detected.

## 5. Script panel actually runs

The Script tab compiles on Play but never recompiles when you edit the script while playing, and `new Function(...).return` only exposes `onStart`/`onUpdate` — `onEnter`, `onClick`, `onKey`, helpers, etc. silently disappear. Also there's no feedback when the script throws at parse time.

- Surface compile errors inline under the editor (red banner with line number).
- Expanded API exported: `onStart`, `onUpdate(dt)`, `onCollide(other)`, `onClick`, `onKey(code)`, `onDestroy`.
- A **Run** button on the panel that compiles + runs in the editor canvas without leaving the page.
- Add a Snippets dropdown (move on key, shoot, follow mouse, despawn off-screen, increment score).
- Hot-reload: while playing, edits to a script recompile that node only.

## 6. Target picker (not text input)

Add a reusable `<NodePicker value onChange filter>` shadcn `Select`. Use it everywhere a behavior currently asks for a name:
- `follow.target`, `chase.target`, `lookAt.target`, `spawnInterval.template`, camera `follow`, new `moveOnJoystick.target`.
- Picker lists every node in the scene by name + type icon. Refreshes live.

## 7. Default 2D sprites + URL/upload

- Bundle ~12 royalty-free pixel sprites under `src/assets/sprites/` (player idle, player run, slime, bat, coin, heart, key, chest, bullet, platform-tile, spike, flag) — imported via `import.meta.glob` so they ship with the editor.
- Inspector `image` field becomes three options in a tabbed control: **Library** (grid of bundled sprites), **URL** (paste any URL), **Upload** (existing FileReader path). Same picker is reused by `sprite`, `animatedSprite`, `sprite3d`, `player2d`.
- `animatedSprite` gets `frames` (multiple library/URL entries) + `fps` and actually animates in `Runtime2D.drawNode`.

## 8. Enemies

A first-class concept rather than just "a sprite with chase behavior".

- New node types: `enemy2d`, `enemy3d`. Defaults: collision on, `hp`, `damage`, `speed`, optional `target` (auto-targets the first `player*` if empty), behavior presets attached (`chase` + `lookAt`).
- New behavior **`damageOnContact`**: hurts the colliding `player*` by `damage` and triggers `onHit`.
- New behavior **`patrolPath`**: waypoint list, loop/ping-pong.
- New behavior **`shootAt`**: spawns a `bullet` template toward a target every `interval`.

## 9. More nodes

- 2D: `healthBar`, `coin`, `bullet`, `trigger` (Area2D preset), `dialogue` (text bubble), `timer`.
- 3D: `terrain` (heightmap-lite plane), `bullet3d`, `pickup`, `trigger3d`.

## 10. More default behaviors

`gravityZone`, `pushAway`, `pickup` (despawn on overlap with `player*` and emit `onCollect`), `damageOnContact`, `respawn`, `moveOnJoystick`, `onJoystick`, `onCollide`, `cameraShake`, `aimAtMouse`, `inputMove` (config which keys move on which axis), `state` (FSM helper for enemy ai).

## 11. UI overhaul (shadcn + lucide, no emojis)

- Replace every emoji in `NodePalette`, `Inspector`, `EditorShell`, `Topbar` with lucide icons mapped per node type (e.g. `User` for player, `Bug` for enemy, `Image` for sprite, `Camera` for camera, `Lightbulb` for light, `Sparkles` for particles, `Square`/`Circle`/`Triangle` for shapes, `Box`/`Globe2`/`Cylinder` for 3D primitives).
- Convert the raw `<select>`, `<input type=checkbox>`, and `<button>` controls in Inspector / Scene settings / Add Behavior to shadcn `Select`, `Switch`, `Button`, `Slider` (for opacity/smoothing), `Tabs` already in place.
- Console panel: use `Card` + `ScrollArea` + a filter `Input`.
- Behavior add: shadcn `Command` palette (`Cmd+B`) with search, grouped by category, icons per behavior.
- Topbar: lucide icons on Play/Stop/Export, keep `bg-grad-primary` for the play button.
- Node palette: collapsible `Accordion` groups; each tile shows the lucide icon + name; drag handle visible on hover.

## Out of scope (so I don't sprawl further)

- Multiplayer / cloud sync (separate plan).
- Visual node-graph scripting.
- New 3D model importer (.glb loading) beyond what's already stubbed.

## File map

```text
Modified:
  src/engine/types.ts          ← new node types, Collision, Camera, joystick events
  src/engine/input.ts          ← dir + dirPressed, threshold tracking
  src/engine/behaviors.ts      ← new behaviors, target-as-picker still by name id
  src/engine/runtime2d.ts      ← generalized collisions, sensors, animatedSprite,
                                 sprite library lookup, camera offset/lerp/shake
  src/engine/runtime3d.ts      ← geometry hot-rebuild, collisions for non-Rapier,
                                 orbit-follow camera, plane rotation fix
  src/engine/store.ts          ← defaults for new node types, sprite library import
  src/editor/NodePalette.tsx   ← lucide icons, accordion, new types
  src/editor/Inspector.tsx     ← shadcn controls, Collision section, NodePicker,
                                 sprite picker (library/URL/upload), shadcn switches
  src/editor/CodeEditor.tsx    ← error banner, Run button, snippet menu
  src/editor/MobileControls.tsx← directional quadrant highlight
  src/editor/EditorShell.tsx   ← shadcn console card, Cmd+B behavior palette
  src/editor/Topbar.tsx        ← lucide icons
Added:
  src/assets/sprites/*         ← bundled default 2D sprites
  src/editor/NodePicker.tsx    ← reusable shadcn Select of scene nodes
  src/editor/SpritePicker.tsx  ← library / URL / upload tabs
  src/editor/CollisionPanel.tsx
```

## One question before I build

This is a big change set (~12 modified files + new assets). Two ways to ship it:

1. **One pass** — I do the whole list in a single batch. You get everything at once but the diff is large and any one regression is harder to bisect.
2. **Two passes** — pass 1 = engine fixes (collisions, 3D dims, camera, joystick events, script panel, node picker); pass 2 = UI overhaul + sprites + enemies + new nodes. Each pass is independently verifiable.

I'd recommend **2**. Which do you want?
