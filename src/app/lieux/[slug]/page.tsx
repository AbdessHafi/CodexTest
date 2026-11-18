/* eslint-disable @next/next/no-img-element -- Public images use access-checked routes and no persistent optimizer cache. */
import { notFound } from "next/navigation";
import Link from "next/link";
import { recordActivity } from "@/lib/owners/analytics";
import { ActivityLink, FavoriteButton } from "@/components/owners/links";
import { featuredMenuItem } from "@/lib/owners/policy";
import { getVenue } from "@/lib/venues";
import ReviewSection from "@/components/reviews/section";
import { publishedReviews } from "@/lib/reviews/queries";
import {
  pageMetadata,
  venueStructuredData,
  safeJson,
  slugify,
} from "@/lib/seo";
import { parisDate } from "@/lib/reviews/policy";
import { isOpen } from "@/lib/search";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const v = await getVenue((await params).slug);
  return v
    ? pageMetadata(
        `${v.name}, ${v.city}`,
        v.description,
        `/lieux/${v.slug}`,
        v.source === "DEMO",
      )
    : { title: "Adresse introuvable", robots: { index: false } };
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
  const { summary } = await publishedReviews(v.id);
  if (v.source !== "DEMO") {
    try {
      await recordActivity(v.id, "views");
    } catch {
      /* Analytics must not make a venue unavailable. */
    }
  }
  return (
    <article className="detail">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJson(venueStructuredData(v, summary)),
        }}
      />
      <Link className="breadcrumb" href={`/villes/${slugify(v.city)}`}>
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
      {v.images?.some((p) => p.cover) && (
        <img
          className="venue-cover"
          src={`/api/venues/${v.id}/photos/${v.images.find((p) => p.cover)!.id}`}
          alt={v.images.find((p) => p.cover)!.alt}
          width={1000}
          height={450}
        />
      )}
      <div
        className="detail-hero"
        role="img"
        aria-label="Illustration d’une tasse de café"
      >
        ☕
      </div>
      {!!v.images?.filter((p) => !p.menuItemId).length && (
        <div className="venue-gallery">
          {v.images
            .filter((p) => !p.menuItemId)
            .map((p) => (
              <img
                key={p.id}
                src={`/api/venues/${v.id}/photos/${p.id}`}
                alt={p.alt}
                width={280}
                height={210}
                loading="lazy"
              />
            ))}
        </div>
      )}
      <div className="owner-actions">
        {v.phone && (
          <ActivityLink
            id={v.id}
            kind="phone"
            href={`tel:${v.phone.replace(/[^+0-9]/g, "")}`}
          >
            Appeler l’établissement
          </ActivityLink>
        )}
        {v.website && (
          <ActivityLink id={v.id} kind="website" href={v.website}>
            Site web
          </ActivityLink>
        )}
        {v.email && <a href={`mailto:${v.email}`}>E-mail</a>}
        {v.instagram && <a href={v.instagram}>Instagram</a>}
        {v.facebook && <a href={v.facebook}>Facebook</a>}
      </div>
      {v.source !== "DEMO" && <FavoriteButton id={v.id} />}
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
            {v.menu
              .filter((m) => featuredMenuItem(m, parisDate()))
              .map((m) => (
                <div className="featured-dish" key={m.id || m.name}>
                  <strong>À la une : {m.name}</strong>
                  <p>{m.description}</p>
                </div>
              ))}
            {v.menu.length ? (
              v.menu.map((m, i) => (
                <div key={m.id || m.name}>
                  {(i === 0 || v.menu[i - 1].category !== m.category) && (
                    <h3 className="menu-category">
                      {m.category || "À la carte"}
                    </h3>
                  )}
                  <div className="menu-item">
                    <div>
                      <strong>{m.name}</strong>
                      {m.specialDate && <p>Plat du jour</p>}
                      {v.images
                        ?.filter((p) => p.menuItemId === m.id)
                        .map((p) => (
                          <img
                            className="menu-image"
                            key={p.id}
                            src={`/api/venues/${v.id}/photos/${p.id}`}
                            alt={p.alt}
                            width={160}
                            height={120}
                            loading="lazy"
                          />
                        ))}
                      <p>{m.description}</p>
                      {!!m.tags?.length && <p>{m.tags.join(" · ")}</p>}
                      {!!m.allergens?.length && (
                        <p>Allergènes : {m.allergens.join(", ")}</p>
                      )}
                    </div>
                    <span>
                      {new Intl.NumberFormat("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                      }).format(m.price / 100)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p>La carte n’a pas encore été renseignée.</p>
            )}
          </section>
          <ReviewSection venueId={v.id} />
          <section>
            <h2>Nous trouver</h2>
            <p>
              {v.address}
              <br />
              {v.neighborhood}, {v.city}
            </p>
            <ActivityLink
              id={v.id}
              kind="directions"
              href={`https://www.openstreetmap.org/?mlat=${v.latitude}&mlon=${v.longitude}#map=16/${v.latitude}/${v.longitude}`}
            >
              Voir l’emplacement sur OpenStreetMap ↗
            </ActivityLink>
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
          {v.exceptions
            ?.filter((e) => e.date >= parisDate())
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((e) => (
              <div className="hours" key={e.date}>
                <span>{e.date}</span>
                <span>
                  {e.closed
                    ? "Fermeture exceptionnelle"
                    : `${e.open} – ${e.close}`}
                </span>
              </div>
            ))}
          <p className="notice">
            Les réservations en ligne arrivent bientôt. Aucun créneau n’est
            réservable actuellement.
          </p>
          {v.claimed && <p className="notice">Établissement vérifié</p>}
          {!v.claimed && (
            <>
              <h3>Vous êtes chez vous ici ?</h3>
              <p>Cette fiche n’a pas encore été revendiquée.</p>
              <Link
                href={`/professionnels/revendiquer/${v.slug}`}
                className="primary"
              >
                Revendiquer cette fiche
              </Link>
            </>
          )}
        </aside>
      </div>
    </article>
  );
}
