import { useEffect, useRef, useState } from "react";
import { buildArtworkCatalog } from "./data";
import { createDiscEngine } from "./discEngine";
import "./gallery.scss";

export default function DiscPreview() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [back, setBack] = useState(false);
  const params = new URLSearchParams(location.search);
  const film = buildArtworkCatalog(params.get("topic") || "taste").find(f => f.dialectId === params.get("dialect"));

  useEffect(() => {
    if (!host.current || !film) return;
    let flipped = false;
    let loaded = false;
    let wantedBack = false;
    const syncSide = () => {
      if (!loaded || flipped === wantedBack) return;
      engine.flipActive();
      flipped = wantedBack;
      setBack(flipped);
    };
    const engine = createDiscEngine(host.current, undefined, () => {
      loaded = true;
      setReady(true);
      syncSide();
      parent.postMessage("preview:ready", location.origin);
    }, undefined, () => parent.postMessage("preview:play", location.origin), {
      preload: false, films: [film], singleDisc: true,
    });
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== parent || event.data?.type !== "preview:side") return;
      wantedBack = Boolean(event.data.back);
      syncSide();
    };
    window.addEventListener("message", receive);
    return () => { window.removeEventListener("message", receive); engine.destroy(); };
  }, [film?.slug]);

  return <div className="disc-preview" ref={host} aria-label="我的乡音唱片，可拖动旋转，点击试听">
    {!ready && film && <img src={back ? film.backDisc : film.disc} alt="我的乡音唱片" />}
  </div>;
}
