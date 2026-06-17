export type Dir = "up" | "down" | "left" | "right";

export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  axisVec = { x: 0, y: 0 };
  buttons = new Set<string>();
  mouse = { x: 0, y: 0, down: false };
  private el?: HTMLElement;
  private prevDir = new Set<Dir>();
  private currDir = new Set<Dir>();
  private dirPressedSet = new Set<Dir>();

  attach(el: HTMLElement) {
    this.el = el;
    el.tabIndex = 0;
    try { el.focus(); } catch { /* ignore */ }
    window.addEventListener("keydown", this.onKD);
    window.addEventListener("keyup", this.onKU);
  }
  detach() {
    window.removeEventListener("keydown", this.onKD);
    window.removeEventListener("keyup", this.onKU);
  }
  private onKD = (e: KeyboardEvent) => {
    if (!this.keys.has(e.code)) this.pressed.add(e.code);
    this.keys.add(e.code);
  };
  private onKU = (e: KeyboardEvent) => { this.keys.delete(e.code); };

  /** Call once per tick AFTER reading inputs (clears single-frame state). */
  endFrame() {
    this.pressed.clear();
    // recompute current dir from latest axis snapshot
    this.recomputeDir();
    // edge-detect: dirs that are true now but weren't last frame
    this.dirPressedSet.clear();
    for (const d of this.currDir) if (!this.prevDir.has(d)) this.dirPressedSet.add(d);
    this.prevDir = new Set(this.currDir);
  }

  private recomputeDir() {
    const a = this.axis();
    const t = 0.4;
    this.currDir.clear();
    if (a.x > t) this.currDir.add("right");
    if (a.x < -t) this.currDir.add("left");
    if (a.y > t) this.currDir.add("down");
    if (a.y < -t) this.currDir.add("up");
  }

  isDown(code: string) { return this.keys.has(code) || this.buttons.has(code); }
  wasPressed(code: string) { return this.pressed.has(code); }

  axis() {
    let x = 0, y = 0;
    if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) x -= 1;
    if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) x += 1;
    if (this.keys.has("ArrowUp") || this.keys.has("KeyW")) y -= 1;
    if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) y += 1;
    if (Math.abs(this.axisVec.x) + Math.abs(this.axisVec.y) > 0.05) { x = this.axisVec.x; y = this.axisVec.y; }
    const m = Math.hypot(x, y);
    return m > 1 ? { x: x / m, y: y / m } : { x, y };
  }

  /** Current directional booleans (joystick OR WASD/arrows). */
  dir(): Record<Dir, boolean> {
    // ensure up-to-date if called mid-frame
    this.recomputeDir();
    return {
      up: this.currDir.has("up"), down: this.currDir.has("down"),
      left: this.currDir.has("left"), right: this.currDir.has("right"),
    };
  }
  /** True for the single frame a direction crossed the threshold. */
  dirPressed(d: Dir) { return this.dirPressedSet.has(d); }

  isRun() { return this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || this.buttons.has("run"); }
  isJump() { return this.keys.has("Space") || this.buttons.has("jump"); }
  isAction() { return this.keys.has("KeyE") || this.buttons.has("action"); }
  isAttack() { return this.keys.has("KeyJ") || this.keys.has("KeyF") || this.buttons.has("attack"); }
}
