"use client";
import { useState } from "react";
export function ActivityLink({
  id,
  kind,
  href,
  children,
}: {
  id: string;
  kind: "phone" | "website" | "directions";
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={() => {
        void fetch(`/api/venues/${id}/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind }),
          keepalive: true,
        }).catch(() => {});
      }}
    >
      {children}
    </a>
  );
}
export function FavoriteButton({ id }: { id: string }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        className="chip"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch(`/api/venues/${id}/activity`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind: "favorites" }),
            });
            const data = await r.json();
            setMessage(
              r.ok
                ? data.active
                  ? "Ajouté à vos favoris."
                  : "Retiré de vos favoris."
                : data.error,
            );
          } catch {
            setMessage("Opération indisponible.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Ajouter / retirer des favoris
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
