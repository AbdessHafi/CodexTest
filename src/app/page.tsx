import { getVenues, isDemo } from "@/lib/venues";
import Discover from "@/components/discover";
export const dynamic = "force-dynamic";
export function generateMetadata() {
  return { robots: { index: !isDemo(), follow: true } };
}
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <Discover
      venues={await getVenues()}
      demo={isDemo()}
      initialQuery={(await searchParams).q ?? ""}
    />
  );
}
