"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Search,
  MapPin,
  ArrowUpRight,
  Navigation,
  SlidersHorizontal,
  X,
  Map,
  LayoutGrid,
  Leaf,
  Wifi,
  Sun,
  ChevronDown,
  Compass,
} from "lucide-react";
import { type Venue, venueTypes, allTags, cityNames } from "@/lib/demo";
import { filterVenues, distance, isOpen } from "@/lib/search";
const VenueMap = dynamic(() => import("./venue-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Chargement de la carte…</div>,
});
export default function Discover({
  venues,
  demo,
  initialQuery,
}: {
  venues: Venue[];
  demo: boolean;
  initialQuery: string;
}) {
  const [q, setQ] = useState(initialQuery),
    [type, setType] = useState(""),
    [tags, setTags] = useState<string[]>([]),
    [open, setOpen] = useState(false),
    [price, setPrice] = useState(0),
    [filters, setFilters] = useState(false),
    [map, setMap] = useState(false),
    [position, setPosition] = useState<{ lat: number; lng: number } | null>(
      null,
    ),
    [geoError, setGeoError] = useState("");
  const results = useMemo(() => {
    const found = filterVenues(venues, { q, type, tags, open, price });
    return position
      ? [...found].sort((a, b) => distance(position, a) - distance(position, b))
      : found;
  }, [venues, q, type, tags, open, price, position]);
  function near() {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("La géolocalisation est indisponible sur ce navigateur.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setQ("");
      },
      () =>
        setGeoError("Position indisponible. Recherchez plutôt votre ville."),
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  function toggleTag(tag: string) {
    setTags((t) =>
      t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag],
    );
  }
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span /> LE GOÛT DES BONNES ADRESSES
          </span>
          <h1>
            Votre prochaine
            <br />
            belle <em>pause.</em>
          </h1>
          <p>
            Un café qui réveille. Un brunch qui rassemble.
            <br />
            Découvrez les lieux où l’on se sent bien, tout simplement.
          </p>
          <form
            className="search-box"
            onSubmit={(e) => {
              e.preventDefault();
              document
                .getElementById("adresses")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <MapPin size={21} />
            <label className="sr-only" htmlFor="search">
              Ville, quartier ou établissement
            </label>
            <input
              id="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Une ville, un quartier, une envie…"
            />
            <button aria-label="Rechercher">
              <Search size={21} />
            </button>
          </form>
          <button className="near" onClick={near}>
            <Navigation size={14} /> Autour de moi <span>·</span> Trouver ma
            prochaine pause
          </button>
          {geoError && (
            <p role="status" className="error">
              {geoError}
            </p>
          )}
          <div className="hero-foot">
            <span className="mini-cups">☕</span>
            <span>
              Des lieux singuliers, sélectionnés pour vous.
              <br />
              <strong>5 villes à explorer. Mille raisons de s’arrêter.</strong>
            </span>
          </div>
        </div>
        <div
          className="hero-art"
          role="img"
          aria-label="Illustration d’un café, d’un croissant et d’une table au soleil"
        >
          <div className="art-grid" />
          <span className="art-caption">
            LES PETITS PLAISIRS
            <br />
            FONT LES BELLES JOURNÉES
          </span>
          <div className="saucer">
            <div className="cup-handle" />
            <div className="coffee">
              <div className="latte">❦</div>
            </div>
          </div>
          <div className="bread-plate">
            <span>🥐</span>
          </div>
          <div className="art-note">
            <span>La pause du moment</span>
            <strong>Un café, et le temps s’arrête.</strong>
            <span>
              À savourer sans se presser <ArrowUpRight size={15} />
            </span>
          </div>
          <span className="art-stamp">
            FAIT POUR
            <br />
            <b>ralentir</b>
            <br />
            DEPUIS TOUJOURS
          </span>
        </div>
      </section>
      <section className="discovery" id="adresses">
        <div className="section-heading">
          <div>
            <span className="eyebrow">À CHAQUE ENVIE, SON ADRESSE</span>
            <h2>On se retrouve où ?</h2>
          </div>
          <p>Les meilleures pauses commencent ici.</p>
        </div>
        <div className="city-tabs" aria-label="Choisir une ville">
          <button className={!q ? "active" : ""} onClick={() => setQ("")}>
            Toute la France
          </button>
          {cityNames.map((c) => (
            <button
              key={c}
              onClick={() => {
                setQ(c);
                setPosition(null);
              }}
              className={q === c ? "active" : ""}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="filter-bar">
          <div className="filter-chips">
            <label className="select-chip">
              <CoffeeIcon />
              <select
                aria-label="Type d’établissement"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="">Toutes les envies</option>
                {venueTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
            <button
              className={open ? "chip selected" : "chip"}
              onClick={() => setOpen(!open)}
            >
              <span className="green-dot" /> Ouvert maintenant
            </button>
            <button
              className={tags.includes("Terrasse") ? "chip selected" : "chip"}
              onClick={() => toggleTag("Terrasse")}
            >
              <Sun size={15} /> Terrasse
            </button>
            <button
              className={tags.includes("Végétarien") ? "chip selected" : "chip"}
              onClick={() => toggleTag("Végétarien")}
            >
              <Leaf size={15} /> Végétarien
            </button>
            <button
              className="chip"
              onClick={() => setFilters(!filters)}
              aria-expanded={filters}
            >
              <SlidersHorizontal size={15} /> Filtres
              {(price > 0 || tags.length > 0) && (
                <span className="filter-count">
                  {tags.length + (price ? 1 : 0)}
                </span>
              )}
            </button>
          </div>
          <button className="map-toggle" onClick={() => setMap(!map)}>
            {map ? <LayoutGrid size={16} /> : <Map size={16} />}{" "}
            {map ? "Voir la liste" : "Voir la carte"}
          </button>
        </div>
        {filters && (
          <div className="filter-panel">
            <label>
              Budget maximum{" "}
              <select
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              >
                <option value="0">Tous les budgets</option>
                {[1, 2, 3].map((p) => (
                  <option key={p} value={p}>
                    {"€".repeat(p)}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Vos préférences</legend>
              {allTags.map((t) => (
                <label key={t}>
                  <input
                    type="checkbox"
                    checked={tags.includes(t)}
                    onChange={() => toggleTag(t)}
                  />
                  {t}
                </label>
              ))}
            </fieldset>
            <button
              onClick={() => {
                setTags([]);
                setPrice(0);
                setOpen(false);
                setType("");
                setPosition(null);
              }}
            >
              <X size={14} /> Réinitialiser
            </button>
            <p>La réservation et ses filtres seront disponibles en phase 4.</p>
          </div>
        )}
        <div className="results-heading">
          <p>
            <strong>{results.length} adresses</strong> pour votre prochaine
            pause {position && "· classées par distance"}
          </p>
          <span>
            <Compass size={14} /> {demo ? "La sélection démo" : "À découvrir"}
          </span>
        </div>
        {demo && (
          <p className="demo-note">
            Collection de démonstration · Tous les lieux, menus et emplacements
            sont fictifs. Aucun avis inventé.
          </p>
        )}
        {map ? (
          <VenueMap venues={results} />
        ) : results.length ? (
          <div className="venue-grid">
            {results.map((v) => (
              <VenueCard
                key={v.id}
                venue={v}
                km={position ? distance(position, v) : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <Search size={30} />
            <h3>Aucune adresse pour cette envie</h3>
            <p>Essayez une autre ville ou retirez quelques filtres.</p>
            <button
              onClick={() => {
                setQ("");
                setType("");
                setTags([]);
                setPrice(0);
                setOpen(false);
              }}
            >
              Voir toutes les adresses
            </button>
          </div>
        )}
        <div className="editorial">
          <span>LA VIE A MEILLEUR GOÛT ENSEMBLE</span>
          <h2>
            À chaque quartier,
            <br />
            sa petite pépite.
          </h2>
          <p>
            Du premier espresso au dernier pancake,
            <br />
            il y a toujours une bonne raison de faire une pause.
          </p>
          <button
            onClick={() => {
              setQ("");
              setType("Brunch");
              document
                .getElementById("adresses")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Trouver mon prochain brunch <ArrowUpRight size={17} />
          </button>
        </div>
      </section>
    </>
  );
}
function CoffeeIcon() {
  return <span aria-hidden="true">☕</span>;
}
function VenueCard({ venue: v, km }: { venue: Venue; km?: number }) {
  return (
    <Link href={`/lieux/${v.slug}`} className="venue-card">
      <div className={`venue-art scene-${v.photo}`}>
        <div className="scene-window" />
        <div className="scene-table" />
        <div className="scene-cup">☕</div>
        <div className="scene-plant">✺</div>
        <span className="venue-kind">{v.type}</span>
        <span className="illustration-label">Illustration</span>
      </div>
      <div className="card-location">
        {v.city.toUpperCase()} <span>· {v.neighborhood}</span>
      </div>
      <div className="card-title">
        <h3>{v.name}</h3>
        <ArrowUpRight size={20} />
      </div>
      <p className="card-description">
        Café de spécialité & petits bonheurs maison
      </p>
      <div className="card-meta">
        <span>
          {"€".repeat(v.price)} <i>·</i>{" "}
          {km !== undefined ? `${km.toFixed(1)} km` : "Nouveau lieu"}
        </span>
        <span className={isOpen(v) ? "open" : "closed"}>
          {isOpen(v) ? "Ouvert" : "Fermé"}
        </span>
      </div>
      <div className="card-tags">
        {v.tags.slice(0, 2).map((t) => (
          <span key={t}>
            {t === "Wifi" ? (
              <Wifi size={12} />
            ) : t === "Terrasse" ? (
              <Sun size={12} />
            ) : (
              <Leaf size={12} />
            )}{" "}
            {t}
          </span>
        ))}
      </div>
    </Link>
  );
}
