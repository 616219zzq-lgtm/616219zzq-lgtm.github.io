import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  BODY_FONT,
  CAPTION_EASE,
  DROP,
  INK,
  INTERACT,
  LOOK,
  PHYSICS,
  RADIUS,
  SUBTITLE,
  SURFACE,
  TAGS,
  floorShade,
} from "./data";
import { TagPile, type PileRead } from "./engine";
import "./pile.scss";

const RING_COUNT = 4;

export default function PileView() {
  const rootRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ringRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pileRef = useRef<TagPile | null>(null);
  const [revealed, setRevealed] = useState(false);
  const tags = TAGS;  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = (): PileRead => ({
      list: tags,
      physics: PHYSICS,
      interact: INTERACT,
      drop: DROP,
      look: { shadow: LOOK.shadow, gloss: LOOK.gloss },
      onReveal: () => setRevealed(true),
      onSelect: (index) => window.parent.postMessage({ type: "dialect:selected", key: tags[index].key }, location.origin),
    });
    const pile = new TagPile(read);
    pileRef.current = pile;
    pile.root = root;
    pile.chips = chipRefs.current;
    pile.rings = ringRefs.current.map((el) => ({
      el,
      on: false,
      t: 0,
      x: 0,
      y: 0,
      k: 1,
    }));
    pile.reduced = reducedQuery.matches;
    pile.setSize(root.clientWidth, root.clientHeight);

    const measure = () =>
      chipRefs.current.map((chip) => ({
        w: chip ? chip.offsetWidth : 40,
        h: chip ? chip.offsetHeight : 40,
      }));

    pile.load(measure());
    let alive = true;
    document.fonts?.ready?.then(() => {
      if (alive) pile.refit(measure());
    });

    let visible = false;
    let pageVisible = !document.hidden;
    const syncPermit = () => {
      const enabled = visible && pageVisible && root.clientWidth > 0 && root.clientHeight > 0;
      if (enabled) {
        pile.setSize(root.clientWidth, root.clientHeight);
        pile.refit(measure());
      }
      pile.setPermit(enabled);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) visible = entry.isIntersecting;
      syncPermit();
    });
    observer.observe(root);

    const onVisibility = () => {
      pageVisible = !document.hidden;
      syncPermit();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onReduce = () => {
      pile.reduced = reducedQuery.matches;
    };
    reducedQuery.addEventListener("change", onReduce);

    const resize = new ResizeObserver(() => {
      if (!root.clientWidth || !root.clientHeight) return;
      pile.setSize(root.clientWidth, root.clientHeight);
      pile.refit(measure());
      pile.rouseAll();
      pile.wake();
    });
    resize.observe(root);

    const down = (event: PointerEvent) => pile.down(event);
    const move = (event: PointerEvent) => pile.move(event);
    const up = (event: PointerEvent) => pile.up(event);
    const leave = () => pile.leave();
    const drag = (event: DragEvent) => event.preventDefault();
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", up);
    root.addEventListener("pointerleave", leave);
    root.addEventListener("dragstart", drag);

    return () => {
      alive = false;
      pileRef.current = null;
      observer.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reducedQuery.removeEventListener("change", onReduce);
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", up);
      root.removeEventListener("pointerleave", leave);
      root.removeEventListener("dragstart", drag);
      pile.setPermit(false);
      pile.root = null;
    };
  }, []);

  return (    <div className="gtp-page">
      <div
        ref={rootRef}
        className="gtp-stage"
        style={{ backgroundColor: SURFACE, borderRadius: RADIUS }}
      >
        <div className="gtp-shade"

        />
        <div className="gtp-caption" style={captionStyle(revealed)}>
          {SUBTITLE}
        </div>
        {tags.map((tag, index) => (
          <div
            key={tag.label}
            ref={(node) => {
              chipRefs.current[index] = node;
            }}
            className="gtp-chip gtp-chip--image"
            data-tag-index={index}
            tabIndex={0}
            role="button"
            aria-label={tag.label}
            style={{ color: tag.ink }}
            onFocus={() => pileRef.current?.setFocus(index)}
            onBlur={() => pileRef.current?.setFocus(-1)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                window.parent.postMessage({ type: "dialect:selected", key: tag.key }, location.origin);
              } else if (pileRef.current?.key(index, event.key)) event.preventDefault();
            }}
          >
            <img src={tag.imageUrl} alt={tag.label} draggable={false} />
          </div>
        ))}
        {Array.from({ length: RING_COUNT }, (_, index) => (
          <div
            key={index}
            ref={(node) => {
              ringRefs.current[index] = node;
            }}
            className="gtp-ring"
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

function captionStyle(revealed: boolean): CSSProperties {
  const shown = revealed ? 1 : 0;
  const base: CSSProperties = {
    fontWeight: BODY_FONT.fontWeight,
    fontSize: BODY_FONT.fontSize,
    letterSpacing: BODY_FONT.letterSpacing,
    lineHeight: BODY_FONT.lineHeight,
  };
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return { ...base, opacity: shown };
  }
  return {
    ...base,
    opacity: shown,
    transform: revealed ? "translateY(0)" : "translateY(0.45em)",
    filter: revealed ? "blur(0px)" : "blur(6px)",
    transition: `opacity .9s ${CAPTION_EASE} .22s, transform .9s ${CAPTION_EASE} .22s, filter .9s ${CAPTION_EASE} .22s`,
  };
}
