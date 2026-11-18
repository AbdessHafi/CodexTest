"use client";
import { useState } from "react";
import type { ownerAnalytics } from "@/lib/owners/analytics";
import { parisDate } from "@/lib/reviews/policy";
export default function Analytics({
  data,
}: {
  data: Awaited<ReturnType<typeof ownerAnalytics>>;
}) {
  const [days, setDays] = useState(7);
  const from = parisDate(
    new Date(
      new Date(`${data.today}T12:00:00Z`).getTime() - (days - 1) * 86400000,
    ),
  );
  const rows = data.daily.filter((r) => r.day >= from);
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <section>
      <h2>Vos statistiques</h2>
      <label>
        Période{" "}
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>7 derniers jours</option>
          <option value={30}>30 derniers jours</option>
        </select>
      </label>
      <p>
        {rows.reduce((s, r) => s + r.views, 0)} vues ·{" "}
        {rows.reduce((s, r) => s + r.phone + r.website + r.directions, 0)} clics
        · {data.favorites} favoris actuels
      </p>
      <p className="demo-note">
        Comptages agrégés, pas de visiteurs uniques. Aucun cookie analytique, IP
        brute ou profil visiteur enregistré ; les requêtes répétées et robots
        peuvent compter.
      </p>
      {!!rows.length && (
        <div
          className="analytics-chart"
          role="img"
          aria-label={`Vues quotidiennes sur ${days} jours`}
        >
          {rows.map((r) => (
            <div key={r.day}>
              <span
                style={{ height: `${Math.max(2, (r.views / max) * 100)}px` }}
              />
              <small>
                {r.day.slice(5)} : {r.views}
              </small>
            </div>
          ))}
        </div>
      )}
      {!rows.length && (
        <p className="notice">Aucune activité enregistrée sur cette période.</p>
      )}
      <table className="analytics-table">
        <caption>Détails des vues et clics quotidiens</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Vues</th>
            <th>Téléphone</th>
            <th>Site</th>
            <th>Itinéraire</th>
            <th>Ajouts favoris</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day}>
              <td>{r.day}</td>
              <td>{r.views}</td>
              <td>{r.phone}</td>
              <td>{r.website}</td>
              <td>{r.directions}</td>
              <td>{r.favorites}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Évolution des avis publiés</h3>
      {!!data.trend.length && (
        <svg
          viewBox="0 0 300 120"
          width="300"
          height="120"
          role="img"
          aria-label="Tendance des notes publiées"
        >
          <polyline
            fill="none"
            stroke="#69763a"
            strokeWidth="3"
            points={data.trend
              .slice()
              .sort((a, b) => a.day.localeCompare(b.day))
              .filter((r) => r.day >= from)
              .map(
                (r, i, all) =>
                  `${10 + (i * 280) / Math.max(1, all.length - 1)},${110 - r.rating * 20}`,
              )
              .join(" ")}
          />
        </svg>
      )}
      {data.trend
        .filter((r) => r.day >= from)
        .map((r) => (
          <p key={r.day}>
            {r.day} : {r.rating.toFixed(1)} / 5 · {r.count} avis
          </p>
        ))}
      {!data.trend.length && <p>Pas encore d’avis publié sur cette période.</p>}
    </section>
  );
}
