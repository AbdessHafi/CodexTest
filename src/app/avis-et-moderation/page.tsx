export const metadata = {
  title: "Comment fonctionnent les avis ?",
  description:
    "Collecte, vérification, classement et modération des avis Pause Café.",
};
export default function Policy() {
  return (
    <article className="content-page">
      <h1>Des avis qui éclairent votre pause.</h1>
      <h2>Collecte et vérification</h2>
      <p>
        Un avis exige un compte avec e-mail vérifié, une date de visite passée
        et cinq notes de 1 à 5. Un compte peut déposer un avis par établissement
        et par date de visite. Aucun paiement ni avantage n’est accordé en
        échange d’un avis positif.
      </p>
      <p>
        « Visite vérifiée » signifie que le serveur a relié l’avis à une
        réservation terminée au nom de son auteur, dans cet établissement, à la
        même date. Sans cette preuve, la mention « Visite non vérifiée » reste
        visible. La vérification d’e-mail seule ne prouve pas une visite.
      </p>
      <h2>Publication et classement</h2>
      <p>
        Chaque avis et ses photos sont examinés avant publication. Seuls les
        avis publiés comptent dans la moyenne : les cinq critères ont le même
        poids, puis chaque avis a le même poids. Le classement suit la date de
        dépôt, du plus récent au plus ancien, sans effet des partenariats
        commerciaux. Les 50 avis les plus récents sont affichés, la moyenne
        porte sur tous les avis publiés.
      </p>
      <h2>Modération et signalements</h2>
      <p>
        La modération recherche les contenus frauduleux, publicitaires, hors
        sujet, haineux, illégaux ou révélant des données personnelles. Une
        opinion négative ne constitue pas un motif de rejet. Les doublons de
        texte sont signalés à l’équipe pour examen, sans rejet automatique. Une
        raison est conservée avec chaque décision. Aucun délai de traitement
        n’est garanti à ce stade.
      </p>
      <p>
        Le bouton « Signaler cet avis » permet à un utilisateur connecté
        d’expliquer un problème. Un signalement n’efface pas automatiquement un
        avis : l’administrateur le traite et journalise sa décision.
      </p>
      <h2>Réponses des établissements</h2>
      <p>
        Seul un propriétaire validé de l’établissement peut publier une réponse
        publique. Il ne peut ni éditer ni supprimer l’avis, ni modifier la note
        ou la preuve de visite. Il ne peut pas remplacer sa réponse depuis cette
        interface.
      </p>
      <h2>Vos photos</h2>
      <p>
        Trois photos JPEG, PNG ou WebP de 5 Mo maximum chacune. Elles sont
        réencodées en JPEG, redimensionnées et privées de leurs métadonnées.
        Elles restent privées jusqu’à publication de l’avis. N’envoyez pas de
        données personnelles et respectez le droit à l’image.
      </p>
    </article>
  );
}
