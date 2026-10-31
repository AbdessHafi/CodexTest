import { notFound } from "next/navigation";
import Link from "next/link";
import { getVenues } from "@/lib/venues";
import { slugify, pageMetadata } from "@/lib/seo";
import SeoList from "@/components/seo-list";
export const dynamic = "force-dynamic";
async function data(params: Promise<{ city: string; neighborhood: string }>) {
  const { city, neighborhood } = await params;
  return (await getVenues()).filter(
    (v) => slugify(v.city) === city && slugify(v.neighborhood) === neighborhood,
  );
}
const place = (v: { city: string; neighborhood: string }) =>
  v.neighborhood.startsWith(v.city)
    ? v.neighborhood
    : `${v.neighborhood}, ${v.city}`;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; neighborhood: string }>;
}) {
  const rows = await data(params);
  if (!rows.length)
    return { title: "Quartier introuvable", robots: { index: false } };
  const { city, neighborhood } = await params;
  return pageMetadata(
    `Meilleurs brunchs à ${place(rows[0])}`,
    `Trouvez votre prochain brunch ou café à ${place(rows[0])} : cartes, horaires et avis.`,
    `/villes/${city}/${neighborhood}`,
    rows.every((v) => v.source === "DEMO"),
  );
}
export default async function Neighborhood({
  params,
}: {
  params: Promise<{ city: string; neighborhood: string }>;
}) {
  const rows = await data(params);
  if (!rows.length) notFound();
  const { city } = await params;
  const brunch = rows.filter((v) => v.type === "Brunch");
  return (
    <div className="content-page">
      <Link className="breadcrumb" href={`/villes/${city}`}>
        ← Toutes les adresses à {rows[0].city}
      </Link>
      <h1>Meilleurs brunchs à {place(rows[0])}</h1>
      <p>
        {brunch.length
          ? `${brunch.length} adresse(s) pour bruncher dans le quartier.`
          : "Aucun brunch recensé actuellement. Découvrez les cafés du quartier."}{" "}
        Classement alphabétique, sans modification des notes.
      </p>
      <SeoList
        venues={(brunch.length ? brunch : rows)
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, "fr"))}
      />
    </div>
  );
}
