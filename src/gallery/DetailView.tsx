import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  NOISE_TEXTURE,
  catalogFilmsForSlug,
  catalogIdForSlug,
  findItemBySlug,
  itemDetailPath,
  type DiscItem,
} from "./data";
import { initDissolve } from "./dissolveEngine";
import { initScrollNext } from "./scrollNextEngine";
import "./gallery.scss";

function injectFonts() {
  const styleId = "dg-fonts";
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @font-face {
      font-family: "PP Neue Montreal";
      src: url("/assets/fonts/PPNeueMontreal-Medium.woff2") format("woff2");
      font-weight: 500;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "PP Eiko";
      src: url("/assets/fonts/PPEiko-Regular.woff2") format("woff2");
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: "PP Museum";
      src: url("/assets/fonts/PPMuseum-Regular.woff2") format("woff2");
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
  `;
  document.head.appendChild(style);
}

function StudioLogo() {
  return (
    <span className="dg-logo" aria-label="Studio">
      dg&apos;
    </span>
  );
}

function PlusMark({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  return (
    <div className={`dg-plus is--${corner}`} aria-hidden="true">
      <div className="dg-plus-stroke is--hor" />
      <div className="dg-plus-stroke is--ver" />
    </div>
  );
}

function DetailBtn({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const external = href.startsWith("http");
  if (!href) return null;
  return (
    <a
      className="dg-btn"
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      <div className="dg-btn__divider" />
      <span className="dg-btn__mask">
        <span className="dg-btn__label">{label}</span>
      </span>
      <div className="dg-btn__divider" />
    </a>
  );
}

function CreditNames({ names }: { names: string[] }) {
  return (
    <div className="dg-credits-list">
      {names.map((name, index) => (
        <p key={name} className="dg-p-m">
          {name}
          {index < names.length - 1 ? "," : ""}
        </p>
      ))}
    </div>
  );
}

function nextInCatalog(current: DiscItem): DiscItem {
  const catalog = catalogFilmsForSlug(current.slug);
  const index = catalog.findIndex((film) => film.slug === current.slug);
  return catalog[(index + 1) % catalog.length] ?? catalog[0];
}

function quotePlacements(tagline: string) {
  const words = tagline.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return [{ text: tagline, x: 50, row: 0 }];
  }

  const slots = [
    { x: 66, row: 0 },
    { x: 4, row: 1 },
    { x: 84, row: 2 },
    { x: 32, row: 3 },
    { x: 55, row: 4 },
  ];

  if (words.length === 5 && words[2] === "it" && words[3] === "in") {
    return [
      { text: words[0], x: 66, row: 0 },
      { text: words[1], x: 4, row: 1 },
      { text: `${words[2]} ${words[3]}`, x: 84, row: 2 },
      { text: words[4], x: 32, row: 3 },
    ];
  }
  return words.map((text, index) => ({
    text,
    ...(slots[index % slots.length] ?? { x: 50, row: index % 5 }),
  }));
}

export default function DetailView() {
  const { slug = "" } = useParams<{ slug: string }>();
  const film = findItemBySlug(slug);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollNextRef = useRef<HTMLElement>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [navOnDark, setNavOnDark] = useState(false);

  const next = useMemo(() => (film ? nextInCatalog(film) : null), [film]);
  const catalogId = film ? catalogIdForSlug(film.slug) : "work";
  const catalogFilms = film ? catalogFilmsForSlug(film.slug) : [];
  const navigate = useNavigate();
  const quoteBits = useMemo(
    () => (film ? quotePlacements(film.tagline) : []),
    [film],
  );
  const directors = useMemo(
    () => (film ? film.director.split(", ").filter(Boolean) : []),
    [film],
  );

  useEffect(() => {
    injectFonts();
  }, []);

  useEffect(() => {
    if (!film) return;
    let cleanup: (() => void) | undefined;
    const id = requestAnimationFrame(() => {
      if (!trackRef.current) return;
      cleanup = initDissolve(trackRef.current);
    });
    return () => {
      cancelAnimationFrame(id);
      cleanup?.();
    };
  }, [film?.slug]);

  useEffect(() => {
    if (!film || !scrollNextRef.current) return;
    const root = scrollNextRef.current;
    const cleanup = initScrollNext(root, {
      onNavigate: (href) => {
        const path = href.startsWith("#") ? href.slice(1) : href;
        navigate(path.split("?")[0] || "/");
      },
    });
    return cleanup;
  }, [film?.slug, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [film?.slug]);

  useEffect(() => {
    const trailer = document.querySelector(".dg-trailer");
    if (!trailer) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setNavOnDark(
          Boolean(entry?.isIntersecting && (entry.intersectionRatio ?? 0) > 0.2),
        );
      },
      { threshold: [0, 0.2, 0.5] },
    );
    io.observe(trailer);
    return () => io.disconnect();
  }, [film?.slug]);

  if (!film || !next) return <Navigate to="/" replace />;

  const metadata = [
    { label: "Year", value: film.year },
    { label: "Genre", value: film.genre },
    ...(film.languages !== "—"
      ? [{ label: "Languages", value: film.languages }]
      : []),
    { label: "Format", value: film.runtime },
  ];

  return (
    <div className="dg-page dg-page--detail">
      <div
        className="dg-grain"
        style={{ backgroundImage: `url(${NOISE_TEXTURE})` }}
      />

      <nav
        className={`dg-nav dg-nav--detail${navOnDark ? " is-on-dark" : ""}`}
        aria-label="Primary"
      >
        <div className="dg-nav__inner">
          <Link to="/" className="dg-nav__logo" aria-label="Studio home">
            <StudioLogo />
          </Link>
          <ul className="dg-nav__links">
            <li>
              <Link
                to="/"
                className={`dg-nav__link${catalogId === "work" ? " is-active" : ""}`}
              >
                Work
              </Link>
            </li>
            <li>
              <Link
                to="/"
                className={`dg-nav__link${catalogId === "brands" ? " is-active" : ""}`}
              >
                Brands
              </Link>
            </li>
            <li>
              <a href="/" className="dg-nav__link dg-nav__index">
                About
              </a>
            </li>
          </ul>
        </div>
      </nav>

      <main className="dg-detail-main">
        <div ref={trackRef} className="dg-reveal-track" data-dissolve-track="">
          {}
          <section
            className="dg-production-hero"
            data-dissolve=""
            data-production-hero=""
          >
            <div className="dg-container">
              <div className="dg-production-content">
                <div className="dg-production__info">
                  <div className="dg-production__title">
                    <h1 className="dg-heading-l dg-text-center">{film.title}</h1>
                  </div>
                  <div className="dg-divider-h" />
                  <div className="dg-production__credits">
                    <p className="dg-sub-xs">Created by</p>
                    <CreditNames names={directors} />
                    {film.writtenBy.length > 0 ? (
                      <>
                        <p className="dg-sub-xs dg-credit-gap">Studio</p>
                        <CreditNames names={film.writtenBy} />
                      </>
                    ) : null}
                    <p className="dg-sub-xs dg-credit-gap">Focus</p>
                    <CreditNames names={film.starring} />
                  </div>

                  <div className="dg-production__metadata">
                    {metadata.map((row) => (
                      <div key={row.label} className="dg-meta-item">
                        <div className="dg-divider-h" />
                        <div className="dg-meta-item__content">
                          <p className="dg-sub-xs">{row.label}</p>
                          <p className="dg-p-m dg-meta-item__value">{row.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="dg-production__cta">
                  <PlusMark corner="tl" />
                  <PlusMark corner="tr" />
                  <PlusMark corner="bl" />
                  <PlusMark corner="br" />
                  {}
                  {film.trailerYoutube ? (
                    <button
                      type="button"
                      className="dg-btn dg-btn--on-dark"
                      onClick={() => setTrailerOpen(true)}
                    >
                      <div className="dg-btn__divider" />
                      <span className="dg-btn__mask">
                        <span className="dg-btn__label">Watch trailer</span>
                      </span>
                      <div className="dg-btn__divider" />
                    </button>
                  ) : null}
                  <DetailBtn href={film.watchOnline} label="View project" />
                  <DetailBtn href={film.bluRay} label="Get the release" />
                </div>
              </div>
            </div>
          </section>

          {}
          <section className="dg-trailer">
            <div className="dg-trailer__vh" data-dissolve-bleed="">
              <img
                className="dg-trailer__img"
                src={film.trailer}
                alt={`${film.title} — still`}
                draggable={false}
                decoding="async"
                fetchPriority="high"
              />
              <div className="dg-container dg-trailer__container">
                <div className="dg-trailer__content">
                  {[0, 1, 2, 3, 4].map((row) => (
                    <div key={row} className="dg-trailer__row">
                      <div className="dg-divider-h dg-divider-h--on-dark" />
                    </div>
                  ))}
                  <p className="dg-trailer__quote" aria-label={film.tagline}>
                    {quoteBits.map((bit) => (
                      <span
                        key={`${bit.row}-${bit.text}`}
                        className="dg-trailer__word"
                        style={{
                          left: `${bit.x}%`,
                          top: `${(bit.row + 0.35) * 20}%`,
                        }}
                      >
                        {bit.text}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {}
        <section className="dg-production-description">
          <div className="dg-container">
            <div className="dg-description-content">
              <div className="dg-description__synopsis">
                <p className="dg-p-xl">{film.synopsis}</p>
              </div>
              <div className="dg-description__awards-wrap">
                {film.awards.length > 0 ? (
                  <div className="dg-description__awards">
                    {film.awards.map((award) => (
                      <div
                        key={`${award.title}-${award.org}`}
                        className="dg-award-pair"
                      >
                        <p className="dg-sub-xs">{award.title}</p>
                        <p className="dg-p-m">{award.org}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="dg-description__vector">
                <div className="dg-description-vector__wrap">
                  <img src={film.vector} alt="" draggable={false} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {}
        <section
          ref={scrollNextRef}
          className="dg-scroll-to scroll-to"
          data-scroll-next=""
          data-scroll-next-kicker-film="Next"
        >
          <div className="dg-scroll-to__vh scroll-to__vh">
            <div className="dg-container dg-scroll-to__lines">
              <div className="dg-scroll-to__content scroll-to__content">
                {[0, 1, 2, 3, 4].map((row) => (
                  <div key={row} className="dg-scroll-to__row scroll-to__row">
                    <div className="dg-divider-h divider-horizontal" />
                  </div>
                ))}
              </div>
            </div>
            <div
              data-scroll-next-canvas=""
              className="dg-scroll-to__canvas scroll-to__canvas"
            />
            <div
              data-scroll-next-label=""
              className="dg-scroll-to__label scroll-to__label"
            >
              <p data-scroll-next-kicker="" className="dg-sub-xs">
                Next
              </p>
              <h2 data-scroll-next-title="" className="dg-heading-l">
                {next.title}
              </h2>
            </div>
            <a
              data-scroll-next-link=""
              className="dg-scroll-to__link scroll-to__link"
              href={itemDetailPath(next.slug)}
              aria-label={`Go to ${next.title}`}
            />
            <div data-scroll-next-list="" className="dg-scroll-next-list" hidden>
              {catalogFilms.map((item) => (
                <div key={item.slug} data-scroll-next-item="">
                  <p data-scroll-next-field="title">{item.title}</p>
                  <p data-scroll-next-field="type">
                    {catalogId === "brands" ? "Brand" : "Work"}
                  </p>
                  <p data-scroll-next-field="disc-art-url">{item.disc}</p>
                  <p data-scroll-next-field="slug">{item.slug}</p>
                  <a
                    data-scroll-next-field="detail-url"
                    href={itemDetailPath(item.slug)}
                  >
                    {itemDetailPath(item.slug)}
                  </a>
                  <p data-scroll-next-field="year">{item.year}</p>
                  <p data-scroll-next-field="genre">{item.genre}</p>
                  <p data-scroll-next-field="runtime">{item.runtime}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {trailerOpen && film.trailerYoutube ? (
        <div className="dg-trailer-lightbox" role="dialog" aria-modal="true">
          <button
            type="button"
            className="dg-trailer-lightbox__close"
            onClick={() => setTrailerOpen(false)}
          >
            Close
          </button>
          <iframe
            title={`${film.title} trailer`}
            src={`https:
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      ) : null}
    </div>
  );
}
