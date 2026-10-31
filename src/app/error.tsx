"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="content-page">
      <h1>Une petite pause technique.</h1>
      <p>
        Les adresses sont temporairement indisponibles. Réessayez dans un
        instant.
      </p>
      <button className="primary" onClick={reset}>
        Réessayer
      </button>
    </div>
  );
}
