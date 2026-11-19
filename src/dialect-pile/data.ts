import catalog from "../../record-catalog.json";

export type TagItem = {
  label: string;
  fill: string;
  ink: string;
  link: string;
  imageUrl: string;
};

const colors = ["#ff5b37", "#17150f", "#ffc83d", "#3b5bff", "#f6a9cb", "#16a06b"];
export const TAGS = catalog.dialects.filter(d => d.id !== "sha").map((d, i) => ({
  key: d.id, label: d.name, fill: colors[i % colors.length],
  ink: [2,4].includes(i % colors.length) ? "#17150f" : "#fff", link: "", imageUrl: "/public/assets/dialect-labels/" + d.id + ".png"
}));

export const INK = "rgb(23, 21, 15)";

export const SURFACE = "#ffffff";

export const RADIUS = 32;

export const CAPTION_TOP = 52;

export const SUBTITLE = "拖动、抛起，点击属于你的乡音";

export const CAPTION_EASE = "cubic-bezier(.2,.75,.15,1)";

export const LOOK = {
  padX: 24,
  padY: 15,
  fontSize: 23,
  fontWeight: 400,
  letterSpacing: "-0.015em",
  lineHeight: "1em",
  gloss: false,
  shadow: false,
  edgeWidth: 0,
};

export const BODY_FONT = {
  fontSize: 15,
  fontWeight: 400,
  letterSpacing: "-0.005em",
  lineHeight: "1.4em",
};

export const PHYSICS = {
  gravity: 2600,
  bounce: 0.2,
  friction: 0.55,
  throwPower: 1,
  squish: 0.6,
  cursorPush: true,
  pushSize: 46,
  tapBump: true,
};

export const INTERACT = {
  clickAction: "Pop" as const,
  hoverLift: true,
  focusDim: 0.7,

  newTab: true,
};

export type DropOrder = "Random" | "Burst" | "In Order";

export const DROP = {
  order: "Random" as DropOrder,
  interval: 0.1,
  zone: 80,
  replay: false,
};

export const SIM = {

  step: 1 / 60,

  substeps: 4,

  iterations: 6,

  slop: 0.4,

  maxSpeed: 4200,

  maxSpin: 28,

  pointerStiffness: 22,

  pointerForce: 6e4,

  eps: 1e-9,

  fade: 0.3,

  ringDuration: 0.7,

  ringSize: 140,
};

export function chipShadow(lift: number, shadow = LOOK.shadow, gloss = LOOK.gloss): string {
  const inset = gloss
    ? "inset 0 1px 0 rgba(255,255,255,0.32), inset 0 -1px 0 rgba(0,0,0,0.06)"
    : "";
  if (!shadow) return inset || "none";
  const drop = `0 ${(2 + 12 * lift).toFixed(1)}px ${(6 + 26 * lift).toFixed(1)}px rgba(0,0,0,${(0.12 + 0.16 * lift).toFixed(3)}), 0 1px 2px rgba(0,0,0,0.10)`;
  return inset ? `${inset}, ${drop}` : drop;
}

export function floorShade(ink: string): string {
  return `linear-gradient(to top, color-mix(in srgb, ${ink} 9%, transparent) 0%, transparent 38%), radial-gradient(120% 90% at 50% 0%, transparent 60%, color-mix(in srgb, ${ink} 6%, transparent) 100%)`;
}
