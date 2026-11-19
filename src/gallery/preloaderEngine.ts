import gsap from "gsap";
import { PRELOADER as J } from "./data";

export type DiscPreloaderApi = {
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

type HostWithApi = HTMLElement & { discGalleryPreloader?: DiscPreloaderApi };

type DrumCell = {
  cell: HTMLElement;
  shell: HTMLElement;
  inner: HTMLElement;
  kind: "drum" | "glyph";
  width: string;
  shown: boolean;
  pos: number;
};

const DRUM_TEXT = "0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0\n1\n2\n3\n4\n5\n6\n7\n8\n9";
const ROW = 5;

const now = () =>
  typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeInOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const easeTurn = (t: number) => 1 - (1 - t) ** 2.4;
const easeRise = (t: number) => 1 - (1 - t) ** 3;

export type PreloaderOptions = {
  count?: number;

  page?: "Work" | "Brands";
  onLogoReveal?: () => void;
  onNavReveal?: () => void;
  onComplete?: () => void;
};

export function startDiscPreloader(
  gallery: HTMLElement,
  options: PreloaderOptions = {},
): () => void {
  const html = document.documentElement;
  const reduced =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || typeof gsap === "undefined") {
    html.removeAttribute("data-preload");
    options.onNavReveal?.();
    options.onComplete?.();
    return () => undefined;
  }

  const existing = (
    window as Window & {
      sitePreloader?: { active: boolean; done: boolean };
    }
  ).sitePreloader;

  if (existing?.active) return () => undefined;
  if (existing?.done) {
    delete (
      window as Window & { sitePreloader?: { active: boolean; done: boolean } }
    ).sitePreloader;
  }

  const state: { active: boolean; done: boolean } = ((
    window as Window & {
      sitePreloader?: { active: boolean; done: boolean };
    }
  ).sitePreloader = { active: true, done: false });
  html.setAttribute("data-preload", "");

  const root = document.createElement("div");
  root.className = "dg-preloader";
  root.setAttribute("data-preloader", "");
  root.setAttribute("aria-hidden", "true");

  const count = document.createElement("div");
  count.className = "dg-preloader__count";

  const makeCell = (kind: "drum" | "glyph"): DrumCell => {
    const cell = document.createElement("span");
    cell.className = `dg-preloader__cell dg-preloader__cell--${kind}`;
    const shell = document.createElement("span");
    shell.className = "dg-preloader__shell";
    const inner = document.createElement("span");
    inner.className =
      kind === "drum" ? "dg-preloader__drum" : "dg-preloader__glyph";
    inner.textContent = kind === "drum" ? DRUM_TEXT : "A";
    shell.appendChild(inner);
    cell.appendChild(shell);
    count.appendChild(cell);
    return { cell, shell, inner, kind, width: "0", shown: false, pos: 0 };
  };

  const glyph = makeCell("glyph");
  const digitCount = Math.max(3, String(options.count ?? 0).length);
  const drums = Array.from({ length: digitCount }, () => makeCell("drum"));
  root.appendChild(count);

  type Side = { side: HTMLElement; inners: HTMLElement[]; shown: number };
  const makeSide = (name: "left" | "right"): Side => {
    const side = document.createElement("div");
    side.className = `dg-preloader__side dg-preloader__side--${name}`;
    root.appendChild(side);
    return { side, inners: [], shown: 0 };
  };
  const sides = { left: makeSide("left"), right: makeSide("right") };

  const pageRoot =
    gallery.closest(".dg-page") ?? document.body;
  pageRoot.appendChild(root);

  let em = Number.parseFloat(getComputedStyle(count).fontSize) || 16;
  [glyph, ...drums].forEach((cell) => {
    cell.width = `${cell.cell.getBoundingClientRect().width / em}em`;
  });
  gsap.set([glyph.cell, ...drums.slice(0, -1).map(d => d.cell)], { width: 0 });
  gsap.set(glyph.inner, { yPercent: 100 });
  gsap.set(drums[digitCount - 1].inner, { yPercent: ROW });
  drums[digitCount - 1].shown = true;

  const emPx = (value: string) => Number.parseFloat(value) * em;
  let countWidth = 0;
  const measure = () => {
    em = Number.parseFloat(getComputedStyle(count).fontSize) || em;
    const unit = emPx(drums[digitCount - 1].width);
    countWidth = Math.max(emPx(glyph.width) + unit * 2, unit * digitCount);
  };
  measure();

  let countH = count.offsetHeight;
  let countTop = count.offsetTop;
  let boundTop = countTop;
  let boundBottom = window.innerHeight - countTop;

  const layoutBounds = () => {
    measure();
    countH = count.offsetHeight || countH;
    countTop = count.offsetTop;
    boundTop = countTop;
    boundBottom = window.innerHeight - countTop;
    const nav = document
      .querySelector(".dg-nav__links")
      ?.getBoundingClientRect();
    if (!nav?.height) return;
    const gap = countH * J.navGap;
    if (nav.top < window.innerHeight / 2) {
      boundTop = Math.max(boundTop, nav.bottom + gap);
    } else {
      boundBottom = Math.min(boundBottom, nav.top - gap);
    }
  };
  layoutBounds();

  const arc = { theta: 0 };
  const push = { live: 0, rest: 0, from: null as number | null };
  const disc = {
    x: window.innerWidth / 2,
    y: window.innerHeight * 2,
    r: 0,
  };

  const offset = () => ({
    x: disc.r + countWidth / 2 + countH * J.discGap,
    y: disc.r + countH / 2 + countH * J.discGap,
  });

  const floorY = () => {
    const canvas =
      gallery.querySelector(".dg-disc-canvas") || gallery;
    const top = canvas.getBoundingClientRect().top;
    return boundBottom - countH - countH * J.discGap - top;
  };

  const placeCount = () => {
    const o = offset();
    const sx = Math.sin(arc.theta);
    const cy = Math.cos(arc.theta);
    const minX = countTop + countWidth / 2;
    const maxX = window.innerWidth - countTop - countWidth / 2;
    const minY = boundTop + countH / 2;
    const maxY = boundBottom - countH / 2;
    const x = clamp(disc.x - sx * o.x, minX, maxX);
    const y = clamp(disc.y + cy * o.y, minY, maxY);
    gsap.set(count, {
      x: x - window.innerWidth / 2,
      y: y - countTop - countH / 2,
    });
  };
  placeCount();

  let pushShells: HTMLElement[] = [];
  let pushDone = false;
  let pushStagger: number[] = [];

  const pushProgress = () => {
    if (pushDone || push.from === null) return;
    const span = push.rest - push.from;
    const t = clamp(
      (span > 0.5
        ? clamp((push.live - push.from) / span, 0, 1)
        : 1) / clamp(J.pushBy, 0.05, 1),
      0,
      1,
    );
    const remain = 1 - Math.max(0, ...pushStagger);
    pushShells.forEach((shell, i) => {
      const start = pushStagger[i] || 0;
      const local = clamp((t - start) / Math.max(0.05, remain), 0, 1);
      gsap.set(shell, { yPercent: -110 * local });
    });
    if (t >= 1) {
      pushDone = true;
      glyphsPushed = true;
      if (fanResolved) finish();
    }
  };

  const staggerFor = (cells: HTMLElement[]) => {
    const visible = cells.filter((c) => c.getBoundingClientRect().width > 0.5);
    const n = Math.max(1, visible.length - 1);
    const max = clamp(J.pushStagger, 0, 0.8);
    return cells.map((cell) => {
      const i = visible.indexOf(cell);
      return i < 0 ? 0 : (max * i) / n;
    });
  };

  let api: DiscPreloaderApi | null = null;
  let stopped = false;

  const onResize = () => {
    layoutBounds();
    if (!api || stopped) return;
    try {
      api.floor?.(floorY());
    } catch {

    }
  };
  window.addEventListener("resize", onResize, { passive: true });
  gsap.delayedCall(0.5, layoutBounds);
  gsap.delayedCall(1.2, layoutBounds);

  const rollTo = (
    cell: DrumCell,
    digit: number,
    delay = 0,
    duration = J.roll,
  ) => {
    let pos = cell.pos;
    if (pos >= 10) {
      pos -= 10;
      cell.pos = pos;
      gsap.set(cell.inner, { yPercent: -pos * ROW });
    }
    const target = digit > (pos % 10) ? digit : 10 + digit;
    cell.pos = target;
    gsap.to(cell.inner, {
      yPercent: -target * ROW,
      duration,
      ease: "power3.out",
      delay,
      overwrite: true,
    });
  };

  const showCell = (cell: DrumCell, delay = 0) => {
    if (cell.shown) return;
    cell.shown = true;
    gsap.to(cell.cell, {
      width: cell.width,
      duration: J.letter,
      ease: "power3.out",
      delay,
      overwrite: true,
    });
  };

  const hideCell = (cell: DrumCell, delay = 0) => {
    if (!cell.shown) return;
    cell.shown = false;
    gsap.to(cell.cell, {
      width: 0,
      duration: J.letter,
      ease: "power3.inOut",
      delay,
      overwrite: true,
    });
  };

  const setCountLabel = (value: string, duration = J.roll) => {
    const isA = value.startsWith("A");
    const digits = value.replace(/\D/g, "").padStart(digitCount, " ");
    count.dataset.count = value;
    if (isA) {
      showCell(glyph);
      gsap.to(glyph.inner, {
        yPercent: 0,
        duration: J.letter,
        ease: "power3.out",
        overwrite: true,
      });
    } else if (glyph.shown) {
      hideCell(glyph);
      gsap.to(glyph.inner, {
        yPercent: -100,
        duration: J.letter,
        ease: "power3.in",
        overwrite: true,
      });
    }
    drums.forEach((cell, i) => {
      const ch = digits[i];
      const stagger = drums.length - 1 - i;
      if (ch === " ") {
        hideCell(cell);
        return;
      }
      const digit = Number.parseInt(ch, 10);
      if (!cell.shown) {
        const start = Math.max(0, digit - 1);
        cell.pos = start;
        gsap.set(cell.inner, { yPercent: -start * ROW });
        showCell(cell);
        if (start === digit) return;
      }
      rollTo(cell, digit, stagger * J.rollStagger, duration);
    });
  };

  const travelBeat = (index: number) => {
    const t = (index + 1) / J.beats.length;
    gsap.to(arc, {
      theta: Math.PI * J.arcEnd * t,
      duration: J.beats[index]?.travel ?? J.travel,
      ease: "power2.inOut",
      overwrite: true,
    });
  };

  const addSideLine = (side: Side, content: string | Node) => {
    const line = document.createElement("div");
    line.className = "dg-preloader__side-line";
    const inner = document.createElement("div");
    inner.className = "dg-preloader__side-inner";
    if (typeof content === "string") inner.textContent = content;
    else inner.appendChild(content);
    line.appendChild(inner);
    side.side.appendChild(line);
    side.inners.push(inner);
    gsap.set(inner, { x: 0, y: 0, yPercent: 120 });
    return inner;
  };

  const revealSide = (side: Side, n = 1) => {
    const batch = side.inners.slice(side.shown, side.shown + n);
    if (!batch.length) return;
    side.shown += batch.length;
    gsap.to(batch, {
      yPercent: 0,
      duration: 0.7,
      ease: "power3.out",
      stagger: 0.07,
      overwrite: true,
    });
  };

  const yearState = { drums: [] as DrumCell[], value: J.right.from };
  const buildYears = () => {
    const wrap = document.createElement("span");
    wrap.className = "dg-preloader__years";
    String(J.right.from)
      .split("")
      .forEach((ch) => {
        const cell = document.createElement("span");
        cell.className = "dg-preloader__cell dg-preloader__cell--drum";
        const shell = document.createElement("span");
        shell.className = "dg-preloader__shell";
        const inner = document.createElement("span");
        inner.className = "dg-preloader__drum";
        inner.textContent = DRUM_TEXT;
        shell.appendChild(inner);
        cell.appendChild(shell);
        wrap.appendChild(cell);
        const digit = Number.parseInt(ch, 10) || 0;
        gsap.set(inner, { yPercent: -digit * ROW });
        yearState.drums.push({
          cell,
          shell,
          inner,
          kind: "drum",
          width: "0",
          shown: true,
          pos: digit,
        });
      });
    return wrap;
  };

  const rollYear = (value: number) => {
    const next = clamp(Math.round(value), J.right.from, J.right.to);
    if (next <= yearState.value) return;
    yearState.value = next;
    const padded = String(next).padStart(yearState.drums.length, "0");
    yearState.drums.forEach((cell, i) => {
      const digit = Number.parseInt(padded[i], 10);
      if (digit !== cell.pos % 10) rollTo(cell, digit, 0, J.yearRoll);
    });
  };

  const fillMeta = (meta: DiscPreloaderApi["meta"]) => {
    const page = options.page ?? "Work";
    const fill = (template: string) =>
      template
        .replace("{page}", page)
        .replace("{count}", String(meta.count || ""))
        .replace(
          "{years}",
          meta.years ? `${meta.years[0]} — ${meta.years[1]}` : "",
        )
        .replace("{title}", meta.lead?.title || "")
        .replace("{year}", String(meta.lead?.year || ""))
        .trim();

    const skip = (s: string) => /\{|^\s*titles$/.test(s);
    J.left.forEach((line) => {
      const text = fill(line);
      if (!text || skip(text)) return;
      addSideLine(sides.left, text);
    });
    if (J.right.to > J.right.from) addSideLine(sides.right, buildYears());
    revealSide(sides.left, sides.left.inners.length);
    revealSide(sides.right, sides.right.inners.length);
  };

  gsap.to(drums[2].inner, {
    yPercent: 0,
    duration: J.open,
    ease: "power4.out",
    delay: J.openAt,
  });

  let covers: number[] = [];
  let coversDone = 0;
  let progressAtApi = 0;
  let progress = 0;
  let beatIndex = 0;
  let finalRollEnds = Infinity;
  let finishing: boolean = false;
  let fanResolved: boolean = false;
  let glyphsPushed: boolean = false;
  let raf = 0;
  let lastFrame = now();
  const startedAt = now();
  let fontsReady: boolean = !document.fonts?.ready;
  document.fonts?.ready?.then(() => {
    fontsReady = true;
  });

  const loadProgress = (t: number) => {
    if (!api) {
      const creep = clamp((t - startedAt) / (J.sceneCreep * 1000), 0, 1);
      return J.sceneShare * creep;
    }
    if (!covers.length) return 1;
    return J.sceneShare + (1 - J.sceneShare) * (coversDone / covers.length);
  };

  const gatedProgress = (t: number) =>
    fontsReady ? loadProgress(t) : Math.min(loadProgress(t), 0.9);

  const tick = (t: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(tick);
    const dt = clamp((t - lastFrame) / 1000, 0, 0.1);
    lastFrame = t;
    const elapsed = (t - startedAt) / 1000;
    const timeGate = clamp(elapsed / J.minDuration, 0, 1);
    let target = Math.min(gatedProgress(t), timeGate);
    progress += (target - progress) * (1 - Math.exp(-J.chase * dt));
    if (target >= 1 && progress > 0.995) progress = 1;

    const riseStart = progressAtApi + J.riseAfter;
    const rise = clamp((progress - riseStart) / (1 - riseStart), 0, 1);
    const turn = clamp(
      (progress - riseStart) / (J.turnBy - riseStart),
      0,
      1,
    );
    api?.pose({ turn: easeTurn(turn), rise: easeRise(rise) });

    if (api) {
      try {
        const a = api.anchor();
        const canvas =
          gallery.querySelector(".dg-disc-canvas") || gallery;
        const box = canvas.getBoundingClientRect();
        disc.x = box.left + a.x;
        disc.y = box.top + a.y;
        disc.r = a.r;
        push.live = a.live ?? a.r;
        push.rest = a.rest ?? a.r;
      } catch {

      }
      if (push.from !== null) pushProgress();
    }
    placeCount();

    if (api && J.right) {
      const span = J.right.to - J.right.from;
      rollYear(
        J.right.from + Math.floor(easeInOutQuad(progress) * (span - 1) + 1e-6),
      );
    }

    const beat = J.beats[beatIndex];
    if (api && beat && progress >= beat.at && elapsed >= beat.after) {
      const total = Math.max(0, Math.floor(api.count));
      const label = String(beatIndex === J.beats.length - 1 ? total : Math.floor(total * beat.at));
      setCountLabel(label, beat.roll ?? J.roll);
      travelBeat(beatIndex);
      beatIndex += 1;
      if (beatIndex === J.beats.length) finalRollEnds = t + ((beat.roll ?? J.roll) + (digitCount - 1) * J.rollStagger) * 1000;
      if (beatIndex === J.logoAtBeat) {
        gsap.delayedCall(J.logoDelay, () => {
          if (!stopped) options.onLogoReveal?.();
        });
      }
    }

    if (progress >= 1 && beatIndex >= J.beats.length && t >= finalRollEnds && api && !finishing) {
      beginExit();
    }
  };
  raf = requestAnimationFrame(tick);

  const finish = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    root.remove();
    html.removeAttribute("data-preload");
    state.active = false;
    state.done = true;
    options.onComplete?.();

    queueMicrotask(() => {
      const cur = (
        window as Window & {
          sitePreloader?: { active: boolean; done: boolean };
        }
      ).sitePreloader;
      if (cur === state) {
        delete (
          window as Window & {
            sitePreloader?: { active: boolean; done: boolean };
          }
        ).sitePreloader;
      }
    });
  };

  const beginExit = () => {
    if (!api) return;
    finishing = true;
    state.active = false;
    const delay = Math.max(0, J.setOff);
    const shells = [glyph.shell, ...drums.map((d) => d.shell)];
    gsap.delayedCall(delay, () => {
      if (stopped) return;
      gsap.killTweensOf(shells);
      pushShells = shells;
      pushStagger = staggerFor([glyph.cell, ...drums.map((d) => d.cell)]);
      push.from = push.live;
      Promise.resolve(api!.fan())
        .catch(() => undefined)
        .then(() => {
          fanResolved = true;
          if (!glyphsPushed) {
            pushShells.forEach((s) => gsap.set(s, { yPercent: -110 }));
            glyphsPushed = true;
          }
          finish();
        });
    });
    gsap.delayedCall(delay, () => {
      if (!stopped) rollYear(J.right.to);
    });
    const sideInners = [...sides.left.inners, ...sides.right.inners];
    if (sideInners.length) {
      gsap.to(sideInners, {
        yPercent: -120,
        duration: J.exit,
        ease: "power3.in",
        delay,
        stagger: 0.04,
        overwrite: true,
      });
      gsap.to([sides.left.side, sides.right.side], {
        y: `-${J.lift * 0.6}em`,
        duration: J.exit + 0.2,
        ease: "power2.out",
        delay,
      });
    }
    gsap.delayedCall(delay + J.navAfter, () => {
      if (stopped) return;
      options.onNavReveal?.();
      html.removeAttribute("data-preload");
    });
    gsap.delayedCall(delay + J.copyAfter, () => {
      if (!stopped) api?.revealCopy?.();
    });
  };

  const waitApi = (timeout: number) =>
    new Promise<DiscPreloaderApi | null>((resolve) => {
      const deadline = now() + timeout;
      const poll = () => {
        if (stopped) { resolve(null); return; }
        const host = gallery as HostWithApi;
        if (host.discGalleryPreloader) {
          resolve(host.discGalleryPreloader);
          return;
        }
        if (now() > deadline) {
          resolve(null);
          return;
        }
        setTimeout(poll, 40);
      };
      poll();
    });

  waitApi(J.apiTimeout).then((found) => {
    if (stopped) return;
    if (!found) {
      state.active = false;
      options.onNavReveal?.();
      finish();
      const lateHost = gallery as HostWithApi;
      lateHost.discGalleryPreloader?.abort?.();
      return;
    }
    api = found;
    covers = found.covers.slice();
    progressAtApi = progress;
    const seatFloor = () => {
      if (stopped || api !== found) return;
      try {
        found.floor?.(floorY());
      } catch {

      }
    };
    seatFloor();

    requestAnimationFrame(seatFloor);
    gsap.delayedCall(0.2, seatFloor);
    gsap.delayedCall(0.6, seatFloor);
    if (found.meta) fillMeta(found.meta);
    covers.forEach((index) => {
      Promise.resolve(found.cover(index))
        .catch(() => undefined)
        .then(() => {
          coversDone += 1;
        });
    });
  });

  return () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    root.remove();
    html.removeAttribute("data-preload");
    state.active = false;
    state.done = true;
    api?.abort?.();
    delete (
      window as Window & { sitePreloader?: { active: boolean; done: boolean } }
    ).sitePreloader;
  };
}
