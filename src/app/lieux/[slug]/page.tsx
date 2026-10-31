import { notFound } from "next/navigation";
import Link from "next/link";
import { getVenue } from "@/lib/venues";
import { isOpen } from "@/lib/search";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const v = await getVenue((await params).slug);
  return {
    title: v ? `${v.name}, ${v.city}` : "Adresse introuvable",
    description: v?.description,
  };
}
const days = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];
export default async function VenuePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const v = await getVenue((await params).slug);
  if (!v) notFound();
  return (
    <article className="detail">
      <Link className="breadcrumb" href={`/?q=${encodeURIComponent(v.city)}`}>
        ← Explorer les adresses · {v.city}
      </Link>
      <span className="eyebrow">
        {v.type.toUpperCase()} · {v.neighborhood.toUpperCase()}
      </span>
      <h1>{v.name}</h1>
      <p>
        {v.city} · {"€".repeat(v.price)} ·{" "}
        <span className={isOpen(v) ? "open" : "closed"}>
          {isOpen(v) ? "Ouvert maintenant" : "Actuellement fermé"}
        </span>
      </p>
      {v.source === "DEMO" && (
        <p className="notice">
          Établissement fictif de démonstration. Les adresses, horaires et menus
          ne correspondent pas à un commerce réel.
        </p>
      )}
      {v.source === "OSM" && (
        <p className="notice">
          Données © OpenStreetMap contributors, sous licence ODbL. Fiche non
          vérifiée ; prix indicatif, horaires à confirmer auprès de
          l’établissement.
        </p>
      )}
      <div
        className="detail-hero"
        role="img"
        aria-label="Illustration d’une tasse de café"
      >
        ☕
      </div>
      <div className="detail-columns">
        <div>
          <section>
            <h2>Une adresse qui fait du bien</h2>
            <p>{v.description}</p>
            <div className="tags">
              {v.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </section>
          <section>
            <h2>À la carte</h2>
            {v.menu.length ? (
              v.menu.map((m) => (
                <div className="menu-item" key={m.name}>
                  <div>
                    <strong>{m.name}</strong>
                    <p>{m.description}</p>
                  </div>
                  <span>
                    {new Intl.NumberFormat("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                    }).format(m.price / 100)}
                  </span>
                </div>
              ))
            ) : (
              <p>La carte n’a pas encore été renseignée.</p>
            )}
          </section>
          <section>
            <h2>Les avis de la communauté</h2>
            <p>
              Aucun avis publié pour le moment. La collecte et la modération des
              avis arrivent en phase 2.
            </p>
          </section>
          <section>
            <h2>Nous trouver</h2>
            <p>
              {v.address}
              <br />
              {v.neighborhood}, {v.city}
            </p>
            <a
              href={`https://www.openstreetmap.org/?mlat=${v.latitude}&mlon=${v.longitude}#map=16/${v.latitude}/${v.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="breadcrumb"
            >
              Voir l’emplacement sur OpenStreetMap ↗
            </a>
          </section>
        </div>
        <aside>
          <h2>Passez nous voir</h2>
          {v.hours.length ? (
            v.hours
              .slice()
              .sort((a, b) => (a.day || 7) - (b.day || 7))
              .map((h) => (
                <div className="hours" key={h.day}>
                  <span>{days[h.day]}</span>
                  <span>
                    {h.open} – {h.close}
                  </span>
                </div>
              ))
          ) : (
            <p>Horaires non renseignés.</p>
          )}
          <p className="demo-note">Horaires en heure de Paris.</p>
          <p className="notice">
            Les réservations en ligne arrivent bientôt. Aucun créneau n’est
            réservable actuellement.
          </p>
          {!v.claimed && (
            <>
              <h3>Vous êtes chez vous ici ?</h3>
              <p>Cette fiche n’a pas encore été revendiquée.</p>
              <Link href="/professionnels" className="primary">
                Revendiquer cette fiche
              </Link>
            </>
          )}
        </aside>
      </div>
    </article>
  );
}
