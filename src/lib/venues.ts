import { demoVenues, type Venue } from "./demo";
export const isDemo = () => process.env.DEMO_MODE !== "false";
export async function getVenues(): Promise<Venue[]> {
  if (isDemo()) return demoVenues;
  const { db } = await import("./db");
  const { venues, menuItems, venueHours } = await import("@/db/schema");
  const rows = await db.select().from(venues).orderBy(venues.name);
  const menu = await db.select().from(menuItems);
  const hours = await db.select().from(venueHours);
  return rows.map((v) => ({
    ...v,
    menu: menu.filter((m) => m.venueId === v.id),
    hours: hours.filter((h) => h.venueId === v.id),
  }));
}
export async function getVenue(slug: string) {
  return (await getVenues()).find((v) => v.slug === slug);
}
