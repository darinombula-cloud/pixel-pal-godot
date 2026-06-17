import grass from "@/assets/tile-grass.jpg";
import water from "@/assets/tile-water.jpg";
import sand from "@/assets/tile-sand.jpg";
import dirt from "@/assets/tile-dirt.jpg";
import stone from "@/assets/tile-stone.jpg";
import wood from "@/assets/tile-wood.jpg";

export interface TerrainPreset {
  key: "grass" | "water" | "sand" | "dirt" | "stone" | "wood";
  labelKey: string;
  icon: string;
  image: string;
  solid: boolean;
  /** Optional collision tag for triggers (e.g. "water" damages or slows). */
  tag?: string;
}

export const TERRAIN_PRESETS: TerrainPreset[] = [
  { key: "grass", labelKey: "terrain.grass", icon: "🌿", image: grass, solid: true,  tag: "ground" },
  { key: "dirt",  labelKey: "terrain.dirt",  icon: "🟫", image: dirt,  solid: true,  tag: "ground" },
  { key: "sand",  labelKey: "terrain.sand",  icon: "🏖", image: sand,  solid: true,  tag: "sand" },
  { key: "stone", labelKey: "terrain.stone", icon: "🪨", image: stone, solid: true,  tag: "stone" },
  { key: "wood",  labelKey: "terrain.wood",  icon: "🪵", image: wood,  solid: true,  tag: "wood" },
  { key: "water", labelKey: "terrain.water", icon: "💧", image: water, solid: false, tag: "water" },
];

export function terrainTilePreset(p: TerrainPreset) {
  return {
    name: p.labelKey.split(".")[1].replace(/^./, (c) => c.toUpperCase()),
    type: "staticBody2d" as const,
    props: {
      w: 128, h: 128, color: "#1c3a2a", image: p.image,
      solid: p.solid, collisionEnabled: true,
      isSensor: !p.solid, collisionTag: p.tag || p.key,
    },
  };
}
