import Link from "next/link";
export default function NotFound() {
  return (
    <div className="content-page">
      <h1>Cette adresse nous échappe.</h1>
      <p>Elle a peut-être changé de chemin.</p>
      <Link href="/" className="primary">
        Retour aux bonnes adresses
      </Link>
    </div>
  );
}
