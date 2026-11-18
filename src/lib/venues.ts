import { demoVenues, type Venue } from "./demo";
export const isDemo = () => process.env.DEMO_MODE !== "false";
export async function getVenues(): Promise<Venue[]> {
  if (isDemo()) return demoVenues;
  const { db } = await import("./db");
  const { venues, menuItems, venueHours, venueExceptions, photos } =
    await import("@/db/schema");
  const rows = await db.select().from(venues).orderBy(venues.name);
  const menu = await db.select().from(menuItems);
  const hours = await db.select().from(venueHours);
  const exceptions = await db.select().from(venueExceptions);
  const images = await db
    .select({
      id: photos.id,
      alt: photos.alt,
      venueId: photos.venueId,
      menuItemId: photos.menuItemId,
    })
    .from(photos);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return rows.map((v) => ({
    ...v,
    menu: menu.filter(
      (m) => m.venueId === v.id && (!m.specialDate || m.specialDate === today),
    ),
    hours: hours.filter((h) => h.venueId === v.id),
    exceptions: exceptions.filter((e) => e.venueId === v.id),
    images: images.filter((p) => p.venueId === v.id),
  }));
}
export async function getVenue(slug: string) {
  return (await getVenues()).find((v) => v.slug === slug);
}
