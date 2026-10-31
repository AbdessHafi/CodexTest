"use client";
import { useState } from "react";
export default function Login({ configured }: { configured: boolean }) {
  const [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  async function login(method: string, email?: string) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error);
        return;
      }
      if (data.url) window.location.assign(data.url);
      else
        setMessage(
          "Vérifiez votre boîte e-mail pour recevoir votre lien de connexion.",
        );
    } catch {
      setMessage("Connexion au serveur impossible. Réessayez.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      {!configured && (
        <p className="notice">
          La découverte est accessible sans compte. La connexion nécessite la
          configuration de Supabase par l’administrateur.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void login(
            "email",
            String(new FormData(e.currentTarget).get("email")),
          );
        }}
      >
        <label>
          Votre adresse e-mail
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.fr"
            required
            maxLength={254}
            disabled={!configured}
          />
        </label>
        <button className="primary" disabled={!configured || pending}>
          {pending ? "Un instant…" : "Recevoir un lien de connexion"}
        </button>
      </form>
      <div className="oauth">
        <button
          disabled={!configured || pending}
          onClick={() => login("google")}
        >
          Continuer avec Google
        </button>
        <button
          disabled={!configured || pending}
          onClick={() => login("apple")}
        >
          Continuer avec Apple
        </button>
      </div>
      <p role="status">{message}</p>
      <p className="demo-note">
        Connexion sans mot de passe. Aucun rôle professionnel ou administrateur
        ne peut être choisi à l’inscription.
      </p>
    </>
  );
}
