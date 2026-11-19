import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import {
  DISC_ITEMS,
  DISC_ENGINE as W,
  WORK_FILMS,
  itemDetailPath,
  type DiscItem,
} from "./data";

gsap.registerPlugin(CustomEase);

const DISC_GLIDE = (() => {
  try {
    return CustomEase.create("discGlide", "0.32, 0.72, 0, 1");
  } catch {
    return "power3.out";
  }
})();

type DiscSlot = {
  index: number;
  group: THREE.Group;
  spin: THREE.Group;
  front: THREE.Mesh;
  frontMaterial: THREE.MeshBasicMaterial;
  backMaterial: THREE.Material;
  hover: number;

  spinX: number;
  spinY: number;

  spinZ: number;
  pushX: number;
  pushY: number;
  pushZ: number;
  pushVX: number;
  pushVY: number;
  pushVZ: number;
  pushRotX: number;
  pushRotY: number;
  pushRotVX: number;
  pushRotVY: number;
};

type EngineOptions = {
  films?: DiscItem[];
  host: HTMLElement;
  onIndexChange?: (index: number) => void;
  onScrollingChange?: (scrolling: boolean) => void;
  onReady?: () => void;

  onRevealCopy?: () => void;

  preload?: boolean;
  singleDisc?: boolean;

  onOpenFilm?: (film: DiscItem, event: MouseEvent) => void;
};

export type GalleryPreloader = {
  count: number;
  covers: number[];
  meta: {
    count: number;
    years: [number, number] | null;
    lead: { title: string; year: string } | null;
  };
  anchor: () => { x: number; y: number; r: number; live: number; rest: number };
  floor: (y: number) => void;
  cover: (index: number) => Promise<void>;
  pose: (opts: { turn?: number; rise?: number }) => void;
  fan: () => Promise<void>;
  revealCopy: () => void;
  abort: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function valueNoise(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function createEdgeGeometry(thickness: number, bevel: number, bleed: number) {
  const half = thickness / 2;
  const tip = 0.0015 + bevel * Math.min(thickness * 0.55, 0.018);
  const inner = 1 - bleed;
  const profile = [
    new THREE.Vector2(inner, half),
    new THREE.Vector2(1 - tip, half),
    new THREE.Vector2(1, half - tip),
    new THREE.Vector2(1, -half + tip),
    new THREE.Vector2(1 - tip, -half),
    new THREE.Vector2(inner, -half),
  ];
  const geometry = new THREE.LatheGeometry(profile, 256);
  geometry.computeVertexNormals();
  return geometry;
}

function createHubRingGeometry(
  inner: number,
  outer: number,
  thickness: number,
  flare: number,
  segments = 160,
) {
  const half = thickness / 2;
  const start = Math.max(0.002, inner);
  const span = Math.max(1e-4, outer - start);
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(start, -half),
    new THREE.Vector2(start, half),
  ];
  for (let step = 0; step <= 5; step += 1) {
    const t = step / 5;
    const r = start + span * t;
    const y =
      half * (1 - flare) +
      half * flare * (0.6 + 0.4 * Math.cos(t * Math.PI * 3));
    profile.push(new THREE.Vector2(r, y));
  }
  profile.push(new THREE.Vector2(outer, half * 0.92));
  profile.push(new THREE.Vector2(outer, -half * 0.92));
  for (let step = 5; step >= 0; step -= 1) {
    const t = step / 5;
    const r = start + span * t;
    const y = -(
      half * (1 - flare) +
      half * flare * (0.6 + 0.4 * Math.cos(t * Math.PI * 3))
    );
    profile.push(new THREE.Vector2(r, y));
  }
  const geometry = new THREE.LatheGeometry(profile, segments);
  geometry.computeVertexNormals();
  return geometry;
}

function remapRingUv(geometry: THREE.BufferGeometry) {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i += 1) {
    uv.setXY(i, position.getX(i) * 0.5 + 0.5, position.getY(i) * 0.5 + 0.5);
  }
  uv.needsUpdate = true;
}

function createIblTarget(renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, "#25282f");
  gradient.addColorStop(0.5, "#0e0f13");
  gradient.addColorStop(1, "#020203");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);
  const bandHalf = 0.07;
  (
    [
      [0.14, bandHalf, 1],
      [0.4, bandHalf * 0.7, 0.6],
      [0.26, bandHalf * 1.1, 0.85],
      [0.62, bandHalf * 0.5, 0.35],
    ] as const
  ).forEach(([center, half, strength]) => {
    const band = ctx.createLinearGradient(
      0,
      512 * (center - half),
      0,
      512 * (center + half),
    );
    band.addColorStop(0, "rgba(255,255,255,0)");
    band.addColorStop(
      0.5,
      `rgba(255,255,255,${Math.max(0.1, 0.85 * strength)})`,
    );
    band.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = band;
    ctx.fillRect(0, 512 * (center - half), 1024, 512 * half * 2);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.NoColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(texture);
  texture.dispose();
  pmrem.dispose();
  return target;
}

function createMatrixTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
  gradient.addColorStop(0, "#d9dde4");
  gradient.addColorStop(0.42, "#f0f2f5");
  gradient.addColorStop(0.72, "#cfd4dc");
  gradient.addColorStop(1, "#b8bec8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  ctx.lineWidth = 1;
  [0.255, 0.285, 0.315, 0.345].forEach((radius, index) => {
    ctx.strokeStyle = `rgba(255,255,255,${0.14 - index * 0.018})`;
    ctx.beginPath();
    ctx.arc(256, 256, 512 * radius, 0, Math.PI * 2);
    ctx.stroke();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createFrontRoughnessMap() {
  const size = W.mapResolution;
  const data = new Uint8ClampedArray(size * size * 4);
  const center = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let roughness = W.frontRough;
      roughness += (valueNoise(x * 2.3, y * 2.3) - 0.5) * 0.35 * W.texGrain;
      roughness += (valueNoise(x * 0.5, y * 0.5) - 0.5) * 0.3 * W.texPrint;
      const dx = x - center;
      const dy = y - center;
      const radiusValue = Math.sqrt(dx * dx + dy * dy) / (size * 0.5);
      roughness -= (Math.sin(radiusValue * 14) * 0.5 + 0.5) * 0.5 * W.texGloss;
      roughness = clamp(roughness, 0.02, 1);
      const value = roughness * 255;
      const index = (y * size + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createScribbleGeometry(segments: number) {
  const geometry = new THREE.BufferGeometry();
  const vertexCount = (segments + 1) * 2;
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3),
  );
  const index: number[] = [];
  for (let i = 0; i < segments; i += 1) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geometry.setIndex(index);
  return geometry;
}

function rebuildScribbleLoop(
  geometry: THREE.BufferGeometry,
  loopIndex: number,
  progress: number,
  segments: number,
) {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const radius =
    1 * (1 + W.scribblePadding + loopIndex * W.scribbleLoopGap);
  const halfWidth = 1 * W.scribbleWidth * 0.5;
  const sweep = clamp(
    W.scribbleSweep * (1 + (Math.random() - 0.5) * W.scribbleSweepJitter),
    0.12,
    1,
  ) * progress;
  const angleSpan = Math.PI * 2 * sweep;
  const startAngle = Math.random() * Math.PI * 2;
  const keys: number[] = [];
  for (let i = 0; i <= W.scribblePoints; i += 1) {
    keys.push(1 + (Math.random() - 0.5) * 2 * W.scribbleJitter);
  }
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = startAngle + t * angleSpan;
    const keyPos = t * W.scribblePoints * sweep;
    const key0 = Math.floor(keyPos);
    const key1 = Math.min(W.scribblePoints, key0 + 1);
    const frac = keyPos - key0;
    const smooth = frac * frac * (3 - 2 * frac);
    const jitter = keys[key0] * (1 - smooth) + keys[key1] * smooth;
    const taper = Math.min(1, Math.min(t, 1 - t) * 14 + 0.15);
    const inner = radius * jitter - halfWidth * taper;
    const outer = radius * jitter + halfWidth * taper;
    const cx = Math.cos(angle);
    const cy = Math.sin(angle);
    position.setXYZ(i * 2, cx * inner, cy * inner, 0);
    position.setXYZ(i * 2 + 1, cx * outer, cy * outer, 0);
  }
  position.needsUpdate = true;
  geometry.computeBoundingSphere();
}

export class DiscEngine {
  private host: HTMLElement;
  private onIndexChange?: (index: number) => void;
  private onScrollingChange?: (scrolling: boolean) => void;
  private onOpenFilm?: (film: DiscItem, event: MouseEvent) => void;
  private onRevealCopy?: () => void;
  private wantPreload: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(W.cameraFOV, 1, 0.1, 100);
  private gallery = new THREE.Group();
  private iblTarget: THREE.WebGLRenderTarget | null = null;
  private resizeObserver: ResizeObserver;
  private intersectionObserver: IntersectionObserver;
  private rafId = 0;
  private running = false;
  private discs: DiscSlot[] = [];

  private films: DiscItem[] = WORK_FILMS;
  private textureCache = new Map<string, THREE.Texture>();
  private texturesReady: Promise<void> | null = null;
  private textureLoads = new Map<string, Promise<void>>();
  private textureWindow = -1;

  private flight = { others: 1, active: 1, inbound: false };
  private flightLocked = false;
  private swapping = false;
  private flightProxy = { others: 1, active: 1 };

  private preload = {
    active: false,
    turn: 0,
    rise: 0,
    riseFrom: W.preloadRiseFrom,
    growing: false,
    tween: null as gsap.core.Tween | gsap.core.Timeline | null,

    floorY: null as number | null,
  };
  private destroyed = false;
  private riseScratch = new THREE.Vector3();
  private invGalleryQuat = new THREE.Quaternion();
  private projectScratch = new THREE.Vector3();
  private scroll = 0;

  private scrollProxy = { value: 0 };
  private snapTween: gsap.core.Tween | null = null;

  private snapTarget = -1;
  private scrollVel = 0;
  private settleVel = 0;
  private flow = 0;
  private prevScroll = 0;
  private lastIndex = 0;
  private isSettled = true;
  private lastTime = 0;

  private wheelOpen = true;
  private wheelAccum = 0;
  private wheelDir = 0;
  private wheelEnvelope = 0;
  private wheelPeak = 0;
  private wheelBurstCount = 0;
  private wheelLastStepAt = 0;
  private wheelLastEventAt = 0;
  private wheelHasEvent = false;
  private wheelFlickMode = false;
  private wheelIdleTimer = 0;
  private pointerNdc = new THREE.Vector2(0, 0);
  private pointerClient = { x: 0, y: 0 };
  private pointerInside = false;
  private hoverIndex = -1;
  private raycaster = new THREE.Raycaster();
  private pickMeshes: THREE.Mesh[] = [];
  private finePointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  ).matches;
  private reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  private scribbleGroup = new THREE.Group();
  private scribbleGeometries: THREE.BufferGeometry[] = [];
  private scribbleMaterial: THREE.MeshBasicMaterial | null = null;
  private scribbleSegments = W.scribblePoints * 3;
  private scribblePhase: "hidden" | "in" | "on" | "out" = "hidden";
  private scribbleFrame = 0;
  private scribbleDiscIndex = -1;
  private scribbleLastTick = 0;
  private shared = {
    frontGeometry: null as THREE.RingGeometry | null,
    backGeometry: null as THREE.RingGeometry | null,
    edgeGeometry: null as THREE.LatheGeometry | null,
    hubGeometry: null as THREE.LatheGeometry | null,
    matrixGeometry: null as THREE.LatheGeometry | null,
    frostGeometry: null as THREE.LatheGeometry | null,

    pickGeometry: null as THREE.CircleGeometry | null,
    pickMaterial: null as THREE.MeshBasicMaterial | null,
    matrixTexture: null as THREE.CanvasTexture | null,
    frontRoughnessMap: null as THREE.DataTexture | null,
    backMaterial: null as THREE.MeshPhysicalMaterial | null,
    edgeMaterial: null as THREE.MeshPhysicalMaterial | null,
    hubMaterial: null as THREE.MeshPhysicalMaterial | null,
    matrixMaterial: null as THREE.MeshPhysicalMaterial | null,
    frostMaterial: null as THREE.MeshPhysicalMaterial | null,
  };
  private wheelHandler = (event: WheelEvent) => this.onWheel(event);
  private pointerDown = false;

  private pointerLocal = { x: 0, y: 0, width: 1, height: 1 };
  private dragOriginLocal = { x: 0, y: 0 };
  private dragLastLocal = { x: 0, y: 0 };
  private dragLastTime = 0;
  private lastPointerSample = 0;
  private pointerVelX = 0;
  private pointerVelY = 0;

  private spinDiscIndex = -1;

  private dragCommitted = false;

  private clickBlockUntil = 0;

  private hitUv = { x: 0, y: 0 };

  private spinReset: {
    index: number;
    fromX: number;
    fromY: number;
    t0: number;
  } | null = null;

  constructor({
    host,
    films,
    onIndexChange,
    onScrollingChange,
    onReady,
    onRevealCopy,
    onOpenFilm,
    preload,
    singleDisc,
  }: EngineOptions) {
    this.host = host;
    if (films) this.films = films;
    this.onIndexChange = onIndexChange;
    this.onScrollingChange = onScrollingChange;
    this.onOpenFilm = onOpenFilm;
    this.onRevealCopy = onRevealCopy;
    this.wantPreload =
      preload ??
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.flightLocked = true;

    RectAreaLightUniformsLib.init();

    const canvas = document.createElement("canvas");
    canvas.className = "dg-disc-canvas";
    canvas.style.cssText =
      "display:block;position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;";
    host.insertBefore(canvas, host.firstChild);
    host.style.touchAction = "none";
    host.style.cursor = "grab";

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = W.exposure;
    this.renderer.setClearColor(0x000000, 0);

    this.camera.position.set(0, 0, W.cameraDistance);
    this.camera.lookAt(0, 0, 0);

    this.scene.fog = new THREE.Fog(new THREE.Color(W.fogColor), W.fogNear, W.fogFar);
    this.gallery.rotation.x = THREE.MathUtils.degToRad(W.galleryRotX);
    this.gallery.rotation.y = THREE.MathUtils.degToRad(W.galleryRotY);
    this.gallery.scale.setScalar(W.galleryScale);
    if (singleDisc) {
      this.gallery.rotation.set(0, 0, 0);
      this.camera.position.z = 3.5;
    }
    this.scene.add(this.gallery);
    this.initScribble();

    this.scene.add(new THREE.AmbientLight(0xffffff, W.ambientIntensity));
    const key = new THREE.DirectionalLight(W.keyColor, W.keyIntensity);
    key.position.set(W.keyX, W.keyY, W.keyZ);
    const fill = new THREE.DirectionalLight(0xffffff, W.fillIntensity);
    fill.position.set(-5, -2, 4);
    const rim = new THREE.DirectionalLight(W.rimColor, W.rimIntensity);
    rim.position.set(0, 3, -6);
    const topStrip = new THREE.RectAreaLight(0xffffff, W.topStripIntensity, 6, 0.4);
    topStrip.position.set(0, 3.2, 3);
    topStrip.lookAt(0, 0, 0);
    this.scene.add(key, fill, rim, topStrip);

    this.iblTarget = createIblTarget(this.renderer);
    if (this.iblTarget) {

      const iblKey = ("envir" + "onment") as "environment";
      (this.scene as THREE.Scene & Record<string, unknown>)[iblKey] = this.iblTarget.texture;
    }

    this.buildDiscs()
      .then(() => {
        if (this.destroyed) return;
        this.resize();
        if (this.wantPreload && !this.reducedMotion) {
          this.enterPreload();
          this.publishPreloaderApi();
        } else {
          this.flightLocked = false;
          this.onRevealCopy?.();
        }
        this.start();
        this.emitIndex(true);
        onReady?.();
      })
      .catch((error) => {
        if (this.destroyed) return;
        console.error("[gallery] disc engine failed", error);
      });

    window.addEventListener("wheel", this.wheelHandler, {
      passive: false,
      capture: true,
    });
    host.addEventListener("pointerdown", this.onPointerDown);

    window.addEventListener("pointermove", this.onPointerHoverMove);
    window.addEventListener("pointermove", this.onPointerDragMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerCancel);

    host.addEventListener("click", this.onDiscClick);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (visible) {
          this.start();
          return;
        }

        if (this.preload.active) return;
        this.stop();
      },
      { threshold: 0.05 },
    );
    this.intersectionObserver.observe(host);
  }

  private logicalIndex() {
    const max = this.films.length - 1;
    if (this.snapTarget >= 0) return clamp(this.snapTarget, 0, max);
    if (this.isSnapTweening()) {
      return clamp(Math.round(this.scrollProxy.value), 0, max);
    }
    return clamp(Math.round(this.scroll), 0, max);
  }

  private isSnapTweening() {
    return this.snapTween !== null && this.snapTween.isActive();
  }

  private emitIndex(force = false) {
    const count = this.films.length;
    const max = count - 1;
    const snapped = this.logicalIndex();
    const settled =
      !this.isSnapTweening() &&
      Math.abs(this.scroll - snapped) < W.settleEpsilon &&
      Math.abs(this.scrollVel) < 0.002 &&
      Math.abs(this.settleVel) < 0.004 &&
      Math.abs(this.flow) < 0.05;

    if (settled !== this.isSettled) {
      this.isSettled = settled;
      this.onScrollingChange?.(!settled);
    }

    if (!force && !settled) return;

    if (!force && snapped === this.lastIndex) return;
    if (snapped !== this.lastIndex) {
      for (const index of [this.lastIndex, snapped]) {
        const disc = this.discs[index];
        if (!disc) continue;
        gsap.killTweensOf(disc);
        disc.group.userData.flipY = 0;
        disc.spinX = disc.spinY = 0;
      }
      this.spinReset = null;
    }
    this.lastIndex = snapped;
    this.onIndexChange?.(snapped);
  }

  private buildSharedGeometry() {
    const holeInner = 2 * W.holeSize;
    const hubOuter = W.hubSize;
    const thickness = W.discThickness;
    const faceOuter = 1 - W.edgeBleed;
    const holeRadius = holeInner / 2;
    const hubSpan = hubOuter - holeRadius;
    const matrixInner = holeRadius + hubSpan * 0.34;
    const matrixOuter = matrixInner + hubSpan * W.hubMatrixWidth;
    const hubThickness = thickness * 1.02;

    const frontGeometry = new THREE.RingGeometry(hubOuter, faceOuter, 220, 1);
    const backGeometry = new THREE.RingGeometry(hubOuter, faceOuter, 220, 1);
    remapRingUv(frontGeometry);
    remapRingUv(backGeometry);

    this.shared.frontGeometry = frontGeometry;
    this.shared.backGeometry = backGeometry;
    this.shared.edgeGeometry = createEdgeGeometry(
      thickness,
      W.edgeBevel,
      W.edgeBleed,
    );
    this.shared.hubGeometry = createHubRingGeometry(
      matrixOuter,
      hubOuter,
      hubThickness,
      0.22,
      160,
    );
    this.shared.matrixGeometry = createHubRingGeometry(
      matrixInner,
      matrixOuter,
      hubThickness * 0.88,
      0.12,
      128,
    );
    this.shared.frostGeometry = createHubRingGeometry(
      holeRadius,
      matrixInner,
      hubThickness * 0.96,
      0.4,
      128,
    );

    this.shared.pickGeometry = new THREE.CircleGeometry(1, 24);
    this.shared.pickMaterial = new THREE.MeshBasicMaterial({
      visible: false,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.shared.frontRoughnessMap = createFrontRoughnessMap();

    this.shared.backMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(W.backBaseColor),
      roughness: W.backRough,
      metalness: 0.12,
      emissive: 0xffffff,
      emissiveIntensity: 0.15,
      clearcoat: W.backClearcoat,
      clearcoatRoughness: 0.06,
      iridescence: W.backIridescence,
      iridescenceIOR: W.backIridIOR,
      iridescenceThicknessRange: [140, W.backIridThickness],
      envMapIntensity: 1.5,
    });
    this.shared.edgeMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(W.edgeColor),
      roughness: W.edgeRoughness,
      metalness: W.edgeMetalness,
      clearcoat: 0.7,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.8,
      side: THREE.DoubleSide,
    });
    this.shared.matrixTexture = createMatrixTexture();
    this.shared.matrixMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xdfdfdf),
      map: this.shared.matrixTexture ?? undefined,
      roughness: 0.28,
      metalness: 0.82,
      clearcoat: 0.7,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.45,
      side: THREE.DoubleSide,
    });
    this.shared.frostMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xf2f2f4),
      roughness: 0.25 + W.hubFrostedEdge * 0.55,
      metalness: 0,
      transmission: Math.max(0.12, (1 - W.hubFrostedEdge) * 0.5),
      thickness: 0.3,
      ior: 1.5,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.9,
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.shared.hubMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(W.hubColor),
      roughness: W.hubRoughness,
      metalness: 0,
      transmission: W.hubTransmission,
      thickness: 0.6,
      ior: W.hubIOR,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.3,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }

  private initScribble() {
    if (!W.scribbleEnabled) return;
    this.scribbleMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(W.scribbleColor),
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    for (let i = 0; i < W.scribbleLoops; i += 1) {
      const geometry = createScribbleGeometry(this.scribbleSegments);
      const mesh = new THREE.Mesh(geometry, this.scribbleMaterial);
      mesh.renderOrder = 900;
      this.scribbleGeometries.push(geometry);
      this.scribbleGroup.add(mesh);
    }
    this.scribbleGroup.visible = false;
    this.gallery.add(this.scribbleGroup);
  }

  private rebuildAllScribbleLoops(progress: number) {
    this.scribbleGeometries.forEach((geometry, index) => {
      rebuildScribbleLoop(geometry, index, progress, this.scribbleSegments);
    });
  }

  private playbackScribble = false;
  private playingVoiceId: string | null = null;

  setPlayingVoice(voiceId: string | null) {
    this.playbackScribble = true;
    this.playingVoiceId = voiceId;
    this.host.dataset.playingVoice = voiceId || "";
    this.start();
  }

  private scribbleTargetIndex() {
    if (!W.scribbleEnabled) return -1;
    if (this.playbackScribble) {
      return this.playingVoiceId ? this.films.findIndex(film => film.voiceId === this.playingVoiceId) : -1;
    }
    if (!this.finePointer) return -1;
    const active = clamp(Math.round(this.scroll), 0, this.films.length - 1);
    if (this.hoverIndex >= 0 && this.hoverIndex === active) return active;
    return -1;
  }

  private scribbleShouldSnapFollow() {
    return (
      this.dragCommitted ||
      Math.abs(this.scrollVel) > 1e-5 ||
      Math.abs(this.scroll - Math.round(this.scroll)) > 0.0015
    );
  }

  private followScribbleToDisc(disc: DiscSlot, instant: boolean, dt: number) {
    const alpha = instant
      ? 1
      : 1 - Math.exp(-Math.max(0, W.scribbleLag) * dt);
    if (instant) {
      this.scribbleGroup.position.copy(disc.group.position);
      this.scribbleGroup.quaternion.copy(disc.group.quaternion);
      this.scribbleGroup.scale.copy(disc.group.scale);
      return;
    }
    this.scribbleGroup.position.lerp(disc.group.position, alpha);
    this.scribbleGroup.quaternion.slerp(disc.group.quaternion, alpha);
    this.scribbleGroup.scale.lerp(disc.group.scale, alpha);
  }

  private tickScribble(timeMs: number, dt: number) {
    if (!W.scribbleEnabled || !this.scribbleMaterial) return;
    const target = this.scribbleTargetIndex();
    this.host.dataset.playbackOutline = String(this.playbackScribble && target >= 0);
    const frameMs = 1000 / W.scribbleFps;

    if (target < 0) {
      if (this.scribblePhase === "hidden") return;
      if (this.scribblePhase !== "out") {
        this.scribblePhase = "out";
        this.scribbleFrame = 0;
        this.scribbleLastTick = timeMs;
      }
      const disc = this.discs[this.scribbleDiscIndex];
      if (disc) this.followScribbleToDisc(disc, this.scribbleShouldSnapFollow(), dt);
      if (timeMs - this.scribbleLastTick < frameMs) return;
      this.scribbleLastTick = timeMs;
      if (
        this.scribbleFrame >= W.scribbleOut.length ||
        !disc
      ) {
        this.scribblePhase = "hidden";
        this.scribbleDiscIndex = -1;
        this.scribbleGroup.visible = false;
        return;
      }
      this.rebuildAllScribbleLoops(W.scribbleOut[this.scribbleFrame] ?? 0.3);
      this.scribbleFrame += 1;
      return;
    }

    const disc = this.discs[target];
    if (!disc) return;

    if (
      this.scribblePhase === "hidden" ||
      this.scribbleDiscIndex !== target
    ) {
      this.scribblePhase = "in";
      this.scribbleFrame = 0;
      this.scribbleDiscIndex = target;
      this.scribbleLastTick = timeMs;
      this.followScribbleToDisc(disc, true, dt);
      this.rebuildAllScribbleLoops(W.scribbleIn[0] ?? 0.5);
      this.scribbleFrame = 1;
      this.scribbleGroup.visible = true;
      return;
    }

    this.followScribbleToDisc(
      disc,
      this.scribbleShouldSnapFollow(),
      dt,
    );
    if (this.reducedMotion || timeMs - this.scribbleLastTick < frameMs) {
      return;
    }
    this.scribbleLastTick = timeMs;
    if (
      this.scribblePhase === "in" &&
      this.scribbleFrame < W.scribbleIn.length
    ) {
      this.rebuildAllScribbleLoops(W.scribbleIn[this.scribbleFrame] ?? 1);
      this.scribbleFrame += 1;
    } else {
      this.scribblePhase = "on";
      this.rebuildAllScribbleLoops(1);
    }
  }

  private async ensureTextures(films: DiscItem[]) {
    const loader = new THREE.TextureLoader();
    const missing = [...new Set(films.flatMap(f => [f.disc, f.backDisc].filter((url): url is string => !!url)))].filter(url => !this.textureCache.has(url));
    await Promise.all(missing.map(url => {
      const pending = this.textureLoads.get(url);
      if (pending) return pending;
      const loading = new Promise<void>((resolve, reject) => {
      loader.load(url, texture => {
        if (this.destroyed) { texture.dispose(); resolve(); return; }
        const image = texture.image as HTMLImageElement;
        if (Math.max(image.width, image.height) > 1024) {
          const canvas = document.createElement("canvas");
          const scale = 1024 / Math.max(image.width, image.height);
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
          texture.image = canvas;
          texture.needsUpdate = true;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        this.textureCache.set(url, texture); resolve();
      }, undefined, reject);
      });
      this.textureLoads.set(url, loading);
      void loading.finally(() => this.textureLoads.delete(url)).catch(() => undefined);
      return loading;
    }));
  }

  private async loadTextureWindow(index: number) {
    if (this.textureWindow === index || this.destroyed) return;
    this.textureWindow = index;
    const radius = Math.ceil(W.renderRadius) + 2;
    const nearby = this.films.slice(Math.max(0, index - radius), index + radius + 1);
    try {
      await this.ensureTextures(nearby);
      if (this.destroyed) return;
      this.discs.forEach(disc => {
        const film = this.films[disc.index];
        if (!nearby.includes(film)) return;
        const front = this.textureCache.get(film.disc);
        const back = this.textureCache.get(film.backDisc || "");
        if (front && disc.frontMaterial.map !== front) {
          disc.frontMaterial.map = front;
          disc.frontMaterial.needsUpdate = true;
        }
        if (back && disc.backMaterial instanceof THREE.MeshBasicMaterial && disc.backMaterial.map !== back) {
          disc.backMaterial.map = back;
          disc.backMaterial.needsUpdate = true;
        }
      });
    } catch (error) {
      if (!this.destroyed) { this.textureWindow = -1; console.error("[gallery] artwork failed", error); }
    }
  }

  private async preloadAllCatalogTextures() {
    if (!this.texturesReady) {
      this.texturesReady = this.ensureTextures(DISC_ITEMS);
    }
    await this.texturesReady;
  }

  private clearDiscs() {
    this.discs.forEach((disc) => {

      disc.frontMaterial.map = null;
      disc.frontMaterial.dispose();
      disc.backMaterial.dispose();
      disc.spin.children.forEach(child => {
        if (child instanceof THREE.Mesh && child !== disc.front && child.material !== disc.backMaterial && child.material !== this.shared.pickMaterial) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(material => material.dispose());
        }
      });
      this.gallery.remove(disc.group);
    });
    this.discs = [];
    this.pickMeshes = [];
  }

  private async buildDiscs() {
    if (!this.shared.frontGeometry) this.buildSharedGeometry();

    await this.ensureTextures(this.films.slice(0, Math.ceil(W.renderRadius) + 3));
    if (this.destroyed) return;

    const thickness = W.discThickness;
    this.films.forEach((film, index) => {
      const group = new THREE.Group();
      const spin = new THREE.Group();
      group.add(spin);

      // Preserve artwork colors on both printed faces; only the rim and hub reflect light.
      const frontMaterial = new THREE.MeshBasicMaterial({
        map: this.textureCache.get(film.disc) ?? null,
        color: 0xffffff,
        toneMapped: false,
        fog: false,
        transparent: true,
      });
      const front = new THREE.Mesh(this.shared.frontGeometry!, frontMaterial);
      front.userData.discIndex = index;
      const backTexture = this.textureCache.get(film.backDisc || "");
      // Printed artwork keeps its source colors; the edge and hub provide reflections.
      const backMaterial = film.backDisc
        ? new THREE.MeshBasicMaterial({
            map: backTexture,
            color: 0xffffff,
            toneMapped: false,
            fog: false,
            transparent: true,
          })
        : this.shared.backMaterial!.clone();
      const back = new THREE.Mesh(this.shared.backGeometry!, backMaterial);
      const edge = new THREE.Mesh(
        this.shared.edgeGeometry!,
        this.shared.edgeMaterial!.clone(),
      );
      const hub = new THREE.Mesh(
        this.shared.hubGeometry!,
        this.shared.hubMaterial!.clone(),
      );
      const matrix = new THREE.Mesh(
        this.shared.matrixGeometry!,
        this.shared.matrixMaterial!.clone(),
      );
      const frost = new THREE.Mesh(
        this.shared.frostGeometry!,
        this.shared.frostMaterial!.clone(),
      );

      front.position.z = thickness / 2 + 0.0006;
      back.position.z = -thickness / 2 - 0.0006;
      back.rotation.y = Math.PI;
      edge.rotation.x = Math.PI / 2;
      hub.rotation.x = Math.PI / 2;
      matrix.rotation.x = Math.PI / 2;
      frost.rotation.x = Math.PI / 2;

      spin.add(front, back, edge, hub, matrix, frost);

      const pick = new THREE.Mesh(
        this.shared.pickGeometry!,
        this.shared.pickMaterial!,
      );
      pick.userData.discIndex = index;
      pick.renderOrder = -1;
      spin.add(pick);

      this.gallery.add(group);
      this.pickMeshes.push(pick);
      this.discs.push({
        index,
        group,
        spin,
        front,
        frontMaterial,
        backMaterial,
        hover: 0,
        spinX: 0,
        spinY: 0,
        spinZ: 0,
        pushX: 0,
        pushY: 0,
        pushZ: 0,
        pushVX: 0,
        pushVY: 0,
        pushVZ: 0,
        pushRotX: 0,
        pushRotY: 0,
        pushRotVX: 0,
        pushRotVY: 0,
      });
    });
  }

  private enterPreload() {
    this.preload.active = true;
    this.preload.turn = 0;
    this.preload.rise = 0;
    this.preload.riseFrom = W.preloadRiseFrom;
    this.preload.growing = W.preloadGrowBy > 0;
    this.flight.others = 0;
    this.flight.inbound = true;
    this.flight.active = this.preload.growing ? 0.001 : W.preloadBoost;
    this.flightProxy.others = 0;
    this.flightProxy.active = this.flight.active;
    this.flightLocked = true;
    this.host.setAttribute("data-disc-preloading", "true");
    this.host.setAttribute("data-disc-flight", "true");
    const active = this.discs[this.logicalIndex()];
    if (active) {
      active.spinY = -Math.PI / 2;
      active.spinX = 0;
      active.spinZ = W.preloadSpin;
    }
    this.applyPreloadPose();

    this.discs.forEach((disc) => {
      const isActive = disc.index === this.logicalIndex();
      if (!isActive) {
        disc.group.visible = false;
        disc.group.scale.setScalar(0.001);
      }
    });

    this.snapActivePreloadTransform();
  }

  private snapActivePreloadTransform() {
    const active = this.discs[this.logicalIndex()];
    if (!active || !this.preload.active) return;
    this.applyPreloadPose();
    const rise = this.riseOffset(this.preload.rise, this.riseScratch);

    active.group.position.set(rise.x, W.activeDiscY + rise.y, rise.z);
    active.group.rotation.set(0, 0, 0);
    active.group.scale.setScalar(Math.max(0.001, this.flight.active));
    active.group.visible = true;
    active.spin.rotation.set(active.spinX, active.spinY, active.spinZ);
    this.gallery.updateWorldMatrix(true, true);
  }

  private calibratePreloadFloor(y: number) {
    if (!Number.isFinite(y) || !this.preload.active) return;
    const sample = (riseFrom: number) => {
      const prev = this.preload.riseFrom;
      this.preload.riseFrom = riseFrom;
      const a = this.preloadAnchor(0);
      this.preload.riseFrom = prev;
      return a.y + a.r;
    };
    let lo = 0;
    let hi = W.preloadRiseFrom;
    if (sample(hi) <= y) {
      this.preload.riseFrom = hi;
    } else {
      for (let i = 0; i < 14; i += 1) {
        const mid = (lo + hi) / 2;
        if (sample(mid) > y) hi = mid;
        else lo = mid;
      }
      this.preload.riseFrom = lo;
    }
    this.snapActivePreloadTransform();

    if (!this.destroyed) this.renderer.render(this.scene, this.camera);
    this.start();
  }

  private updatePreloadGrow() {
    if (!this.preload.growing) return;
    const growBy = clamp(W.preloadGrowBy, 0, 1);
    const t = growBy > 0 ? clamp(this.preload.rise / growBy, 0, 1) : 1;
    const eased = 1 - (1 - t) * (1 - t);
    let scale = Math.max(0.001, W.preloadBoost * eased);

    if (this.preload.floorY != null) {
      scale = Math.max(scale, W.preloadBoost * 0.4);
    }
    this.flight.active = scale;
    this.flightProxy.active = this.flight.active;
    if (t >= 1) this.preload.growing = false;
  }

  private applyPreloadPose() {
    const active = this.discs[this.logicalIndex()];
    if (!active) return;
    const remain = 1 - clamp(this.preload.turn, 0, 1);
    active.spinY = (-Math.PI / 2) * remain;
    active.spinX = 0;
    active.spinZ = W.preloadSpin * remain * remain;
    this.updatePreloadGrow();
  }

  private riseOffset(rise: number, out: THREE.Vector3) {
    const t = 1 - clamp(rise, 0, 1);
    out.set(0, -this.preload.riseFrom * t, -W.preloadRiseDepth * t);
    if (t === 0) return out;
    this.invGalleryQuat.copy(this.gallery.quaternion).invert();
    out.applyQuaternion(this.invGalleryQuat);
    out.divideScalar(this.gallery.scale.x || 1);
    return out;
  }

  private projectToHost(world: THREE.Vector3) {

    this.camera.updateMatrixWorld(true);
    this.gallery.updateWorldMatrix(true, true);

    const w = Math.max(
      1,
      this.host.clientWidth || this.renderer.domElement.clientWidth || 0,
    );
    const h = Math.max(
      1,
      this.host.clientHeight || this.renderer.domElement.clientHeight || 0,
    );
    this.projectScratch.copy(world).project(this.camera);
    return {
      x: (this.projectScratch.x + 1) * 0.5 * w,
      y: (1 - this.projectScratch.y) * 0.5 * h,
    };
  }

  private preloadAnchor(rise: number) {
    this.camera.updateMatrixWorld(true);
    this.gallery.updateWorldMatrix(true, true);

    const offset = this.riseOffset(rise, this.riseScratch);
    const local = new THREE.Vector3(
      offset.x,
      W.activeDiscY + offset.y,
      offset.z,
    );

    const boost = W.preloadBoost;
    const liveScale = Math.max(W.preloadBoost, this.flight.active);
    const center = this.gallery.localToWorld(local.clone());
    const boostEdge = this.gallery.localToWorld(
      local.clone().add(new THREE.Vector3(boost, 0, 0)),
    );
    const liveEdge = this.gallery.localToWorld(
      local.clone().add(new THREE.Vector3(liveScale, 0, 0)),
    );
    const restEdge = this.gallery.localToWorld(
      local.clone().add(new THREE.Vector3(1, 0, 0)),
    );
    const c = this.projectToHost(center);
    const b = this.projectToHost(boostEdge);
    const l = this.projectToHost(liveEdge);
    const r = this.projectToHost(restEdge);
    return {
      x: c.x,
      y: c.y,
      r: Math.hypot(b.x - c.x, b.y - c.y),
      live: Math.hypot(l.x - c.x, l.y - c.y),
      rest: Math.hypot(r.x - c.x, r.y - c.y),
    };
  }

  private coverIndicesAround(center: number, radius: number) {
    const out: number[] = [];
    const r = Math.max(0, Math.round(radius));
    for (let i = 0; i <= r; i += 1) {
      const lo = center - i;
      const hi = center + i;
      if (lo >= 0 && lo < this.films.length) out.push(lo);
      if (i && hi >= 0 && hi < this.films.length) out.push(hi);
    }
    return out;
  }

  private async loadCover(index: number) {
    const film = this.films[index];
    if (!film) return;
    await this.ensureTextures([film]);
    const disc = this.discs[index];
    const tex = this.textureCache.get(film.disc);
    if (disc && tex) disc.frontMaterial.map = tex;
  }

  private endPreload() {
    this.preload.active = false;
    this.preload.tween?.kill();
    this.preload.tween = null;
    this.preload.growing = false;
    this.preload.floorY = null;
    this.host.removeAttribute("data-disc-preloading");
  }

  private settlePreloadPose() {
    this.flight.others = 1;
    this.flight.active = 1;
    this.flightProxy.others = 1;
    this.flightProxy.active = 1;
    this.flight.inbound = false;
    this.flightLocked = false;
    this.host.removeAttribute("data-disc-flight");
    this.host.removeAttribute("data-disc-preloading");
    const active = this.discs[this.logicalIndex()];
    if (active) {
      active.spinY = 0;
      active.spinX = 0;
      active.spinZ = 0;
    }
    this.endPreload();
  }

  private publishPreloaderApi() {
    const years = this.films
      .map((f) => Number.parseInt(String(f.year || ""), 10))
      .filter((y) => Number.isFinite(y));
    const lead = this.films[this.logicalIndex()] ?? this.films[0] ?? null;
    const covers = this.coverIndicesAround(
      this.logicalIndex(),
      W.renderRadius + 1,
    );
    const api: GalleryPreloader = {
      count: this.films.length,
      covers: covers.slice(),
      meta: {
        count: this.films.length,
        years: years.length
          ? [Math.min(...years), Math.max(...years)]
          : null,
        lead: lead ? { title: lead.title || "", year: lead.year || "" } : null,
      },
      anchor: () =>
        this.preloadAnchor(this.preload.active ? this.preload.rise : 1),
      floor: (y) => {
        this.preload.floorY = y;
        this.calibratePreloadFloor(y);
      },
      cover: (index) => this.loadCover(index),
      pose: ({ turn, rise }) => {
        if (!this.preload.active) return;
        if (Number.isFinite(turn)) this.preload.turn = clamp(turn!, 0, 1);
        if (Number.isFinite(rise)) this.preload.rise = clamp(rise!, 0, 1);
        this.applyPreloadPose();

        this.snapActivePreloadTransform();
        if (!this.running && !this.destroyed) {
          this.renderer.render(this.scene, this.camera);
        }
        this.start();
      },
      fan: () => {
        if (!this.preload.active) {
          this.settlePreloadPose();
          return Promise.resolve();
        }
        document.dispatchEvent(new CustomEvent("discgalleryreveal"));
        this.preload.turn = 1;
        this.preload.rise = 1;
        this.applyPreloadPose();
        this.preload.growing = false;
        return new Promise<void>((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            resolve();
          };
          const duration = W.preloadFanDuration;
          gsap.killTweensOf(this.flightProxy);
          this.flightProxy.others = this.flight.others;
          this.flightProxy.active = this.flight.active;
          const tl = gsap.timeline({
            onUpdate: () => {
              this.flight.others = this.flightProxy.others;
              this.flight.active = this.flightProxy.active;
            },
            onComplete: () => {
              this.settlePreloadPose();
              done();
            },
          });
          this.preload.tween = tl;

          tl.to(
            this.flightProxy,
            { active: 1, duration, ease: DISC_GLIDE },
            0,
          );
          tl.to(
            this.flightProxy,
            { others: 1, duration: duration * 0.85, ease: "none" },
            duration * 0.1,
          );
        });
      },
      revealCopy: () => {
        this.host.removeAttribute("data-disc-flight");
        this.onRevealCopy?.();
      },
      abort: () => {
        if (!this.preload.active) {
          this.settlePreloadPose();
          this.onRevealCopy?.();
          return;
        }
        this.preload.turn = 1;
        this.preload.rise = 1;
        this.applyPreloadPose();
        this.preload.growing = false;
        this.settlePreloadPose();
        document.dispatchEvent(new CustomEvent("discgalleryreveal"));
        this.onRevealCopy?.();
      },
    };
    (this.host as HTMLElement & { discGalleryPreloader?: GalleryPreloader }).discGalleryPreloader =
      api;
  }

  async swapCatalog(films: DiscItem[]): Promise<void> {
    if (this.swapping) return;
    if (films === this.films) return;
    if (
      films.length === this.films.length &&
      films.every((film, index) => film.slug === this.films[index]?.slug)
    ) {
      return;
    }

    this.swapping = true;
    try {
      await this.flightOut();
      await this.rebuildCatalog(films);
      await this.flightIn();
      this.onIndexChange?.(0);
    } finally {
      this.swapping = false;
    }
  }

  private async flightOut() {
    this.abortWheelGesture();
    this.snapTween?.kill();
    this.snapTween = null;
    this.snapTarget = -1;
    this.scrollVel = 0;
    this.settleVel = 0;
    this.flow = 0;
    this.spinReset = null;
    this.spinDiscIndex = -1;
    this.hoverIndex = -1;
    this.pointerDown = false;
    this.flightLocked = true;
    this.flight.inbound = false;
    this.host.setAttribute("data-disc-flight", "true");

    const active = this.discs[this.logicalIndex()];

    if (this.reducedMotion) {
      this.flight.others = 0;
      this.flight.active = W.flightBoost;
      this.flightProxy.others = 0;
      this.flightProxy.active = W.flightBoost;
      if (active) {
        active.spinY = Math.PI / 2;
        active.spinX = 0;
      }
      return;
    }

    gsap.killTweensOf(this.flightProxy);
    this.flightProxy.others = this.flight.others;
    this.flightProxy.active = this.flight.active;

    await new Promise<void>((resolve) => {
      const tl = gsap.timeline({
        onUpdate: () => {
          this.flight.others = this.flightProxy.others;
          this.flight.active = this.flightProxy.active;
        },
        onComplete: () => resolve(),
      });
      tl.to(
        this.flightProxy,
        { others: 0, duration: W.flightOutDuration, ease: "none" },
        0,
      );
      tl.to(
        this.flightProxy,
        {
          active: W.flightBoost,
          duration: W.flightOutDuration,
          ease: "power2.in",
        },
        0,
      );
      if (active) {
        tl.to(
          active,
          {
            spinY: Math.PI / 2,
            spinX: 0,
            duration: W.flightOutDuration,
            ease: "power2.in",
          },
          0,
        );
      }
    });
  }

  private async rebuildCatalog(films: DiscItem[]) {
    this.clearDiscs();
    this.films = films;
    this.scroll = 0;
    this.scrollProxy.value = 0;
    this.prevScroll = 0;
    this.lastIndex = 0;
    this.isSettled = true;
    await this.buildDiscs();

    this.discs.forEach((disc) => {
      disc.group.position.set(0, 0, 0);
      disc.group.scale.setScalar(0.001);
      disc.group.visible = false;
    });
    const active = this.discs[0];
    if (active) {
      active.spinY = -Math.PI / 2;
      active.spinX = 0;
      active.group.visible = true;
      active.group.scale.setScalar(W.flightBoost);
    }
    this.flight.others = 0;
    this.flight.active = W.flightBoost;
    this.flightProxy.others = 0;
    this.flightProxy.active = W.flightBoost;
    this.flight.inbound = true;
  }

  private async flightIn() {
    this.flightLocked = true;
    this.flight.inbound = true;
    this.host.setAttribute("data-disc-flight", "true");
    const active = this.discs[0];

    if (this.reducedMotion) {
      this.flight.others = 1;
      this.flight.active = 1;
      this.flightProxy.others = 1;
      this.flightProxy.active = 1;
      if (active) {
        active.spinY = 0;
        active.spinX = 0;
      }
      this.flightLocked = false;
      this.flight.inbound = false;
      this.host.removeAttribute("data-disc-flight");
      this.emitIndex(true);
      return;
    }

    gsap.killTweensOf(this.flightProxy);
    this.flightProxy.others = 0;
    this.flightProxy.active = W.flightBoost;

    await new Promise<void>((resolve) => {
      const tl = gsap.timeline({
        onUpdate: () => {
          this.flight.others = this.flightProxy.others;
          this.flight.active = this.flightProxy.active;
        },
        onComplete: () => {
          this.flight.others = 1;
          this.flight.active = 1;
          this.flightProxy.others = 1;
          this.flightProxy.active = 1;
          resolve();
        },
      });
      if (active) {
        tl.to(
          active,
          {
            spinY: 0,
            duration: W.flightInDuration,
            ease: "power2.out",
          },
          0,
        );
      }
      tl.to(
        this.flightProxy,
        { active: 1, duration: W.flightInDuration, ease: DISC_GLIDE },
        0,
      );
      tl.to(
        this.flightProxy,
        {
          others: 1,
          duration: W.flightInDuration * 0.85,
          ease: "none",
        },
        W.flightInDuration * 0.28,
      );
    });

    this.flightLocked = false;
    this.flight.inbound = false;
    this.host.removeAttribute("data-disc-flight");
    this.emitIndex(true);
  }

  private updatePointerFromEvent(event: PointerEvent | MouseEvent) {
    const rect = this.host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.pointerLocal.x = x;
    this.pointerLocal.y = y;
    this.pointerLocal.width = rect.width;
    this.pointerLocal.height = rect.height;
    this.pointerNdc.x = (x / rect.width) * 2 - 1;
    this.pointerNdc.y = -(y / rect.height) * 2 + 1;
    this.pointerClient.x = event.clientX;
    this.pointerClient.y = event.clientY;
  }

  private isPointerOverHost(event: PointerEvent) {
    const rect = this.host.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  private pickHoverIndex() {
    if (!this.finePointer || this.pointerDown || !this.pointerInside) {
      return -1;
    }
    if (!this.pickMeshes.length) return -1;
    this.gallery.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = this.pickDisc();
    if (!hit) {
      this.hitUv.x = 0;
      this.hitUv.y = 0;
      return -1;
    }
    if (hit.uv) {
      this.hitUv.x = hit.uv.x * 2 - 1;
      this.hitUv.y = hit.uv.y * 2 - 1;
    } else {
      this.hitUv.x = 0;
      this.hitUv.y = 0;
    }
    const index = hit.object.userData.discIndex;
    return typeof index === "number" ? index : -1;
  }

  private applyWipeImpulse(index: number) {
    const speed = Math.hypot(this.pointerVelX, this.pointerVelY);
    if (speed < W.wipeMinSpeed || index < 0) return;
    const disc = this.discs[index];
    if (!disc) return;
    disc.pushVX += clamp(
      this.pointerVelX * W.wipePush,
      -W.wipePushMax,
      W.wipePushMax,
    );
    disc.pushVY -= clamp(
      this.pointerVelY * W.wipePush,
      -W.wipePushMax,
      W.wipePushMax,
    );
    disc.pushRotVY += clamp(
      this.pointerVelX * W.wipeSpin,
      -W.wipeSpinMax,
      W.wipeSpinMax,
    );
    disc.pushRotVX += clamp(
      this.pointerVelY * W.wipeSpin,
      -W.wipeSpinMax,
      W.wipeSpinMax,
    );
  }

  private applyPressImpulse(index: number) {
    const disc = this.discs[index];
    if (!disc) return;
    disc.pushVZ -= W.pressDepth;
    disc.pushRotVY += this.hitUv.x * W.pressTilt;
    disc.pushRotVX -= this.hitUv.y * W.pressTilt;
  }

  private activeIndex() {
    if (this.snapTarget >= 0) return this.snapTarget;
    return clamp(Math.round(this.scroll), 0, this.films.length - 1);
  }

  flipActive() {
    if (this.flightLocked || this.swapping) return;
    const disc = this.discs[this.activeIndex()];
    if (!disc) return;
    this.spinReset = null;
    const target = disc.group.userData.flipY ? 0 : Math.PI;
    gsap.killTweensOf(disc);
    disc.group.userData.flipY = target;
    gsap.to(disc, { spinY: target, duration: 0.8, ease: "power3.inOut" });
  }

  private hitDiscIndex() {
    this.gallery.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = this.pickDisc();
    return typeof hit?.object.userData.discIndex === "number"
      ? hit.object.userData.discIndex
      : -1;
  }

  private pickDisc() {
    // Raycaster includes invisible objects unless explicitly filtered.
    const pickable = this.pickMeshes.filter(mesh => {
      const disc = this.discs[mesh.userData.discIndex];
      return disc?.group.visible && disc.group.scale.x > 0.05;
    });
    return this.raycaster.intersectObjects(pickable, false)[0];
  }

  private openActiveFilm(event: MouseEvent) {
    const film = this.films[this.activeIndex()];
    if (!film) return false;
    if (event.metaKey || event.ctrlKey) {
      window.open(`#${itemDetailPath(film.slug)}`, "_blank", "noopener");
      return true;
    }
    if (event.type === "click") {
      this.applyPressImpulse(this.activeIndex());
    }
    this.onOpenFilm?.(film, event);
    return true;
  }

  private onDiscClick = (event: MouseEvent) => {
    if (this.flightLocked || this.swapping) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (performance.now() < this.clickBlockUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const target = event.target as Element | null;
    if (target?.closest?.("a, button, [data-disc-no-open]")) return;

    this.updatePointerFromEvent(event);
    const hitIndex = this.hitDiscIndex();
    if (hitIndex < 0) return;

    const active = this.activeIndex();
    if (hitIndex === active && (this.isSnapTweening() || Math.abs(this.scroll - active) >= W.settleEpsilon)) return;
    if (hitIndex !== active) {
      event.preventDefault();
      this.abortWheelGesture();
      this.applyPressImpulse(hitIndex);
      this.snapToIndex(hitIndex, { source: "click", onComplete: () => {
        this.onOpenFilm?.(this.films[hitIndex], event);
      } });
      return;
    }

    if (this.openActiveFilm(event)) {
      event.preventDefault();
    }
  };

  private wheelDelta(event: WheelEvent) {
    let dx = event.deltaX;
    let dy = event.deltaY;
    if (event.deltaMode === 1) {
      dx *= 16;
      dy *= 16;
    } else if (event.deltaMode === 2) {
      dx *= window.innerWidth;
      dy *= window.innerHeight;
    }
    return Math.abs(dx) > Math.abs(dy) * 1.25 ? dx : dy;
  }

  private resetWheelGesture() {
    this.wheelOpen = true;
    this.wheelFlickMode = false;
    this.wheelAccum = 0;
    this.wheelDir = 0;
    this.wheelEnvelope = 0;
    this.wheelPeak = 0;
    this.wheelBurstCount = 0;
    this.wheelLastStepAt = 0;
    this.wheelLastEventAt = 0;
    this.wheelHasEvent = false;
  }

  private abortWheelGesture() {
    if (this.wheelIdleTimer) {
      window.clearTimeout(this.wheelIdleTimer);
      this.wheelIdleTimer = 0;
    }
    this.resetWheelGesture();
  }

  private scheduleWheelIdleReset() {
    if (this.wheelIdleTimer) window.clearTimeout(this.wheelIdleTimer);
    this.wheelIdleTimer = window.setTimeout(() => {
      this.wheelIdleTimer = 0;
      this.resetWheelGesture();
    }, W.wheelIdleReset);
  }

  focusVoice(voiceId: string) {
    const index = this.films.findIndex(film => film.voiceId === voiceId);
    if (index < 0 || this.destroyed) return false;
    this.snapToIndex(index);
    this.start();
    return true;
  }

  private snapToIndex(
    index: number,
    options: { source?: "wheel" | "snap" | "flick" | "click"; immediate?: boolean; onComplete?: () => void } = {},
  ) {
    const max = this.films.length - 1;
    const target = clamp(index, 0, max);
    const distance = Math.abs(target - this.scroll);
    const source = options.source ?? "snap";
    const duration =
      source === "wheel"
        ? W.snapDuration + 0.05
        : source === "flick"
          ? W.snapDuration + 0.1
          : W.snapDuration;
    const kick = source === "wheel" ? W.wheelKick : 0;

    this.snapTarget = target;
    this.scrollVel = 0;
    this.settleVel = 0;
    this.snapTween?.kill();
    this.snapTween = null;

    if (!this.reducedMotion && kick) {
      const sign = Math.sign(target - this.scroll);
      if (sign) this.flow = clamp(this.flow + sign * kick, -12, 12);
    }

    if (this.reducedMotion || options.immediate || distance < 1e-4) {
      this.scroll = target;
      this.scrollProxy.value = target;
      this.prevScroll = target;
      this.flow = 0;
      this.snapTarget = -1;
      this.emitIndex(true);
      options.onComplete?.();
      return;
    }

    this.scrollProxy.value = this.scroll;
    this.snapTween = gsap.to(this.scrollProxy, {
      value: target,
      duration,
      ease: DISC_GLIDE,
      overwrite: true,
      onUpdate: () => {
        this.scroll = this.scrollProxy.value;
      },
      onComplete: () => {
        this.scroll = target;
        this.scrollProxy.value = target;
        this.snapTween = null;
        this.snapTarget = -1;
        this.emitIndex(true);
        options.onComplete?.();
      },
    });
  }

  private stepWheel(dir: number, magnitude: number, now: number) {
    this.wheelOpen = false;
    this.wheelFlickMode = false;
    this.wheelAccum = 0;
    this.wheelLastStepAt = now;
    this.wheelBurstCount = 0;
    this.wheelPeak = magnitude;
    const from = this.logicalIndex();
    const next = clamp(from + dir, 0, this.films.length - 1);
    if (next !== from) this.snapToIndex(next, { source: "wheel" });
  }

  private onWheel(event: WheelEvent) {
    if ((event.target as Element)?.closest("select, input, textarea, button")) return;
    if (!this.host.isConnected || this.flightLocked || this.swapping) return;
    const page = this.host.closest(".dg-page");
    if (!page || !this.host.getClientRects().length) return;
    if (event.ctrlKey) return;

    if (page.classList.contains("dg-page--detail")) {
      const rect = this.host.getBoundingClientRect();
      if (rect.top > window.innerHeight * 0.35) return;
    }

    const signed = this.wheelDelta(event);
    const magnitude = Math.abs(signed);
    event.preventDefault();
    event.stopPropagation();

    const now = performance.now();
    const sinceLast = this.wheelHasEvent ? now - this.wheelLastEventAt : Infinity;
    this.wheelLastEventAt = now;
    this.wheelHasEvent = true;
    this.scheduleWheelIdleReset();

    const decayed =
      sinceLast === Infinity
        ? 0
        : this.wheelEnvelope * Math.exp(-sinceLast / W.wheelEnvelopeTau);
    if (magnitude < W.wheelNoiseFloor) {
      this.wheelEnvelope = decayed;
      return;
    }

    const rising = magnitude > decayed * W.wheelRiseFactor;
    this.wheelEnvelope = Math.max(magnitude, decayed);

    if (!this.wheelOpen) {
      this.wheelBurstCount += 1;
      this.wheelPeak = Math.max(this.wheelPeak, magnitude);
      const sinceStep = now - this.wheelLastStepAt;
      const pause = sinceLast >= W.wheelPauseGap;
      const tick =
        sinceLast >= W.wheelTickGap &&
        this.wheelBurstCount <= 2 &&
        sinceStep >= W.wheelMinStepTick &&
        magnitude >= this.wheelPeak * W.wheelTickRatio;
      const flick = rising && sinceStep >= W.wheelMinStepFlick;
      const sustain =
        sinceStep >= W.wheelSustainDelay &&
        this.wheelEnvelope >= this.wheelPeak * W.wheelSustainRatio;
      if (!(pause || tick || flick || sustain)) return;
      this.wheelOpen = true;
      this.wheelAccum = 0;
      this.wheelDir = 0;

      this.wheelFlickMode = !(pause || tick || sustain);
    }

    const dir = signed > 0 ? 1 : -1;
    if (dir !== this.wheelDir) {
      this.wheelAccum = 0;
      this.wheelDir = dir;
    }
    const contrib = this.wheelFlickMode
      ? Math.max(0, magnitude - decayed)
      : magnitude;
    this.wheelAccum += Math.min(contrib, W.wheelEventCap);
    if (this.wheelAccum >= W.wheelStepThreshold) {
      this.stepWheel(dir, magnitude, now);
    }
  }

  private onPointerHoverMove = (event: PointerEvent) => {

    if (!this.finePointer || this.pointerDown || this.flightLocked || this.swapping) return;

    const inside = this.isPointerOverHost(event);
    this.pointerInside = inside;
    if (!inside) {
      this.hoverIndex = -1;
      this.pointerVelX = 0;
      this.pointerVelY = 0;
      return;
    }

    const now = performance.now();
    const dtMs = now - this.lastPointerSample;
    if (dtMs > 0 && dtMs < 120) {
      const scale = 16.7 / Math.max(8, dtMs);
      this.pointerVelX = (event.clientX - this.pointerClient.x) * scale;
      this.pointerVelY = (event.clientY - this.pointerClient.y) * scale;
    } else {
      this.pointerVelX = 0;
      this.pointerVelY = 0;
    }
    this.lastPointerSample = now;
    this.updatePointerFromEvent(event);

    const next = this.pickHoverIndex();
    if (next !== this.hoverIndex) {
      if (next >= 0) this.applyWipeImpulse(next);
      this.hoverIndex = next;
      this.host.style.cursor = next >= 0 ? "pointer" : "grab";
    }
  };

  private applySpinDelta(current: number, delta: number) {
    const limit = THREE.MathUtils.degToRad(W.maxSpinAngle);
    const over = Math.max(0, Math.abs(current) - limit * 0.8) / limit;
    const soften = 1 / (1 + over * over * 14);
    const sameDir =
      Math.sign(delta) === Math.sign(current) || current === 0;
    return current + delta * (sameDir ? soften : 1);
  }

  private beginSpinReset(index: number) {
    const disc = this.discs[index];
    if (!disc) return;
    if (Math.abs(disc.spinX) < 0.001 && Math.abs(disc.spinY) < 0.001) {
      disc.spinX = 0;
      disc.spinY = 0;
      this.spinReset = null;
      return;
    }
    this.spinReset = {
      index,
      fromX: disc.spinX,
      fromY: disc.spinY,
      t0: performance.now(),
    };
  }

  private onPointerDown = (event: PointerEvent) => {
    if ((event.target as Element)?.closest("button, select, input, .voice-panel")) return;
    if (event.button !== 0 || !event.isPrimary) return;
    if (this.flightLocked || this.swapping) return;
    this.pointerDown = true;
    this.dragCommitted = false;
    this.updatePointerFromEvent(event);
    this.dragOriginLocal.x = this.pointerLocal.x;
    this.dragOriginLocal.y = this.pointerLocal.y;
    this.dragLastLocal.x = this.pointerLocal.x;
    this.dragLastLocal.y = this.pointerLocal.y;
    this.dragLastTime = performance.now();
    this.spinReset = null;
    this.pointerInside = true;

    this.gallery.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = this.pickDisc();
    if (hit?.uv) {
      this.hitUv.x = hit.uv.x * 2 - 1;
      this.hitUv.y = hit.uv.y * 2 - 1;
    }
    const hitIndex =
      typeof hit?.object.userData.discIndex === "number"
        ? hit.object.userData.discIndex
        : -1;
    this.spinDiscIndex =
      hitIndex >= 0 && Math.abs(hitIndex - this.scroll) < 0.6 ? hitIndex : -1;
    this.hoverIndex = hitIndex;

    this.host.style.cursor = "grabbing";
    try {
      this.host.setPointerCapture(event.pointerId);
    } catch {

    }
  };

  private onPointerDragMove = (event: PointerEvent) => {
    if (!this.pointerDown) return;
    this.updatePointerFromEvent(event);

    const fromOriginX = this.pointerLocal.x - this.dragOriginLocal.x;
    const fromOriginY = this.pointerLocal.y - this.dragOriginLocal.y;
    if (!this.dragCommitted) {
      if (Math.hypot(fromOriginX, fromOriginY) < W.dragStartDistance) return;

      this.dragCommitted = true;
      this.abortWheelGesture();
      this.snapTween?.kill();
      this.snapTween = null;
      this.snapTarget = -1;
      this.scrollProxy.value = this.scroll;
      this.scrollVel = 0;
      this.settleVel = 0;
    }

    const now = performance.now();
    const deltaX = this.pointerLocal.x - this.dragLastLocal.x;
    const deltaY = this.pointerLocal.y - this.dragLastLocal.y;
    const dtMs = Math.max(8, now - this.dragLastTime);
    this.dragLastLocal.x = this.pointerLocal.x;
    this.dragLastLocal.y = this.pointerLocal.y;
    this.dragLastTime = now;

    if (this.spinDiscIndex >= 0) {
      const disc = this.discs[this.spinDiscIndex];
      if (!disc) return;
      const scale = W.dragSensitivity * W.dragSpinScale;
      disc.spinY = this.applySpinDelta(disc.spinY, deltaX * scale);
      disc.spinX = this.applySpinDelta(disc.spinX, deltaY * scale);
      return;
    }

    const span = W.dragGallerySpan * W.dragSensitivity;
    const step = -(deltaX / this.pointerLocal.width) * span;
    const max = this.films.length - 1;
    this.scroll = clamp(this.scroll + step, 0, max);
    const instant = clamp(
      (16.667 / dtMs) * step,
      -W.dragMaxVelocity,
      W.dragMaxVelocity,
    );
    this.scrollVel +=
      (instant - this.scrollVel) * W.dragVelocitySmoothing;
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.pointerDown) return;
    const wasCommitted = this.dragCommitted;
    const spun = wasCommitted ? this.spinDiscIndex : -1;
    this.pointerDown = false;
    this.dragCommitted = false;
    this.spinDiscIndex = -1;
    this.host.style.cursor = this.hoverIndex >= 0 ? "pointer" : "grab";
    try {
      if (this.host.hasPointerCapture(event.pointerId)) {
        this.host.releasePointerCapture(event.pointerId);
      }
    } catch {

    }

    if (wasCommitted) {
      this.clickBlockUntil = performance.now() + 140;
      if (spun >= 0) {
        this.beginSpinReset(spun);
        this.scrollVel = 0;
      }
    }
  };

  private onPointerCancel = (event: PointerEvent) => {
    this.onPointerUp(event);
    this.scrollVel = 0;
    this.pointerInside = false;
    this.hoverIndex = -1;
  };

  private resize() {
    const { clientWidth, clientHeight } = this.host;
    if (!clientWidth || !clientHeight) return;
    const dpr = Math.min(window.devicePixelRatio || 1, W.maxDpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();

    if (this.preload.active) this.start();
  }

  private start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.tick();
  }

  private stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private tick = (time = performance.now()) => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    const rawDt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const dt = Math.min(0.05, rawDt || 1 / 60);
    const frameScale = Math.min(3, dt * 60);
    const count = this.films.length;
    const max = count - 1;

    if (!this.pointerDown && !this.isSnapTweening()) {
      if (Math.abs(this.scrollVel) > 1e-5) {
        this.scroll += this.scrollVel * frameScale;
        this.scrollVel *= W.friction ** frameScale;
        if (Math.abs(this.scrollVel) < 4e-4) this.scrollVel = 0;
      }
      if (Math.abs(this.scrollVel) < 1e-5) {
        const snapped = Math.round(this.scroll);
        const err = snapped - this.scroll;
        if (err !== 0 || Math.abs(this.settleVel) > 1e-5) {
          this.settleVel += err * W.snapFreq * W.snapFreq * dt;
          this.settleVel *= Math.exp(-W.snapDamping * dt);
          this.scroll += this.settleVel * dt;
          if (Math.abs(err) < 8e-4 && Math.abs(this.settleVel) < 0.004) {
            this.scroll = snapped;
            this.settleVel = 0;
          }
        }
      }
    }

    this.scroll = clamp(this.scroll, 0, max);

    {
      const instant = clamp(
        (this.scroll - this.prevScroll) / Math.max(dt, 0.001),
        -40,
        40,
      );
      this.prevScroll = this.scroll;
      const blend = Math.abs(instant) > Math.abs(this.flow) ? 14 : 6;
      this.flow += (instant - this.flow) * Math.min(1, dt * blend);
      if (Math.abs(this.flow) < 0.01) this.flow = 0;
    }

    this.emitIndex();

    const lean = clamp(
      Math.sign(this.flow) * Math.sqrt(Math.abs(this.flow)) * W.flowLean,
      -W.flowLeanMax,
      W.flowLeanMax,
    );
    const dip = Math.min(W.flowDipMax, Math.abs(this.flow) * W.flowDip);
    const activeIndex = clamp(Math.round(this.scroll), 0, max);
    if (!this.flightLocked) void this.loadTextureWindow(activeIndex);

    const followRate = this.dragCommitted ? W.followTight : W.followBase;
    const depthBase = Math.max(W.discThickness * 3, 0.12, W.depthGap);

    if (this.pointerInside && this.finePointer && !this.pointerDown) {
      const next = this.pickHoverIndex();
      if (next !== this.hoverIndex) {
        if (next >= 0) this.applyWipeImpulse(next);
        this.hoverIndex = next;
      }
    }

    this.discs.forEach((disc) => {
      const offset = disc.index - this.scroll;
      const abs = Math.abs(offset);
      const isActive = disc.index === activeIndex;
      // Original open arc: a bounded visible window prevents repeated turns
      // from crossing when the recording collection grows.
      const angle = offset * W.angleStep;
      let x = Math.sin(angle) * W.hGap * W.hGapMul;
      let y = (isActive ? W.activeDiscY : 0) - dip * (isActive ? 0.7 : 1);
      let z = -Math.cos(angle) * depthBase * W.depthMul + depthBase * W.depthMul;
      let rotX = 0;
      let rotY = -angle + lean * (isActive ? 1 : 1.12);
      let rotZ = -lean * W.flowBank * (isActive ? 0.7 : 1);
      let scale = abs < 0.5
        ? 1
        : Math.max(W.inactiveScale, 1 - abs * (1 - W.inactiveScale) * 0.6);
      const distance = clamp(abs / W.renderRadius, 0, 1);
      const opacity = 1 - distance * distance * 0.85;
      disc.spin.children.forEach(child => {
        if (!(child instanceof THREE.Mesh) || child.userData.discIndex !== undefined && child !== disc.front) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(material => {
          material.transparent = true;
          material.opacity = opacity;
        });
      });

      let flightVisible = true;
      if (isActive) {
        scale *= this.flight.active;
      } else {
        const others = clamp(this.flight.others, 0, 2);
        const inbound = this.flight.inbound;
        const stagger = clamp(
          inbound ? W.flightStaggerIn : W.flightStagger,
          0,
          0.9,
        );
        const staggerMax = Math.max(1, Math.round(W.flightStaggerMax));
        const delay = (Math.min(abs, staggerMax) / staggerMax) * stagger;
        const span = Math.max(0.1, 1 - stagger);
        const raw = clamp((Math.min(1, others) - delay) / span, 0, 1);
        const eased = inbound
          ?
            1 - (1 - raw) ** 3
          : raw * (2 - raw);
        const progress = eased + Math.max(0, others - 1);
        const pop = clamp(
          inbound ? W.flightPopScaleIn : W.flightPopScale,
          0,
          0.9,
        );
        flightVisible = progress > pop;
        scale *= progress;
        const recede = 1 - Math.min(1, progress);
        if (recede > 1e-4) z -= recede * W.flightRecede;
      }

      const wantHover =
        this.hoverIndex === disc.index && this.spinDiscIndex < 0 ? 1 : 0;
      disc.hover += (wantHover - disc.hover) * Math.min(1, dt * 10);
      if (disc.hover > 0.001) {
        rotX += disc.hover * W.hoverTiltStrength * this.pointerNdc.y;
        rotY += disc.hover * W.hoverTiltStrength * this.pointerNdc.x;
      }

      const pushMag =
        Math.abs(disc.pushX) +
        Math.abs(disc.pushY) +
        Math.abs(disc.pushZ) +
        Math.abs(disc.pushVX) +
        Math.abs(disc.pushVY) +
        Math.abs(disc.pushVZ) +
        Math.abs(disc.pushRotX) +
        Math.abs(disc.pushRotY) +
        Math.abs(disc.pushRotVX) +
        Math.abs(disc.pushRotVY);
      if (pushMag > 8e-4) {
        const damp = Math.exp(-W.pushDamping * dt);
        const ret = Math.min(1, dt * W.pushReturn);
        disc.pushX += disc.pushVX * dt;
        disc.pushVX *= damp;
        disc.pushY += disc.pushVY * dt;
        disc.pushVY *= damp;
        disc.pushZ += disc.pushVZ * dt;
        disc.pushVZ *= damp;
        disc.pushRotX += disc.pushRotVX * dt;
        disc.pushRotVX *= damp;
        disc.pushRotY += disc.pushRotVY * dt;
        disc.pushRotVY *= damp;
        disc.pushX -= disc.pushX * ret;
        disc.pushY -= disc.pushY * ret;
        disc.pushZ -= disc.pushZ * ret;
        disc.pushRotX -= disc.pushRotX * ret;
        disc.pushRotY -= disc.pushRotY * ret;
        x += disc.pushX;
        y += disc.pushY;
        z += disc.pushZ;

      } else if (pushMag > 0) {
        disc.pushX = disc.pushY = disc.pushZ = 0;
        disc.pushVX = disc.pushVY = disc.pushVZ = 0;
        disc.pushRotX = disc.pushRotY = 0;
        disc.pushRotVX = disc.pushRotVY = 0;
      }

      if (this.preload.active && isActive) {
        const rise = this.riseOffset(this.preload.rise, this.riseScratch);
        x += rise.x;
        y += rise.y;
        z += rise.z;
      }

      const follow = clamp(
        followRate - abs * W.followFalloff,
        W.followMin,
        W.followTight,
      );
      const alpha = this.flightLocked ? 1 : Math.min(1, dt * follow);

      disc.group.visible =
        flightVisible && abs <= W.renderRadius + 0.5;
      disc.group.position.x += (x - disc.group.position.x) * alpha;
      disc.group.position.y += (y - disc.group.position.y) * alpha;
      disc.group.position.z += (z - disc.group.position.z) * alpha;
      disc.group.rotation.x += (rotX - disc.group.rotation.x) * alpha;
      disc.group.rotation.y += (rotY - disc.group.rotation.y) * alpha;
      disc.group.rotation.z += (rotZ - disc.group.rotation.z) * alpha;
      const nextScale =
        disc.group.scale.x + (scale - disc.group.scale.x) * alpha;
      disc.group.scale.setScalar(Math.max(0.001, nextScale));

      if (
        !this.flightLocked &&
        this.spinDiscIndex !== disc.index &&
        !(this.spinReset && this.spinReset.index === disc.index)
      ) {
        disc.spinX += (0 - disc.spinX) * Math.min(1, dt * 2.5);
        disc.spinY += ((disc.group.userData.flipY || 0) - disc.spinY) * Math.min(1, dt * 2.5);
      }
      disc.spin.rotation.x = disc.spinX + disc.pushRotX;
      disc.spin.rotation.y = disc.spinY + disc.pushRotY;
      disc.spin.rotation.z = disc.spinZ;
    });

    if (this.spinReset) {
      const { index, fromX, fromY, t0 } = this.spinReset;
      const disc = this.discs[index];
      const u = clamp((time - t0) / (W.resetDuration * 1000), 0, 1);
      const eased = 1 - (1 - u) ** 3;
      if (disc) {
        disc.spinX = fromX * (1 - eased);
        const restY = disc.group.userData.flipY || 0;
        disc.spinY = fromY + (restY - fromY) * eased;
        disc.spin.rotation.x = disc.spinX + disc.pushRotX;
        disc.spin.rotation.y = disc.spinY + disc.pushRotY;
      }
      if (u >= 1) {
        if (disc) {
          disc.spinX = 0;
          disc.spinY = disc.group.userData.flipY || 0;
        }
        this.spinReset = null;
      }
    }

    this.tickScribble(time, dt);

    this.renderer.render(this.scene, this.camera);
  };

  destroy() {
    this.destroyed = true;
    this.stop();
    this.abortWheelGesture();
    this.snapTween?.kill();
    this.snapTween = null;
    this.preload.tween?.kill();
    this.preload.tween = null;
    this.preload.active = false;
    this.preload.floorY = null;
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    window.removeEventListener("wheel", this.wheelHandler, { capture: true });
    this.host.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerHoverMove);
    window.removeEventListener("pointermove", this.onPointerDragMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerCancel);
    this.host.removeEventListener("click", this.onDiscClick);

    this.discs.forEach((disc) => {
      disc.frontMaterial.map = null;
      disc.frontMaterial.dispose();
      disc.backMaterial.dispose();
      disc.spin.children.forEach(child => {
        if (child instanceof THREE.Mesh && child !== disc.front && child.material !== disc.backMaterial && child.material !== this.shared.pickMaterial) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(material => material.dispose());
        }
      });
      this.gallery.remove(disc.group);
    });
    this.discs = [];
    this.pickMeshes = [];
    this.textureCache.forEach((texture) => texture.dispose());
    this.textureCache.clear();
    gsap.killTweensOf(this.flightProxy);

    this.gallery.remove(this.scribbleGroup);
    this.scribbleGeometries.forEach((geometry) => geometry.dispose());
    this.scribbleGeometries = [];
    this.scribbleMaterial?.dispose();
    this.scribbleMaterial = null;

    Object.values(this.shared).forEach((value) => {
      if (!value) return;
      if ("dispose" in value) value.dispose();
    });
    this.shared.matrixTexture?.dispose();
    this.shared.frontRoughnessMap?.dispose();

    this.iblTarget?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    delete (this.host as HTMLElement & { discGalleryPreloader?: GalleryPreloader })
      .discGalleryPreloader;
  }
}

export function createDiscEngine(
  host: HTMLElement,
  onIndexChange?: (index: number) => void,
  onReady?: () => void,
  onScrollingChange?: (scrolling: boolean) => void,
  onOpenFilm?: (film: DiscItem, event: MouseEvent) => void,
  extras?: {
    preload?: boolean;
    singleDisc?: boolean;
    films?: DiscItem[];
    onRevealCopy?: () => void;
  },
) {
  return new DiscEngine({
    host,
    onIndexChange,
    onReady,
    onScrollingChange,
    onOpenFilm,
    preload: extras?.preload,
    singleDisc: extras?.singleDisc,
    films: extras?.films,
    onRevealCopy: extras?.onRevealCopy,
  });
}
