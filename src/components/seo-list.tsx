import Link from "next/link";
import type { Venue } from "@/lib/demo";
import { safeJson, siteUrl } from "@/lib/seo";
export default function SeoList({ venues }: { venues: Venue[] }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJson({
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: venues.map((v, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${siteUrl()}/lieux/${v.slug}`,
              name: v.name,
            })),
          }),
        }}
      />
      <div className="seo-list">
        {venues.map((v) => (
          <Link key={v.id} href={`/lieux/${v.slug}`}>
            <h2>{v.name}</h2>
            <p>
              {v.type} · {"€".repeat(v.price)} · {v.neighborhood}
            </p>
            <p>{v.description}</p>
            {v.source === "DEMO" && <small>Lieu fictif de démonstration</small>}
          </Link>
        ))}
      </div>
    </>
  );
}
