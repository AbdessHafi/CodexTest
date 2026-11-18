import { ownerAnalytics } from "@/lib/owners/analytics";
import Analytics from "@/components/owners/analytics";
import { publishedReviews } from "@/lib/reviews/queries";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { authConfigured, requireRole } from "@/lib/auth";
import { ownerDashboard } from "@/lib/owners/service";
import { ReviewError } from "@/lib/reviews/http";
import OwnerEditor from "@/components/owners/editor";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Gérer mon établissement",
  robots: { index: false, follow: false },
};
export default async function Dashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!authConfigured()) redirect("/connexion");
  const user = await requireRole(["OWNER"]);
  if (!user) notFound();
  let data;
  try {
    data = await ownerDashboard(user, (await params).id);
  } catch (e) {
    if (e instanceof ReviewError && (e.status === 403 || e.status === 404))
      notFound();
    throw e;
  }
  const stats = await ownerAnalytics(user, data.venue.id);
  const community = await publishedReviews(data.venue.id);
  const unanswered = community.items.filter((r) => !r.reply);
  return (
    <div className="content-page">
      <Link className="breadcrumb" href="/professionnels">
        ← Mes établissements
      </Link>
      <h1>{data.venue.name}</h1>
      <Link href={`/lieux/${data.venue.slug}`} className="primary">
        Voir la fiche publique
      </Link>
      <p className="notice">
        Établissement vérifié · {community.summary.count} avis publié(s) ·{" "}
        {community.summary.count
          ? community.summary.average.toFixed(1) + " / 5"
          : "Pas encore de note"}
      </p>
      <h2>Actions en attente</h2>
      <p>{unanswered.length} avis sans réponse parmi les 50 plus récents.</p>
      {unanswered.map((r) => (
        <p key={r.id}>
          <Link href={`/lieux/${data.venue.slug}#avis`}>
            {r.text.slice(0, 100)} → Répondre
          </Link>
        </p>
      ))}
      <Analytics data={stats} />
      <OwnerEditor data={data} />
    </div>
  );
}
