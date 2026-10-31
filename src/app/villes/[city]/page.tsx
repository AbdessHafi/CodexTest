import { notFound } from "next/navigation";
import Link from "next/link";
import { getVenues } from "@/lib/venues";
import { cityGroups, slugify, pageMetadata } from "@/lib/seo";
import SeoList from "@/components/seo-list";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const venues = (await getVenues()).filter((v) => slugify(v.city) === city);
  if (!venues.length)
    return { title: "Ville introuvable", robots: { index: false } };
  return pageMetadata(
    `Meilleurs cafés et brunchs à ${venues[0].city}`,
    `Découvrez les cafés et brunchs de ${venues[0].city}, leurs menus, horaires et avis.`,
    `/villes/${city}`,
    venues.every((v) => v.source === "DEMO"),
  );
}
export default async function City({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const venues = (await getVenues()).filter((v) => slugify(v.city) === city);
  if (!venues.length) notFound();
  const group = cityGroups(venues)[0];
  return (
    <div className="content-page">
      <Link className="breadcrumb" href="/">
        ← Explorer la France
      </Link>
      <h1>Meilleurs cafés et brunchs à {group.name}</h1>
      <p>
        Comparez les envies, les menus et les avis publiés. Les adresses sont
        classées par nom, sans placement sponsorisé.
      </p>
      <nav className="seo-nav" aria-label="Quartiers">
        {group.neighborhoods.map((n) => (
          <Link key={n.slug} href={`/villes/${city}/${n.slug}`}>
            {n.name}
          </Link>
        ))}
      </nav>
      <SeoList
        venues={venues
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, "fr"))}
      />
    </div>
  );
}
