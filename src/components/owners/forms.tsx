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
  const [claimId, setClaimId] = useState<string | null>(null);
  const [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [version, setVersion] = useState(0);
  const router = useRouter();
  if (claimId) return <CodeVerification id={claimId} />;
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
            businessEmail: fields.get("businessEmail"),
            phone: fields.get("phone"),
            applicantRole: fields.get("applicantRole"),
            siret: fields.get("siret"),
            statement: fields.get("statement"),
            captchaToken: token,
          };
          const data = new FormData();
          data.set("payload", JSON.stringify(payload));
          data.set("document", fields.get("document")!);
          const result = await post("/api/claims", data);
          setClaimId(result.id);
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
        E-mail professionnel
        <input type="email" name="businessEmail" required maxLength={254} />
      </label>
      <label>
        Téléphone professionnel
        <input type="tel" name="phone" required maxLength={25} />
      </label>
      <label>
        Votre fonction
        <select name="applicantRole" aria-label="Votre fonction">
          <option value="owner">Propriétaire</option>
          <option value="manager">Gérant</option>
        </select>
      </label>
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
        Justificatif de votre habilitation (facultatif)
        <input
          type="file"
          name="document"
          accept="application/pdf,image/jpeg,image/png,image/webp"
        />
      </label>
      <p className="notice">
        Un PDF ou une image JPEG/PNG/WebP de 5 Mo maximum, facultatif. Masquez
        les données personnelles inutiles. Le justificatif est privé et
        consultable uniquement par vous et les administrateurs. Le SIRET sera
        examiné avec le registre et votre habilitation.
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
        J’ai vérifié l’habilitation du demandeur (contact et justificatif
        éventuel).
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

export function CodeVerification({ id }: { id: string }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="notice">
      <h3>Vérifier l’e-mail professionnel</h3>
      <p>
        Un code à six chiffres a été demandé par e-mail. Il expire après 15
        minutes ; cinq essais maximum. Si l’envoi n’est pas configuré, utilisez
        le renvoi après configuration.
      </p>
      <form
        className="owner-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await post(
              `/api/claims/${id}/verify`,
              JSON.stringify({
                code: new FormData(e.currentTarget).get("code"),
              }),
              true,
            );
            setMessage(
              "E-mail vérifié. Votre demande attend maintenant l’administration.",
            );
            router.refresh();
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Opération impossible.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Code de vérification
          <input
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            required
            autoComplete="one-time-code"
          />
        </label>
        <button className="primary" disabled={busy}>
          Vérifier mon e-mail
        </button>
      </form>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await post(`/api/claims/${id}/resend`, "");
            setMessage("Nouveau code envoyé.");
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Envoi impossible.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Renvoyer un code
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
