import type { Venue } from "./demo";
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function isOpen(venue: Venue, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    get("weekday"),
  );
  const h = venue.hours.find((h) => h.day === day);
  const time = `${get("hour")}:${get("minute")}`;
  return !!h && h.open <= time && time < h.close;
}
export function distance(a: { lat: number; lng: number }, b: Venue) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dlat = rad(b.latitude - a.lat),
    dlng = rad(b.longitude - a.lng);
  return (
    6371 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(dlat / 2) ** 2 +
          Math.cos(rad(a.lat)) *
            Math.cos(rad(b.latitude)) *
            Math.sin(dlng / 2) ** 2,
      ),
    )
  );
}
export function filterVenues(
  venues: Venue[],
  filters: {
    q?: string;
    type?: string;
    price?: number;
    tags?: string[];
    open?: boolean;
  },
  now = new Date(),
) {
  return venues.filter(
    (v) =>
      (!filters.q ||
        normalize(`${v.name} ${v.city} ${v.neighborhood}`).includes(
          normalize(filters.q),
        )) &&
      (!filters.type || v.type === filters.type) &&
      (!filters.price || v.price <= filters.price) &&
      (!filters.open || isOpen(v, now)) &&
      (filters.tags ?? []).every((t) => v.tags.includes(t)),
  );
}
