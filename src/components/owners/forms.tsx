"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Captcha from "@/components/reviews/captcha";
export async function post(url: string, body: BodyInit, json = false) {
  const response = await fetch(url, {
    method: "POST",
    headers: json ? { "Content-Type": "application/json" } : undefined,
    body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Opération impossible.");
  return data;
}
export function ClaimForm({ venueId }: { venueId: string }) {
  const [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [version, setVersion] = useState(0);
  const router = useRouter();
  return (
    <form
      className="owner-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        try {
          const fields = new FormData(form);
          const payload = {
            venueId,
            siret: fields.get("siret"),
            statement: fields.get("statement"),
            captchaToken: token,
          };
          const data = new FormData();
          data.set("payload", JSON.stringify(payload));
          data.set("document", fields.get("document")!);
          await post("/api/claims", data);
          setMessage(
            "Demande transmise. Aucun accès propriétaire n’est accordé avant validation.",
          );
          form.reset();
          router.refresh();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Envoi impossible.");
        } finally {
          setBusy(false);
          setToken("");
          setVersion((v) => v + 1);
        }
      }}
    >
      <label>
        SIRET de l’établissement
        <input
          name="siret"
          required
          pattern="[0-9]{14}"
          maxLength={14}
          inputMode="numeric"
          placeholder="14 chiffres sans espaces"
        />
      </label>
      <label>
        Votre lien avec l’établissement
        <textarea
          name="statement"
          minLength={20}
          maxLength={2000}
          required
          placeholder="Précisez votre fonction et votre habilitation à représenter cet établissement."
        />
      </label>
      <label>
        Justificatif de votre habilitation
        <input
          type="file"
          name="document"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </label>
      <p className="notice">
        Une image JPEG, PNG ou WebP de 5 Mo maximum (pas de PDF). Masquez les
        données personnelles inutiles. Le justificatif est privé et consultable
        uniquement par vous et les administrateurs. Le SIRET sera examiné avec
        le registre et votre habilitation.
      </p>
      <Captcha key={version} action="claim" onToken={setToken} />
      <button disabled={busy} className="primary">
        {busy ? "Envoi…" : "Envoyer ma demande"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
export function ClaimDecisionForm({ id }: { id: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="owner-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        try {
          await post(
            `/api/admin/claims/${id}`,
            JSON.stringify({
              action: form.get("action"),
              reason: form.get("reason"),
              registryChecked: form.has("registryChecked"),
              authorityChecked: form.has("authorityChecked"),
            }),
            true,
          );
          setMessage("Décision enregistrée dans le journal.");
          router.refresh();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Opération impossible.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Décision
        <select name="action" aria-label="Décision de revendication">
          <option value="REJECT">Rejeter</option>
          <option value="APPROVE">Valider le propriétaire</option>
        </select>
      </label>
      <label className="check-label">
        <input name="registryChecked" type="checkbox" />
        J’ai vérifié le SIRET, l’activité et l’adresse dans le registre
        officiel.
      </label>
      <label className="check-label">
        <input name="authorityChecked" type="checkbox" />
        J’ai vérifié le justificatif et l’habilitation du demandeur.
      </label>
      <label>
        Motif de la décision
        <textarea name="reason" minLength={10} maxLength={1000} required />
      </label>
      <button className="primary" disabled={busy}>
        Enregistrer la revendication
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
