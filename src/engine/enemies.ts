import type { GameNode, Mode, Behavior } from "./types";
import { defaultTransform } from "./types";
import { nanoid } from "nanoid";

export type EnemyKind = "zombie" | "shooter" | "patrol" | "boss";

export interface EnemyPreset {
  kind: EnemyKind;
  labelKey: string; // i18n key
  descKey: string;
  icon: string; // emoji
}

export const ENEMY_PRESETS: EnemyPreset[] = [
  { kind: "zombie",  labelKey: "enemy.zombie",  descKey: "enemy.zombie.desc",  icon: "🧟" },
  { kind: "shooter", labelKey: "enemy.shooter", descKey: "enemy.shooter.desc", icon: "🔫" },
  { kind: "patrol",  labelKey: "enemy.patrol",  descKey: "enemy.patrol.desc",  icon: "👮" },
  { kind: "boss",    labelKey: "enemy.boss",    descKey: "enemy.boss.desc",    icon: "👹" },
];

function mk(name: string, type: GameNode["type"], pos: { x: number; y: number; z: number }, props: Record<string, any>, behaviors: Behavior[]): GameNode {
  // Enemies are sensors: they overlap the player to deal damage but never
  // push/climb on top of physics bodies (no more stacking on the player).
  return {
    id: nanoid(8),
    name,
    type,
    transform: { ...defaultTransform(), x: pos.x, y: pos.y, z: pos.z },
    props: { ...props, isEnemy: true, collisionEnabled: true, isSensor: true, solid: false, collisionTag: "enemy" },
    behaviors,
    children: [],
    visible: true,
  };
}

export function makeEnemy(kind: EnemyKind, mode: Mode, at: { x: number; y: number; z?: number }): GameNode {
  const x = at.x, y = at.y, z = at.z ?? 0;
  // Enemy HP equals number of player attacks needed to kill it.
  // Player attack does 1 damage, so 3 hits for normal monsters, 20 for boss.
  if (mode === "2d") {
    const baseProps = { w: 44, h: 56, hp: 3, maxHp: 3 };
    switch (kind) {
      case "zombie":
        return mk("Zombie", "rigidBody2d", { x, y, z: 0 }, { ...baseProps, color: "#6ea870", solid: true, gravity: true }, [
          { kind: "chase", params: { target: "Player", speed: 90 } },
          { kind: "damageOnContact", params: { damage: 10, targetTag: "player", interval: 0.6 } },
        ]);
      case "shooter":
        return mk("Shooter", "rigidBody2d", { x, y, z: 0 }, { ...baseProps, color: "#d97c4a", solid: true }, [
          { kind: "lookAt", params: { target: "Player" } },
          { kind: "spawnInterval", params: { interval: 1.2, template: "Bullet", x: 0, y: 0 } },
          { kind: "damageOnContact", params: { damage: 8, targetTag: "player", interval: 0.6 } },
        ]);
      case "patrol":
        return mk("Patroller", "rigidBody2d", { x, y, z: 0 }, { ...baseProps, color: "#c8b94a", solid: true, gravity: true }, [
          { kind: "patrol", params: { distance: 140, speed: 90 } },
          { kind: "damageOnContact", params: { damage: 5, targetTag: "player", interval: 0.6 } },
        ]);
      case "boss":
        return mk("Boss", "rigidBody2d", { x, y, z: 0 }, { w: 96, h: 110, color: "#a23a3a", hp: 20, maxHp: 20, solid: true, gravity: true }, [
          { kind: "chase", params: { target: "Player", speed: 50 } },
          { kind: "spawnInterval", params: { interval: 2.5, template: "Zombie" } },
          { kind: "damageOnContact", params: { damage: 15, targetTag: "player", interval: 0.6 } },
        ]);
    }
  } else {
    const baseProps3 = { w: 0.8, h: 1.6, d: 0.8, hp: 3, maxHp: 3 };
    switch (kind) {
      case "zombie":
        return mk("Zombie", "rigidBody3d", { x, y: y || 0.5, z }, { ...baseProps3, color: "#6ea870", solid: true }, [
          { kind: "chase", params: { target: "Player", speed: 2.2 } },
          { kind: "lookAt", params: { target: "Player" } },
          { kind: "damageOnContact", params: { damage: 10, targetTag: "player", interval: 0.6 } },
        ]);
      case "shooter":
        return mk("Shooter", "rigidBody3d", { x, y: y || 0.5, z }, { ...baseProps3, color: "#d97c4a", solid: true }, [
          { kind: "lookAt", params: { target: "Player" } },
          { kind: "spawnInterval", params: { interval: 1.5, template: "Bullet" } },
          { kind: "damageOnContact", params: { damage: 8, targetTag: "player", interval: 0.6 } },
        ]);
      case "patrol":
        return mk("Patroller", "rigidBody3d", { x, y: y || 0.5, z }, { ...baseProps3, color: "#c8b94a", solid: true }, [
          { kind: "patrol", params: { distance: 4, speed: 1.6 } },
          { kind: "damageOnContact", params: { damage: 5, targetTag: "player", interval: 0.6 } },
        ]);
      case "boss":
        return mk("Boss", "rigidBody3d", { x, y: y || 1.2, z }, { w: 2, h: 2.6, d: 2, color: "#a23a3a", hp: 20, maxHp: 20, solid: true }, [
          { kind: "chase", params: { target: "Player", speed: 1.4 } },
          { kind: "spawnInterval", params: { interval: 3, template: "Zombie" } },
          { kind: "damageOnContact", params: { damage: 15, targetTag: "player", interval: 0.6 } },
        ]);
    }
  }
}

/** Custom enemy built from user-imported animation images. */
export function makeCustomEnemy(
  mode: Mode,
  at: { x: number; y: number; z?: number },
  anims: Record<string, string>,
): GameNode {
  const x = at.x, y = at.y, z = at.z ?? 0;
  const idle = anims.idle || anims.walk || anims.run || Object.values(anims).find(Boolean) || "";
  if (mode === "2d") {
    return mk("Monster", "rigidBody2d", { x, y, z: 0 }, {
      w: 56, h: 64, hp: 3, maxHp: 3, solid: true, gravity: true,
      color: "#7bf1a8", image: idle, animations: anims,
    }, [
      { kind: "chase", params: { target: "Player", speed: 90 } },
      { kind: "damageOnContact", params: { damage: 10, targetTag: "player", interval: 0.6 } },
    ]);
  }
  return mk("Monster", "rigidBody3d", { x, y: y || 0.5, z }, {
    w: 0.8, h: 1.6, d: 0.8, hp: 3, maxHp: 3, solid: true,
    color: "#7bf1a8", image: idle, animations: anims,
  }, [
    { kind: "chase", params: { target: "Player", speed: 2 } },
    { kind: "lookAt", params: { target: "Player" } },
    { kind: "damageOnContact", params: { damage: 10, targetTag: "player", interval: 0.6 } },
  ]);
}
