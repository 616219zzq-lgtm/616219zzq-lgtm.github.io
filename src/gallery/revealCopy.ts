import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { SplitText } from "gsap/SplitText";
import { COPY_REVEAL as I } from "./data";

gsap.registerPlugin(CustomEase, SplitText);

const ENERGY = (() => {
  try {
    return (
      CustomEase.get("dgEnergy") ||
      CustomEase.create("dgEnergy", "0.32, 0.72, 0, 1")
    );
  } catch {
    return "power2.out";
  }
})();

type RevealKind = "text" | "rule" | "block";

type RevealItem = {
  element: HTMLElement;
  kind: RevealKind;
  group: number;
  mask: HTMLElement | null;
  split: SplitText | null;
  lines: HTMLElement[];
  singleLine: boolean;
  restHeight: number;
  naturalHeight: number;
};

export class RevealCopy {
  private root: HTMLElement;
  private items: RevealItem[] = [];
  private state: "hidden" | "revealing" | "visible" = "hidden";
  private inTl: gsap.core.Timeline | null = null;
  private outTl: gsap.core.Timeline | null = null;
  private reduced: boolean;
  private settleTimer = 0;
  private pendingShow = false;
  private destroyed = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    this.collect();
    this.items.forEach((item) => {
      if (item.kind !== "rule") this.adoptMask(item);
    });
    this.setHiddenInstant();
  }

  destroy() {
    this.destroyed = true;
    this.clearTimers();
    this.inTl?.kill();
    this.outTl?.kill();
    this.inTl = null;
    this.outTl = null;
    this.items.forEach((item) => {
      this.revertSplit(item);
      gsap.set(item.element, { clearProps: "opacity,visibility,transform" });
    });
    this.items = [];
  }

  armIncoming() {
    if (this.destroyed) return;
    this.collect();
    this.items.forEach((item) => {
      if (item.kind !== "rule") this.adoptMask(item);
    });
    this.hideItemsInstant({ preserveHeights: true });
  }

  scheduleShow(delayMs = I.settleDelay) {
    if (this.destroyed) return;
    this.pendingShow = true;
    window.clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => {
      this.settleTimer = 0;
      if (!this.pendingShow || this.destroyed) return;
      void this.show();
    }, delayMs);
  }

  releaseForReactWrite() {
    this.inTl?.kill();
    this.outTl?.kill();
    this.inTl = null;
    this.outTl = null;
    this.items.forEach((item) => {
      this.revertSplit(item);
      if (item.kind === "rule") {
        gsap.set(item.element, {
          scaleX: 0,
          transformOrigin: "left center",
        });
      } else {
        gsap.set(item.element, { autoAlpha: 0 });
      }
    });
    this.state = "hidden";
    this.setMasksClipping(false);
  }

  hide(): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    this.pendingShow = false;
    window.clearTimeout(this.settleTimer);
    this.settleTimer = 0;

    if (this.reduced) {
      this.setHiddenInstant();
      return Promise.resolve();
    }

    if (this.state === "hidden" && !this.outTl && !this.inTl) {
      return Promise.resolve();
    }

    if (this.state === "revealing" && this.inTl) {
      const tl = this.inTl;
      this.inTl = null;
      this.outTl = tl;
      this.state = "hidden";
      return new Promise((resolve) => {
        tl.eventCallback("onComplete", null);
        tl.eventCallback("onReverseComplete", () => {
          this.finishOut();
          resolve();
        });
        tl.timeScale(I.reverseSpeed);
        tl.reverse();
      });
    }

    this.inTl?.kill();
    this.inTl = null;
    this.outTl?.kill();
    this.outTl = null;
    this.state = "hidden";
    this.lockMaskHeights();
    this.measureSingleLine(
      this.items.filter((item) => item.kind === "text" && !item.lines.length),
    );
    this.setMasksClipping(true);

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.finishOut();
          resolve();
        },
      });
      this.outTl = tl;
      this.items.forEach((item, index) => {
        const at = index * I.outItemStagger;
        if (item.kind === "rule") {
          tl.to(
            item.element,
            {
              scaleX: 0,
              transformOrigin: "right center",
              duration: I.outDuration,
              ease: ENERGY,
              overwrite: "auto",
            },
            at,
          );
          return;
        }
        if (!item.lines.length) this.prepareLines(item);
        gsap.set(item.element, { autoAlpha: 1 });
        tl.to(
          item.lines,
          {
            yPercent: I.outShift,
            duration: I.outDuration,
            ease: ENERGY,
            stagger: I.outLineStagger,
            overwrite: "auto",
          },
          at,
        );
      });
    });
  }

  async show() {
    if (this.destroyed) return;
    this.pendingShow = false;
    this.collect();
    this.items.forEach((item) => {
      if (item.kind !== "rule") this.adoptMask(item);
    });

    if (this.reduced) {
      this.setVisibleInstant();
      return;
    }

    this.inTl?.kill();
    this.inTl = null;
    this.lockMaskHeights();

    this.state = "revealing";

    this.measureSingleLine(this.items);
    this.items.forEach((item) => {
      if (item.kind === "rule") {
        gsap.set(item.element, {
          scaleX: 0,
          transformOrigin: "left center",
        });
        return;
      }
      gsap.set(item.element, { clearProps: "transform" });
      this.prepareLines(item);
      gsap.set(item.lines, { yPercent: I.inShift });
      gsap.set(item.element, { autoAlpha: 1 });
    });
    this.measureNaturalHeights();
    this.setMasksClipping(true);

    await new Promise<void>((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.finishIn();
          resolve();
        },
      });
      this.inTl = tl;

      this.maskedItems().forEach((item) => {
        const height = Number.parseFloat(item.mask!.style.height);
        if (!Number.isFinite(height)) return;
        if (Math.abs(height - item.naturalHeight) < 0.5) {
          item.mask!.style.height = "";
          return;
        }
        tl.to(
          item.mask!,
          {
            height: item.naturalHeight,
            duration: I.heightDuration,
            ease: ENERGY,
            overwrite: "auto",
          },
          0,
        );
      });

      let time = 0;
      let group = this.items[0]?.group ?? 0;
      this.items.forEach((item) => {
        if (item.group !== group) {
          group = item.group;
          time += I.inGroupGap;
        }
        if (item.kind === "rule") {
          tl.to(
            item.element,
            {
              scaleX: 1,
              duration: I.inDuration,
              ease: ENERGY,
              overwrite: "auto",
            },
            time,
          );
        } else {
          tl.to(
            item.lines,
            {
              yPercent: 0,
              duration: I.inDuration,
              ease: ENERGY,
              stagger: I.inLineStagger,
              overwrite: "auto",
            },
            time,
          );
        }
        time += I.inItemStagger;
      });
    });
  }

  private clearTimers() {
    window.clearTimeout(this.settleTimer);
    this.settleTimer = 0;
  }

  private kindOf(element: HTMLElement): RevealKind {
    const attr = element.getAttribute("data-dg-reveal");
    if (attr === "rule") return "rule";
    if (attr === "block") return "block";
    return "text";
  }

  private collect() {
    const next: RevealItem[] = [];
    const groups = [
      this.root.querySelectorAll<HTMLElement>(
        "[data-dg-reveal-group='info'] [data-dg-reveal]",
      ),
      this.root.querySelectorAll<HTMLElement>(
        "[data-dg-reveal-group='reviews'] [data-dg-reveal]",
      ),
    ];
    groups.forEach((nodes, group) => {
      nodes.forEach((element) => {
        const kind = this.kindOf(element);
        const existing = this.items.find((item) => item.element === element);
        next.push(
          existing ?? {
            element,
            kind,
            group,
            mask: null,
            split: null,
            lines: [],
            singleLine: false,
            restHeight: 0,
            naturalHeight: 0,
          },
        );
      });
    });

    this.items.forEach((item) => {
      if (!next.includes(item)) this.revertSplit(item);
    });
    this.items = next;
  }

  private adoptMask(item: RevealItem) {
    const parent = item.element.parentElement;
    if (parent?.hasAttribute("data-disc-mask")) {
      item.mask = parent;
      return;
    }
    item.mask = null;
  }

  private setMasksClipping(clip: boolean) {
    this.items.forEach((item) => {
      item.mask?.setAttribute("data-disc-mask", clip ? "clip" : "idle");
    });
  }

  private maskedItems() {
    return this.items.filter((item) => item.mask);
  }

  private cacheRestHeights() {

    this.maskedItems().forEach((item) => {
      if (!item.mask!.style.height) {
        item.restHeight = item.mask!.offsetHeight;
      }
    });
  }

  private lockMaskHeights() {

    this.cacheRestHeights();
    this.maskedItems().forEach((item) => {
      const mask = item.mask!;
      if (mask.style.height) return;
      const height = item.restHeight || mask.offsetHeight;
      mask.style.height = `${height}px`;
    });
  }

  private measureNaturalHeights() {

    const masked = this.maskedItems();
    const prev = masked.map((item) => item.mask!.style.height);
    masked.forEach((item) => {
      item.mask!.style.height = "auto";
    });
    masked.forEach((item) => {
      item.naturalHeight = item.mask!.offsetHeight;
    });
    masked.forEach((item, index) => {
      item.mask!.style.height = prev[index];
    });
  }

  private releaseMaskHeights() {
    this.maskedItems().forEach((item) => {
      item.mask!.style.height = "";
      item.restHeight = item.mask!.offsetHeight;
      item.naturalHeight = 0;
    });
  }

  private hasText(el: HTMLElement) {
    return !!(el.textContent || "").trim();
  }

  private measureSingleLine(items: RevealItem[]) {
    items.forEach((item) => {
      item.singleLine = false;
      if (item.kind !== "text") return;
      const el = item.element;
      if (!this.hasText(el) || !item.mask) return;
      if (getComputedStyle(item.mask).display === "contents") return;
      const box = el.getBoundingClientRect();
      if (!box.height) return;
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
      item.singleLine = box.height < lineHeight * 1.5;
    });
  }

  private prepareLines(item: RevealItem) {
    this.revertSplit(item);
    const el = item.element;

    if (item.kind === "block" || !this.hasText(el)) {
      item.lines = [el];
      return;
    }

    if (item.singleLine || !el.getClientRects().length) {
      item.lines = [el];
      return;
    }

    if (el.childElementCount > 0) {
      item.lines = [el];
      return;
    }

    try {
      const split = new SplitText(el, { type: "lines", linesClass: "disc-line" });
      if (!split.lines?.length) {
        split.revert();
        item.lines = [el];
        return;
      }
      split.lines.forEach((line) => {
        const mask = document.createElement("div");
        mask.setAttribute("data-disc-line-mask", "");
        line.parentNode?.insertBefore(mask, line);
        mask.appendChild(line);
      });
      item.split = split;
      item.lines = split.lines as HTMLElement[];
    } catch {
      item.lines = [el];
    }
  }

  private revertSplit(item: RevealItem) {
    const el = item.element;
    const split = item.split;
    item.split = null;
    item.lines = [];

    if (split) {
      try {
        split.revert();
      } catch {

      }
      return;
    }

    const lineMask = el.querySelector(":scope > [data-disc-line-mask]");
    if (!lineMask) return;
    const line = lineMask.firstElementChild;
    if (line) {
      while (line.firstChild) el.insertBefore(line.firstChild, lineMask);
    }
    lineMask.remove();
  }

  private hideItemsInstant(opts: { preserveHeights?: boolean } = {}) {
    this.inTl?.kill();
    this.outTl?.kill();
    this.inTl = null;
    this.outTl = null;
    this.state = "hidden";
    this.items.forEach((item) => {
      this.revertSplit(item);
      if (item.kind === "rule") {
        gsap.set(item.element, {
          scaleX: 0,
          transformOrigin: "left center",
        });
      } else {
        gsap.set(item.element, { autoAlpha: 0 });
      }
    });
    this.setMasksClipping(false);
    if (!opts.preserveHeights) this.releaseMaskHeights();
  }

  private setHiddenInstant() {
    this.hideItemsInstant({ preserveHeights: false });
  }

  private setVisibleInstant() {
    this.inTl?.kill();
    this.outTl?.kill();
    this.inTl = null;
    this.outTl = null;
    this.state = "visible";
    this.items.forEach((item) => {
      this.revertSplit(item);
      gsap.set(item.element, {
        clearProps: "opacity,visibility,transform",
      });
      if (item.kind === "rule") {
        gsap.set(item.element, { scaleX: 1 });
      }
    });
    this.setMasksClipping(false);
    this.releaseMaskHeights();
  }

  private finishOut() {
    this.outTl = null;
    this.items.forEach((item) => {
      if (item.kind === "rule") return;
      gsap.set(item.element, { autoAlpha: 0 });
      this.revertSplit(item);
      gsap.set(item.element, { clearProps: "transform" });
    });
    this.setMasksClipping(false);

  }

  private finishIn() {
    this.inTl = null;

    this.items.forEach((item) => {
      if (item.kind === "rule") return;
      if (item.lines.length) {
        gsap.set(item.lines, { clearProps: "transform" });
      }
    });
    gsap.set(
      this.items.map((item) => item.element),
      { clearProps: "opacity,visibility,transform" },
    );
    this.releaseMaskHeights();
    this.setMasksClipping(false);
    this.state = "visible";
  }
}
