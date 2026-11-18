import { menuInput } from "./policy";
export const csvHeaders = [
  "name",
  "category",
  "price_eur",
  "description",
  "tags",
  "allergens",
  "available",
  "special_start",
  "special_end",
  "featured_start",
  "featured_end",
];
export function csvRows(input: string) {
  if (input.length > 150000) throw new Error("CSV trop volumineux.");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const s = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (quoted && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Guillemet CSV non fermé.");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
export function importMenuCsv(input: string) {
  const [header, ...rows] = csvRows(input);
  if (!header || header.join(",") !== csvHeaders.join(","))
    throw new Error("En-tête CSV incorrect. Téléchargez le modèle.");
  if (!rows.length || rows.length > 100)
    throw new Error("De 1 à 100 produits attendus.");
  return rows.map((r, i) => {
    if (r.length !== csvHeaders.length)
      throw new Error(`Ligne ${i + 2} : nombre de colonnes incorrect.`);
    const [
      name,
      category,
      price,
      description,
      tags,
      allergens,
      available,
      specialDate,
      specialEndDate,
      featuredStart,
      featuredEnd,
    ] = r;
    if (
      !/^\d+(\.\d{1,2})?$/.test(price) ||
      !["true", "false"].includes(available)
    )
      throw new Error(`Ligne ${i + 2} : prix ou disponibilité invalide.`);
    return menuInput.parse({
      name,
      category,
      price: Math.round(Number(price) * 100),
      description,
      tags: tags.split("|").filter(Boolean),
      allergens: allergens.split("|").filter(Boolean),
      available: available === "true",
      specialDate: specialDate || null,
      specialEndDate: specialEndDate || null,
      featuredStart: featuredStart || null,
      featuredEnd: featuredEnd || null,
    });
  });
}
const cell = (value: unknown) => {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
};
export function exportMenuCsv(
  items: {
    name: string;
    category: string;
    price: number;
    description: string;
    tags: string[];
    allergens: string[];
    available: boolean;
    specialDate: string | null;
    specialEndDate: string | null;
    featuredStart: string | null;
    featuredEnd: string | null;
  }[],
) {
  return (
    "\uFEFF" +
    [
      csvHeaders.join(","),
      ...items.map((m) =>
        [
          m.name,
          m.category,
          (m.price / 100).toFixed(2),
          m.description,
          m.tags.join("|"),
          m.allergens.join("|"),
          String(m.available),
          m.specialDate,
          m.specialEndDate,
          m.featuredStart,
          m.featuredEnd,
        ]
          .map(cell)
          .join(","),
      ),
    ].join("\r\n")
  );
}
