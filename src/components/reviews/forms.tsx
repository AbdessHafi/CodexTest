"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { criteria, labels } from "@/lib/reviews/policy";
import Captcha from "./captcha";
async function send(url: string, body: BodyInit, json = false) {
  const response = await fetch(url, {
    method: "POST",
    headers: json ? { "Content-Type": "application/json" } : undefined,
    body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Opération indisponible.");
  return data;
}
export function ReviewForm({
  venueId,
  demo,
}: {
  venueId: string;
  demo: boolean;
}) {
  const [token, setToken] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [captchaKey, setCaptchaKey] = useState(0);
  if (demo)
    return (
      <p className="notice">
        Les avis ne sont pas collectés sur le catalogue démo. Activez la base de
        données et connectez-vous pour partager une visite réelle.
      </p>
    );
  return (
    <details className="review-compose">
      <summary>Partager ma visite</summary>
      <p>
        Un compte avec adresse e-mail vérifiée est nécessaire.{" "}
        <Link href="/connexion">Se connecter</Link>
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          setBusy(true);
          setMessage("");
          try {
            const fields = new FormData(form);
            const payload = {
              venueId,
              visitDate: fields.get("visitDate"),
              text: fields.get("text"),
              captchaToken: token,
              ...Object.fromEntries(
                criteria.map((k) => [k, Number(fields.get(k))]),
              ),
              ...(fields.get("bookingId")
                ? { bookingId: fields.get("bookingId") }
                : {}),
            };
            const data = new FormData();
            data.set("payload", JSON.stringify(payload));
            for (const photo of fields.getAll("photos"))
              if (photo instanceof File && photo.size)
                data.append("photos", photo);
            await send("/api/reviews", data);
            form.reset();
            setMessage(
              "Merci ! Votre avis est en attente de modération. Il n’est pas encore public.",
            );
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Envoi impossible.");
          } finally {
            setToken("");
            setCaptchaKey((k) => k + 1);
            setBusy(false);
          }
        }}
      >
        <fieldset>
          <legend>Votre expérience, de 1 à 5 étoiles</legend>
          {criteria.map((k) => (
            <label key={k}>
              {labels[k]}
              <select name={k} required defaultValue="">
                <option value="" disabled>
                  Votre note
                </option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option value={n} key={n}>
                    {n} étoile{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
        <label>
          Date de visite
          <input type="date" name="visitDate" required />
        </label>
        <label>
          Votre avis
          <textarea
            name="text"
            minLength={20}
            maxLength={3000}
            required
            placeholder="Qu’avez-vous apprécié pendant votre visite ?"
          />
        </label>
        <label>
          Référence de réservation (facultatif)
          <input name="bookingId" maxLength={100} />
        </label>
        <p className="demo-note">
          Seule une réservation terminée, à votre nom, au même endroit et à la
          même date donne le badge « Visite vérifiée ».
        </p>
        <label>
          Photos de votre visite (3 maximum, 5 Mo chacune)
          <input
            type="file"
            name="photos"
            accept="image/jpeg,image/png,image/webp"
            multiple
          />
        </label>
        <p className="demo-note">
          Publiez uniquement des photos dont vous détenez les droits, sans
          données personnelles ni personnes identifiables sans leur accord.
        </p>
        <Captcha key={captchaKey} action="review" onToken={setToken} />
        <button className="primary" disabled={busy}>
          {busy ? "Envoi…" : "Envoyer mon avis"}
        </button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
export function ReviewActions({
  id,
  canReply,
}: {
  id: string;
  canReply: boolean;
}) {
  const [token, setToken] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [captchaKey, setCaptchaKey] = useState(0);
  const router = useRouter();
  async function submit(form: HTMLFormElement, kind: "reply" | "report") {
    setBusy(true);
    try {
      const data = new FormData(form);
      await send(
        `/api/reviews/${id}/${kind}`,
        JSON.stringify(
          kind === "reply"
            ? { text: data.get("text") }
            : { reason: data.get("reason"), captchaToken: token },
        ),
        true,
      );
      setMessage(
        kind === "report"
          ? "Signalement transmis à la modération."
          : "Réponse publiée.",
      );
      form.reset();
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Opération impossible.");
    } finally {
      setToken("");
      setCaptchaKey((k) => k + 1);
      setBusy(false);
    }
  }
  return (
    <div className="review-actions">
      <details>
        <summary>Signaler cet avis</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(e.currentTarget, "report");
          }}
        >
          <label>
            Motif du signalement
            <textarea name="reason" required minLength={10} maxLength={1000} />
          </label>
          <Captcha key={captchaKey} action="report" onToken={setToken} />
          <button disabled={busy}>Envoyer le signalement</button>
        </form>
      </details>
      {canReply && (
        <details>
          <summary>Répondre en tant que propriétaire</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(e.currentTarget, "reply");
            }}
          >
            <label>
              Réponse publique
              <textarea name="text" required minLength={5} maxLength={2000} />
            </label>
            <button className="primary" disabled={busy}>
              Publier la réponse
            </button>
          </form>
        </details>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
export function ModerationForm({ id }: { id: string }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="moderation-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const form = new FormData(e.currentTarget);
          await send(
            `/api/admin/reviews/${id}`,
            JSON.stringify({
              action: form.get("action"),
              reason: form.get("reason"),
            }),
            true,
          );
          router.refresh();
          setMessage("Décision enregistrée et auditée.");
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Opération impossible.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Décision
        <select name="action">
          <option value="PUBLISH">Publier / maintenir publié</option>
          <option value="REJECT">Rejeter / retirer de la publication</option>
          <option value="DISMISS_REPORTS">
            Classer les signalements sans changer l’avis
          </option>
        </select>
      </label>
      <label>
        Motif conservé dans le journal
        <textarea name="reason" minLength={10} maxLength={1000} required />
      </label>
      <button className="primary" disabled={busy}>
        Enregistrer la décision
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
