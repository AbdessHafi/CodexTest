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
  return (
    <div className="content-page">
      <Link className="breadcrumb" href="/professionnels">
        ← Mes établissements
      </Link>
      <h1>{data.venue.name}</h1>
      <Link href={`/lieux/${data.venue.slug}`} className="primary">
        Voir la fiche publique
      </Link>
      <OwnerEditor data={data} />
    </div>
  );
}
