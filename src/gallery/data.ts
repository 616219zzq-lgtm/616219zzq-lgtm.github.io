import recordCatalog from "../../record-catalog.json";
export type FilmReview = {
  source: string;
  quote: string;
  rating: number;
};

export type FilmAward = {
  title: string;
  org: string;
};

export type DiscItem = {
  slug: string;
  title: string;
  director: string;
  writtenBy: string[];
  year: string;
  genre: string;
  languages: string;
  runtime: string;
  starring: string[];
  disc: string;
  backDisc?: string;
  dialectId?: string;
  recording?: Record<string, unknown>;
  trailer: string;
  vector: string;
  tagline: string;
  synopsis: string;
  awards: FilmAward[];
  reviews: FilmReview[];
  watchOnline: string;
  bluRay: string;
  trailerYoutube: string;
  voiceId?: string;
  voicePhrase?: string;
  voiceLabel?: string;
  voiceTopic?: string;
  voiceKind?: "recording" | "sample";
};

export const PAGE_BG = "#f2f2f2";
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`;
export const NOISE_TEXTURE = `${ASSET_BASE}noise.avif`;

function pImage(filename: string) {
  return `${ASSET_BASE}stills/${encodeURIComponent(filename)}`;
}

export function itemDetailPath(slug: string) {
  return `/${slug}`;
}

export function findItemBySlug(slug: string): DiscItem | undefined {
  return DISC_ITEMS.find((film) => film.slug === slug);
}

export const DISC_ITEMS: DiscItem[] = [
  {
    slug: "laura-pin",
    title: "Laura Pin",
    director: "Laura Pin",
    writtenBy: ["Studio"],
    year: "2025",
    genre: "Fashion, Surreal Photography",
    languages: "—",
    runtime: "Still",
    starring: ["Editorial Series", "Soft Sculpture"],
    disc: `${ASSET_BASE}discs/laura-pin.webp`,
    trailer: pImage("Laura Pin.jpg"),
    vector: pImage("Laura Pin.jpg"),
    tagline: "Grow quiet among the spheres",
    synopsis:
      "A solitary figure stands inside a field of moss-green orbs — equal parts fashion editorial and soft sci-fi dream. The series treats the body as a calm axis while the landscape keeps rearranging around it.",
    awards: [{ title: "EDITORIAL SERIES", org: "STUDIO SELECT" }],
    watchOnline: "",
    bluRay: "",
    trailerYoutube: "",
    reviews: [
      { source: "It's Nice That", quote: "Quietly Unsettling Beauty", rating: 5.0 },
      { source: "Wallpaper*", quote: "Sculpture Meets Couture", rating: 4.5 },
    ],
  },
  {
    slug: "space-hitchhiker",
    title: "Space Hitchhiker",
    director: "Space Hitchhiker",
    writtenBy: ["Studio"],
    year: "2024",
    genre: "Portrait, Illustration",
    languages: "—",
    runtime: "Still",
    starring: ["Character Design", "Color Study"],
    disc: `${ASSET_BASE}discs/space-hitchhiker.webp`,
    trailer: pImage("Space_hitchhiker.jpg"),
    vector: pImage("Space_hitchhiker.jpg"),
    tagline: "Thumb out for the next galaxy",
    synopsis:
      "A hyper-saturated portrait of a traveler mid-route — yellow hair, red frames, floral knit against a candy-blue sky. Pop-art swagger with a hitchhiker’s patience.",
    awards: [],
    watchOnline: "",
    bluRay: "",
    trailerYoutube: "",
    reviews: [
      { source: "Juxtapoz", quote: "Electric And Unapologetic", rating: 5.0 },
      { source: "Colossal", quote: "A Postcard From Elsewhere", rating: 4.5 },
    ],
  },
  {
    slug: "funny-pinns",
    title: "Funny Pinns",
    director: "Funny Pinns",
    writtenBy: ["Studio"],
    year: "2025",
    genre: "Illustration, Motion Design",
    languages: "—",
    runtime: "Still",
    starring: ["City Chase", "Character Art"],
    disc: `${ASSET_BASE}discs/funny-pinns.webp`,
    trailer: pImage("FunnyPinns.jpg"),
    vector: pImage("FunnyPinns.jpg"),
    tagline: "Nobody waits at the light",
    synopsis:
      "A rider cuts through a stacked neon city — goggles down, jacket clipped with checkered speed marks. Built like a keyframe from a night chase that never quite ends.",
    awards: [],
    watchOnline: "",
    bluRay: "",
    trailerYoutube: "",
    reviews: [
      { source: "Motionographer", quote: "Velocity You Can Feel", rating: 4.5 },
      { source: "Hypebeast", quote: "Street Energy In Clean Lines", rating: 4.5 },
    ],
  },
  {
    slug: "reality-cache",
    title: "Reality Cache",
    director: "Reality Cache",
    writtenBy: ["Studio"],
    year: "2025",
    genre: "3D, Environment Art",
    languages: "—",
    runtime: "Still",
    starring: ["World Build", "Look Development"],
    disc: `${ASSET_BASE}discs/reality-cache.webp`,
    trailer: pImage("RealityCache.jpg"),
    vector: pImage("RealityCache.jpg"),
    tagline: "Follow the path until it forgets you",
    synopsis:
      "A candy-desert valley where pink dunes and yellow pillars hold a winding trail. The environment feels cached from a dream — soft geometry, loud color, no exit signs.",
    awards: [{ title: "ENVIRONMENT", org: "STUDIO SELECT" }],
    watchOnline: "",
    bluRay: "",
    trailerYoutube: "",
    reviews: [
      { source: "ArtStation Daily", quote: "A World You Want To Live In", rating: 5.0 },
      { source: "DesignBoom", quote: "Surrealism With Soft Edges", rating: 4.5 },
    ],
  },
  {
    slug: "axaxavanna",
    title: "Axaxavanna",
    director: "Axaxavanna",
    writtenBy: ["Studio"],
    year: "2024",
    genre: "3D Character, Art Toy",
    languages: "—",
    runtime: "Still",
    starring: ["Creature Design", "Material Study"],
    disc: `${ASSET_BASE}discs/axaxavanna.webp`,
    trailer: pImage("axaxavanna.jpg"),
    vector: pImage("axaxavanna.jpg"),
    tagline: "Something gentle grew overnight",
    synopsis:
      "A lavender flocked creature sprouts mushrooms and coral-like flora from its back — part plush, part biome. Designed as a collectible presence that feels alive even when still.",
    awards: [],
    watchOnline: "",
    bluRay: "",
    trailerYoutube: "",
    reviews: [
      { source: "Toy Report", quote: "Instant Soft Icon", rating: 5.0 },
      { source: "The Verge", quote: "Cute Without Being Simple", rating: 4.5 },
    ],
  },
  {
    slug: "manik-chavan",
    title: "Manik Chavan",
    director: "Manik Chavan",
    writtenBy: ["Studio"],
    year: "2025",
    genre: "Illustration, Narrative Art",
    languages: "—",
    runtime: "Still",
    starring: ["Travel Frame", "Atmosphere"],
    disc: `${ASSET_BASE}discs/manik-chavan.webp`,
    trailer: pImage("Manik chavan.jpg"),
    vector: pImage("Manik chavan.jpg"),
    tagline: "The window keeps the summer",
    synopsis:
      "From an orange seat, the countryside unfolds through a train window — green fields, towering clouds, a quiet afternoon that refuses to end. Nostalgia framed by rivets and glass.",
    awards: [],
    watchOnline: "",
    bluRay: "",
    trailerYoutube: "",
    reviews: [
      { source: "Cartoon Brew", quote: "A Perfect Travel Still", rating: 5.0 },
      { source: "Boing Boing", quote: "Warmth In Every Cloud", rating: 4.5 },
    ],
  },
  {
    slug: "tuan-anh-bui",
    title: "Tuan Anh Bui",
    director: "Tuan Anh Bui",
    writtenBy: ["Studio"],
    year: "2025",
    genre: "3D Character, Stylized Portrait",
    languages: "—",
    runtime: "Still",
    starring: ["Character Bust", "Material Play"],
    disc: `${ASSET_BASE}discs/tuan-anh-bui.webp`,
    trailer: pImage("tuan-anh Bui.jpg"),
    vector: pImage("tuan-anh Bui.jpg"),
    tagline: "Visor down, flower on",
    synopsis:
      "A fuzzy-haired bust peers through a neon visor — pink earring, static-knit sweater, one loud bloom on the chest. Soft sculpt meets club-night color.",
    awards: [{ title: "CHARACTER STUDY", org: "STUDIO SELECT" }],
    watchOnline: "",
    bluRay: "",
    trailerYoutube: "",
    reviews: [
      { source: "ArtStation Daily", quote: "Texture You Can Almost Touch", rating: 5.0 },
      { source: "The Verge", quote: "Cute Chaos In One Bust", rating: 4.5 },
    ],
  },
  {
    slug: "amritagp",
    title: "Amritagp",
    director: "Amritagp",
    writtenBy: ["Studio"],
    year: "2024",
    genre: "Illustration, Cityscape",
    languages: "—",
    runtime: "Still",
    starring: ["Street Perspective", "Golden Hour"],
    disc: `${ASSET_BASE}discs/amritagp.webp`,
    trailer: pImage("amritagp.jpg"),
    vector: pImage("amritagp.jpg"),
    tagline: "New York keeps the light",
    synopsis:
      "A painterly canyon of brownstones and spires under a soft pink sky — traffic lights stuck on green, autumn tucked into the curb. A postcard that refuses to fade.",
    awards: [],
    watchOnline: "",
    bluRay: "",
    trailerYoutube: "",
    reviews: [
      { source: "Colossal", quote: "A City Drawn From Memory", rating: 5.0 },
      { source: "It's Nice That", quote: "Warm Light On Hard Edges", rating: 4.5 },
    ],
  },
  {
    slug: "shio",
    title: "Shio",
    director: "Shio",
    writtenBy: ["Studio"],
    year: "2024",
    genre: "Illustration, Documentary Still",
    languages: "—",
    runtime: "Still",
    starring: ["Museum Visit", "Observational Frame"],
    disc: `${ASSET_BASE}discs/shio.webp`,
    trailer: pImage("Shio.jpg"),
    vector: pImage("Shio.jpg"),
    tagline: "Two necks, one phone",
    synopsis:
      "Inside a yellow-brick gallery, a visitor lifts a phone toward twin giraffes — one living pattern, one white skeleton. London museums rendered as a quiet glance.",
    awards: [{ title: "OBSERVATIONAL SERIES", org: "STUDIO SELECT" }],
    watchOnline: "",
    bluRay: "",
    trailerYoutube: "",
    reviews: [
      { source: "Juxtapoz", quote: "Tenderness In A Hall Of Bones", rating: 5.0 },
      { source: "Wallpaper*", quote: "A Perfect Museum Pause", rating: 4.5 },
    ],
  },
  {
    slug: "revolution",
    title: "Revolution",
    director: "Revolution",
    writtenBy: ["Studio"],
    year: "2025",
    genre: "Illustration, Editorial",
    languages: "—",
    runtime: "Still",
    starring: ["Mid-Century Street", "Skyline Drive"],
    disc: `${ASSET_BASE}discs/revolution.webp`,
    trailer: pImage("Revolution.jpg"),
    vector: pImage("Revolution.jpg"),
    tagline: "United down the avenue",
    synopsis:
      "A turquoise coupe slips between tan towers toward a classic skyline — chrome wings, red seats, New Yorker swagger. Editorial motion frozen at the bumper.",
    awards: [],
    watchOnline: "",
    bluRay: "",
    trailerYoutube: "",
    reviews: [
      { source: "DesignBoom", quote: "Vintage Velocity On Paper", rating: 5.0 },
      { source: "Hypebeast", quote: "Empire State Energy", rating: 4.5 },
    ],
  },
  {
    slug: "sowsheel",
    title: "Sowsheel",
    director: "Sowsheel",
    writtenBy: ["Studio"],
    year: "2025",
    genre: "Illustration, Portrait",
    languages: "—",
    runtime: "Still",
    starring: ["Line Portrait", "Neon Edge"],
    disc: `${ASSET_BASE}discs/sowsheel.webp`,
    trailer: pImage("SowsheelChowdary.jpg"),
    vector: pImage("SowsheelChowdary.jpg"),
    tagline: "Curl the beard, keep the stare",
    synopsis:
      "A cross-hatched face framed by blue spiral hair and beard — pale eyes tilted up, neon streak behind the skull. Portraiture with comic-book voltage.",
    awards: [],
    watchOnline: "",
    bluRay: "",
    trailerYoutube: "",
    reviews: [
      { source: "Juxtapoz", quote: "Ink That Feels Alive", rating: 5.0 },
      { source: "It's Nice That", quote: "A Gaze You Remember", rating: 4.5 },
    ],
  },
  {
    slug: "plamen",
    title: "Plamen",
    director: "Plamen",
    writtenBy: ["Studio"],
    year: "2024",
    genre: "Illustration, Character Design",
    languages: "—",
    runtime: "Still",
    starring: ["Profile Study", "Pop Color"],
    disc: `${ASSET_BASE}discs/plamen.webp`,
    trailer: pImage("Plamen Jordanov.jpg"),
    vector: pImage("Plamen Jordanov.jpg"),
    tagline: "Green skin, red room",
    synopsis:
      "A green-skinned profile opens wide against flat red — orange nose, pink ear, a riot of black curls. Pop-monster energy drawn with a steady hand.",
    awards: [{ title: "CHARACTER DESIGN", org: "STUDIO SELECT" }],
    watchOnline: "",
    bluRay: "",
    trailerYoutube: "",
    reviews: [
      { source: "Colossal", quote: "Loud Color, Clean Line", rating: 5.0 },
      { source: "Boing Boing", quote: "A Creature With Personality", rating: 4.5 },
    ],
  },
];

export type DiscCatalogId = "voices";

export const WORK_FILMS: DiscItem[] = buildVoiceCatalog([]);
export const BRANDS_FILMS: DiscItem[] = [];

export const VOICE_TOPICS = recordCatalog.topics;
export const VOICE_DIALECTS = recordCatalog.dialects;
// Templates are used for the personal disc preview, before a recording is published.
export function buildArtworkCatalog(topicId = "taste"): DiscItem[] {
  const topic = recordCatalog.topics.find(t => t.id === topicId) || recordCatalog.topics[0];
  return recordCatalog.dialects.map((dialect, i) => {
    const key = topic.id + "/" + dialect.id;
    const artwork = recordCatalog.artwork[key as keyof typeof recordCatalog.artwork];
    return {
      slug: key, title: topic.prompt, director: dialect.name, writtenBy: [],
      year: String(i + 1).padStart(2, "0"), genre: topic.name, languages: dialect.name,
      runtime: "", starring: [dialect.name],
      disc: artwork.front, backDisc: artwork.back, dialectId: dialect.id,
      trailer: "", vector: "", tagline: topic.prompt, synopsis: dialect.material,
      awards: [], reviews: [], watchOnline: "", bluRay: "", trailerYoutube: "",
      voicePhrase: topic.prompt, voiceLabel: dialect.name, voiceTopic: topic.name,
      voiceKind: "sample",
    };
  });
}

export function buildVoiceCatalog(voices: Array<Record<string, unknown>>, topicId = "taste"): DiscItem[] {
  const seen = new Set<string>();
  const templates = recordCatalog.topics.flatMap(t => buildArtworkCatalog(t.id));
  const selectedTopic = recordCatalog.topics.find(t => t.id === topicId) || recordCatalog.topics[0];
  return voices.slice().reverse().flatMap(voice => {
    const id = String(voice.recordingId || voice.id || "");
    if (!voice.hasAudio || !id || seen.has(id)) return [];
    const template = templates.find(item => item.dialectId === voice.dialectId && item.voiceTopic === voice.topic);
    if (!template) return [];
    seen.add(id);
    if (topicId !== "all" && template.voiceTopic !== selectedTopic.name) return [];
    return [{ ...template, slug: "voice/" + encodeURIComponent(id), voiceId: id,
      recording: voice, runtime: "原声录音", voiceKind: "recording" as const }];
  });
}

export const DISC_CATALOGS: Record<DiscCatalogId, DiscItem[]> = { voices: buildVoiceCatalog([]) };

export function catalogIdForSlug(slug: string): DiscCatalogId {
  return "voices";
}

export function catalogFilmsForSlug(slug: string): DiscItem[] {
  return DISC_CATALOGS[catalogIdForSlug(slug)];
}

export const DISC_ENGINE = {

  cameraFOV: 40,
  cameraDistance: 4.4,
  galleryScale: 1.08,
  galleryRotX: -30,
  galleryRotY: -30,
  exposure: 0.86,
  iblIntensity: 1,
  fogNear: 7,
  fogFar: 14,
  fogColor: "#FFFFFF",

  angleStep: 0.35,
  hGap: 2.3,
  depthGap: 1,
  hGapMul: 2.4,
  depthMul: 2.4,
  activeDiscY: 0.06,
  inactiveScale: 0.8,

  discThickness: 0.01,
  edgeBevel: 1,
  edgeBleed: 0.026,
  holeSize: 0.14,
  hubSize: 0.24,
  hubMatrixWidth: 0.4,
  hubFrostedEdge: 0.54,

  frontClearcoat: 0.8,
  frontRough: 0.42,
  frontMetal: 0.48,
  texGrain: 0.59,
  texPrint: 0.35,
  texGloss: 1,
  mapResolution: 512,
  backBaseColor: "#FFFFFF",
  backRough: 0.23,
  backMetal: 1,
  backClearcoat: 0.34,
  backIridescence: 1,
  backIridIOR: 1.86,
  backIridThickness: 900,
  edgeColor: "#FFFFFF",
  edgeRoughness: 0.04,
  edgeMetalness: 0.55,
  hubColor: "#FFFFFF",
  hubTransmission: 0.68,
  hubRoughness: 0.38,
  hubIOR: 2,

  keyIntensity: 0.75,
  keyColor: "#FFF9E8",
  keyX: 3.5,
  keyY: -8,
  keyZ: 6,
  fillIntensity: 0.3,
  rimIntensity: 0.75,
  rimColor: "#499FF5",
  topStripIntensity: 1.9,
  ambientIntensity: 0.25,

  hoverTiltStrength: 0.21,
  flowLean: 0.055,
  flowLeanMax: 0.3,
  flowBank: 0.32,
  flowDip: 0.014,
  flowDipMax: 0.09,
  followBase: 11,
  followTight: 15,
  followFalloff: 1.15,
  followMin: 6.5,
  snapFreq: 9.5,
  snapDamping: 12,
  friction: 0.89,
  wipePush: 0.012,
  wipePushMax: 0.5,
  wipeSpin: 0.009,
  wipeSpinMax: 0.4,
  wipeMinSpeed: 9,
  pushDamping: 4.5,
  pushReturn: 3.4,
  pressDepth: 0.55,
  pressTilt: 1.5,

  flightRecede: 2.2,
  flightStagger: 0.45,
  flightStaggerIn: 0.28,
  flightStaggerMax: 4,
  flightPopScale: 0.35,
  flightPopScaleIn: 0.02,
  flightOutDuration: 0.5,
  flightInDuration: 0.7,
  flightBoost: 1.45,

  preloadBoost: 0.8,
  preloadGrowBy: 0.5,
  preloadSpin: 1.1,
  preloadRiseFrom: 3,
  preloadRiseDepth: 0.7,
  preloadFanDuration: 1.15,
  initialPreloadRadius: 5,

  snapDuration: 0.46,
  wheelNoiseFloor: 0.3,
  wheelStepThreshold: 6,
  wheelEventCap: 24,
  wheelEnvelopeTau: 550,
  wheelRiseFactor: 1.2,
  wheelTickGap: 34,
  wheelTickRatio: 1,
  wheelPauseGap: 130,
  wheelIdleReset: 150,
  wheelMinStepTick: 90,
  wheelMinStepFlick: 190,
  wheelSustainDelay: 480,
  wheelSustainRatio: 0.8,
  wheelKick: 2.5,

  dragSensitivity: 0.95,
  dragGallerySpan: 6,
  dragVelocitySmoothing: 0.32,
  dragMaxVelocity: 0.5,

  dragSpinScale: 0.0045,
  maxSpinAngle: 180,
  resetDuration: 1.2,
  dragStartDistance: 5,
  settleEpsilon: 0.06,
  maxDpr: 2,
  renderRadius: 5,

  scribbleEnabled: 1,
  scribbleColor: "#000000",
  scribbleFps: 10,
  scribblePoints: 24,
  scribbleJitter: 0.028,
  scribbleLoops: 2,
  scribbleLoopGap: 0.045,
  scribblePadding: 0.06,
  scribbleWidth: 0.012,
  scribbleSweep: 0.68,
  scribbleSweepJitter: 0.4,
  scribbleIn: [0.3, 0.5, 0.72] as const,
  scribbleOut: [0.72, 0.5, 0.3] as const,
  scribbleLag: 15,
};

export const PRELOADER = {
  minDuration: 2.85,
  sceneShare: 0.18,
  sceneCreep: 0.6,
  chase: 8,
  riseAfter: 0.03,
  turnBy: 0.8,
  beats: [
    { at: 0.05, after: 0.8, roll: 0.7, travel: 0.85 },
    { at: 0.5, after: 1.9, roll: 0.55, travel: 0.75 },
    { at: 0.75, after: 2.35, roll: 0.55, travel: 0.75 },
    { at: 1, after: 2.8, roll: 0.6, travel: 0.8 },
  ],
  roll: 0.6,
  rollStagger: 0.05,
  letter: 0.6,
  travel: 0.7,
  arcEnd: 1,
  navGap: 0.35,
  discGap: 0.35,
  logoAtBeat: 1,
  logoDelay: 0,
  lift: 0.3,
  pushBy: 0.7,
  pushStagger: 0.14,
  left: ["Loading..."] as const,
  right: { from: 2012, to: new Date().getFullYear() },
  yearRoll: 0.4,
  openAt: 0.3,
  open: 0.38,
  setOff: 0.45,
  exit: 0.5,
  navAfter: 0.15,
  copyAfter: 0.3,
  apiTimeout: 9000,
};

export const COPY_REVEAL = {
  settleDelay: 100,
  dragRevealCap: 500,
  outDuration: 0.4,
  outLineStagger: 0.016,
  outItemStagger: 0.016,
  outShift: -120,
  inDuration: 0.7,
  inLineStagger: 0.05,
  inItemStagger: 0.035,
  inGroupGap: 0.06,
  inShift: 120,
  heightDuration: 0.5,
  reverseSpeed: 1.6,
  pollInterval: 40,
};
