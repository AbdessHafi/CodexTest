import Link from "next/link";
export default function Professionals() {
  return (
    <div className="content-page">
      <span className="eyebrow">POUR LES BELLES ADRESSES</span>
      <h1>
        Votre lieu mérite
        <br />
        sa belle rencontre.
      </h1>
      <p>
        Les fiches sont visibles avant leur revendication. L’espace
        professionnel et la vérification de votre établissement par SIRET seront
        disponibles en phase 3.
      </p>
      <p className="notice">
        Aucune revendication ni souscription n’est collectée à ce stade.
      </p>
      <Link className="primary" href="/">
        Découvrir les fiches démo
      </Link>
    </div>
  );
}
