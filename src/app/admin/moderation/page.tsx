/* eslint-disable @next/next/no-img-element -- Private moderation photos are deliberately not cached by the optimizer. */
import { redirect, notFound } from "next/navigation";
import { authConfigured, requireRole } from "@/lib/auth";
import { moderationQueue } from "@/lib/reviews/service";
import { criteria, labels } from "@/lib/reviews/policy";
import { ModerationForm } from "@/components/reviews/forms";
import { db } from "@/lib/db";
import { reviewPhotos, reportFlags, auditLogs } from "@/db/schema";
import { inArray, desc } from "drizzle-orm";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Modération des avis",
  robots: { index: false, follow: false },
};
export default async function Moderation() {
  if (!authConfigured()) redirect("/connexion");
  const user = await requireRole(["ADMIN"]);
  if (!user) notFound();
  const queue = await moderationQueue();
  const ids = queue.map((r) => r.review.id);
  const photos = ids.length
    ? await db
        .select()
        .from(reviewPhotos)
        .where(inArray(reviewPhotos.reviewId, ids))
    : [];
  const reports = ids.length
    ? await db
        .select()
        .from(reportFlags)
        .where(inArray(reportFlags.targetId, ids))
    : [];
  const logs = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);
  return (
    <div className="content-page">
      <span className="eyebrow">ADMINISTRATION</span>
      <h1>Modération des avis</h1>
      <p>
        {queue.length} avis en attente ou signalés (100 maximum, plus récents
        d’abord).
      </p>
      {queue.map(({ review: r, venueName, flags }) => (
        <article className="review-card" key={r.id}>
          <h2>{venueName}</h2>
          <p>
            {r.status === "PENDING"
              ? "En attente"
              : r.status === "PUBLISHED"
                ? "Publié"
                : "Rejeté"}{" "}
            · {flags} signalement(s) ouvert(s) ·{" "}
            {r.verified ? "Visite vérifiée" : "Visite non vérifiée"}
          </p>
          <p className="review-text">{r.text}</p>
          <dl className="rating-breakdown">
            {criteria.map((k) => (
              <div key={k}>
                <dt>{labels[k]}</dt>
                <dd>{r[k]} / 5</dd>
              </div>
            ))}
          </dl>
          {r.abuseReason && (
            <p className="notice">Alerte anti-abus : {r.abuseReason}</p>
          )}
          <div className="review-photos">
            {photos
              .filter((p) => p.reviewId === r.id)
              .map((p) => (
                <img
                  src={`/api/reviews/${r.id}/photos/${p.id}`}
                  alt={p.alt}
                  width={160}
                  height={120}
                  key={p.id}
                />
              ))}
          </div>
          <ul>
            {reports
              .filter((f) => f.targetId === r.id && f.status === "PENDING")
              .map((f) => (
                <li key={f.id}>{f.reason}</li>
              ))}
          </ul>
          <ModerationForm id={r.id} />
        </article>
      ))}
      <h2>Journal des décisions</h2>
      <p>
        50 dernières actions ; les motifs sont réservés aux administrateurs.
      </p>
      {logs.map((log) => (
        <details key={log.id}>
          <summary>
            {log.createdAt.toLocaleString("fr-FR", {
              timeZone: "Europe/Paris",
            })}{" "}
            · {log.action}
          </summary>
          <pre className="audit-entry">
            {JSON.stringify(
              {
                acteur: log.actorId,
                avis: log.targetId,
                décision: log.metadata,
              },
              null,
              2,
            )}
          </pre>
        </details>
      ))}
    </div>
  );
}
