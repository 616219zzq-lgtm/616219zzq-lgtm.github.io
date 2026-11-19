import { useEffect, useMemo, useRef, useState } from "react";
import { buildVoiceCatalog, VOICE_TOPICS } from "./data";
import { createDiscEngine, type DiscEngine } from "./discEngine";
import { startDiscPreloader } from "./preloaderEngine";
import "./gallery.scss";

function readSavedVoices(): Array<Record<string, unknown>> {
  try {
    const saved = JSON.parse(localStorage.getItem("xiangyin-public-voices-v1") || "[]");
    return Array.isArray(saved) ? saved.filter(v => v?.hasAudio) : [];
  } catch { return []; }
}

export default function GalleryView() {
  const embedded = new URLSearchParams(location.search).has("embedded");
  const [canSaveCard, setCanSaveCard] = useState(() => embedded && new URLSearchParams(location.search).get("canSaveCard") === "1");
  const [voices, setVoices] = useState(readSavedVoices);
  const [topic, setTopic] = useState(() => new URLSearchParams(location.search).get("topic") || "all");
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [entering, setEntering] = useState(true);
  const [scrolling, setScrolling] = useState(false);
  const [entry, setEntry] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [status, setStatus] = useState("");
  const focusVoice = useRef(new URLSearchParams(location.search).get("focusVoice"));
  const focusing = useRef(false);
  const [joinedVoice, setJoinedVoice] = useState<string | null>(null);
  const [muted, setMuted] = useState(() => localStorage.getItem("xiangyin-audio-enabled") === "false");
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<DiscEngine | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const request = useRef(0);
  const allOrder = useMemo(() => {
    const ranks = new Map<string, number>();
    return { rank(slug: string) {
      if (!ranks.has(slug)) ranks.set(slug, Math.random());
      return ranks.get(slug)!;
    } };
  }, [entry]);
  const films = useMemo(() => {
    const catalog = buildVoiceCatalog(voices, topic);
    catalog.forEach(item => allOrder.rank(item.slug));
    return topic === "all" ? catalog.sort((a, b) => allOrder.rank(a.slug) - allOrder.rank(b.slug)) : catalog;
  }, [voices, topic, allOrder]);
  const film = films[index] || films[0];
  const currentRecording = film?.recording;

  function stop() {
    request.current++;
    engine.current?.setPlayingVoice(null);
    audio.current?.pause(); audio.current = null;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = null;
  }
  function navigate(screen: string) {
    stop();
    if (embedded) parent.postMessage("gallery:" + screen, location.origin);
    else location.href = screen === "map" ? "/?screen=10&from=gallery" : screen === "record" ? "/?screen=1" : "/";
  }
  async function play(recording = currentRecording) {
    stop();
    if (!recording) { setStatus(""); return; }
    if (muted) { setStatus("请先开启声音"); return; }
    const version = request.current;
    setStatus("正在读取原声…");
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("xiangyin-audio", 1);
        req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("recordings")) req.result.createObjectStore("recordings"); };
        req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
      });
      const blob = await new Promise<Blob | undefined>((resolve, reject) => {
        const req = db.transaction("recordings").objectStore("recordings").get(String(recording.recordingId || recording.id));
        req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
      });
      db.close();
      if (version !== request.current) return;
      if (!blob) throw new Error("这张唱片的原声读取失败，请重试。");
      audioUrl.current = URL.createObjectURL(blob);
      const player = new Audio(audioUrl.current); audio.current = player;
      player.onplaying = () => { if (version === request.current) engine.current?.setPlayingVoice(String(recording.recordingId || recording.id)); };
      player.onended = () => { if (version === request.current) { engine.current?.setPlayingVoice(null); setStatus("播放结束，再听一次或翻面看看。"); } };
      player.onerror = () => { if (version === request.current) { engine.current?.setPlayingVoice(null); setStatus("录音播放失败，请重试。"); } };
      await player.play();
      if (version === request.current) setStatus("正在播放原声");
    } catch (e) { if (version === request.current) { engine.current?.setPlayingVoice(null); setStatus(e instanceof Error ? e.message : "录音播放失败，请重试。"); } }
  }
  const playRef = useRef(play); playRef.current = play;
  useEffect(() => {
    if (!joinedVoice) return;
    const timer = window.setTimeout(() => setJoinedVoice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [joinedVoice]);
  useEffect(() => {
    const read = () => {
      const saved = readSavedVoices();
      setVoices(previous => JSON.stringify(previous) === JSON.stringify(saved) ? previous : saved);
    };
    const message = (e: MessageEvent) => {
      if (e.origin !== location.origin || (embedded && e.source !== parent)) return;
      if (e.data === "voices:updated") read();
      if (e.data === "gallery:stop") stop();
      if (e.data?.type === "gallery:show") {
        setCanSaveCard(Boolean(e.data.canSaveCard));
        focusVoice.current = typeof e.data.voiceId === "string" ? e.data.voiceId : null;
        setJoinedVoice(null);
        read();
        setTopic("all");
        setEntry(value => value + 1);
      }
    };
    read(); window.addEventListener("message", message); window.addEventListener("storage", read);
    return () => { window.removeEventListener("message", message); window.removeEventListener("storage", read); stop(); };
  }, []);
  useEffect(() => {
    if (!host.current) return;
    if (!films.length) { setReady(true); setEntering(false); setScrolling(false); setIndex(0); setStatus(""); stop(); return; }
    focusing.current = false;
    setJoinedVoice(null);
    setReady(false); setEntering(true); setIndex(0); setFlipped(false); setStatus(""); stop();
    engine.current = createDiscEngine(host.current,
      i => {
        setIndex(i); setFlipped(false); setStatus(""); stop();
        if (focusing.current && films[i]?.voiceId === focusVoice.current) {
          setJoinedVoice(focusVoice.current);
          focusing.current = false; focusVoice.current = null;
        }
      },
      () => setReady(true), moving => { setScrolling(moving); if (moving) { stop(); setJoinedVoice(null); } }, film => void playRef.current(film.recording), { preload: true, films });
    engine.current.setPlayingVoice(null);
    const cancelEntrance = startDiscPreloader(host.current, { count: films.length, onComplete: () => {
      setEntering(false);
      if (focusVoice.current) {
        focusing.current = true;
        if (!engine.current?.focusVoice(focusVoice.current)) focusing.current = false;
      }
    } });
    return () => { cancelEntrance(); engine.current?.destroy(); engine.current = null; };
  }, [films, entry]);
  function flip() {
    engine.current?.flipActive(); setFlipped(!flipped);
  }
  return <div className="dg-page voice-gallery" data-entering={entering}>
    <nav className="voice-nav" aria-label="声音墙导航">
      <button onClick={() => navigate("home")}>乡音 · 返回首页</button>
      <div>{canSaveCard && <button className="voice-save-card" onClick={() => navigate("keepsake")}>保存我的声音卡片</button>}<button onClick={() => navigate("record")}>我也来录一段</button><button onClick={() => navigate("map")}>按地区看</button>
      <button onClick={() => { const next = !muted; setMuted(next); localStorage.setItem("xiangyin-audio-enabled", String(!next)); if (next) stop(); }}>{muted ? "声音已关闭" : "声音已开启"}</button></div>
    </nav>
    <div className="voice-stage">
    <div className="voice-topics" role="group" aria-label="话题筛选"><button aria-pressed={topic === "all"} onClick={() => { stop(); setTopic("all"); }}>全部</button>{VOICE_TOPICS.map(t => <button key={t.id} aria-pressed={topic === t.id} onClick={() => { stop(); setTopic(t.id); }}>{t.name}</button>)}</div>
    <main className="dg-main"><div className="dg-experience" ref={host}>
      {!ready && film && <img className="dg-fallback" src={flipped ? film.backDisc : film.disc} alt="唱片预览" />}
    </div></main>
      {joinedVoice && film?.voiceId === joinedVoice && !entering && !scrolling && <div className="voice-joined" role="status"><span aria-hidden="true">✓</span>你的专属声音已加入</div>}
      {film ? <div className="voice-panel">
        <span className="voice-eyebrow">{film.voiceTopic} · {String(index + 1).padStart(2, "0")} / {films.length}</span>
        <h1>猜猜这是哪里的方言？</h1>
        <p className="voice-phrase">“{film.voicePhrase}”</p>
        <div className="voice-controls">
          <button disabled={entering || scrolling} onClick={() => void play()}>▶ 播放原声</button>
          <button disabled={entering || scrolling} onClick={flip}>{flipped ? "翻回正面" : "翻面看看"}</button>
        </div>
        <p className="voice-status" role="status">{status}</p>
      </div> : <div className="voice-panel voice-empty"><span className="voice-eyebrow">0 张唱片</span><h1>留下第一张乡音唱片</h1><p>录下一句家乡话，加入这个话题吧。</p><div className="voice-controls"><button onClick={() => navigate("record")}>我也来录一段</button></div></div>}
    </div>
  </div>;
}
