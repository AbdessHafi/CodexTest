export type Venue = {
  id: string;
  slug: string;
  name: string;
  city: string;
  neighborhood: string;
  address: string;
  latitude: number;
  longitude: number;
  type: string;
  price: number;
  tags: string[];
  description: string;
  source: string;
  claimed: boolean;
  photo: number;
  menu: { name: string; price: number; description: string }[];
  hours: { day: number; open: string; close: string }[];
};
const cities = [
  {
    name: "Paris",
    lat: 48.8566,
    lng: 2.3522,
    areas: [
      "Le Marais",
      "Bastille",
      "Montmartre",
      "République",
      "Canal Saint-Martin",
    ],
  },
  {
    name: "Lyon",
    lat: 45.764,
    lng: 4.8357,
    areas: [
      "Croix-Rousse",
      "Presqu’île",
      "Guillotière",
      "Vieux Lyon",
      "Confluence",
    ],
  },
  {
    name: "Marseille",
    lat: 43.2965,
    lng: 5.3698,
    areas: ["Le Panier", "Cours Julien", "Vieux-Port", "La Plaine", "Endoume"],
  },
  {
    name: "Bordeaux",
    lat: 44.8378,
    lng: -0.5792,
    areas: ["Chartrons", "Saint-Pierre", "Saint-Michel", "Bastide", "Victoire"],
  },
  {
    name: "Lille",
    lat: 50.6292,
    lng: 3.0573,
    areas: ["Vieux-Lille", "Wazemmes", "Centre", "Vauban", "Saint-Maurice"],
  },
];
const names = [
  "Maison Aube",
  "Les Grains Heureux",
  "Dimanche Matin",
  "Atelier Moka",
  "La Parenthèse",
  "Table & Tartine",
  "Le Jardin Infusé",
  "Café Pollen",
  "Les Petits Jours",
  "Brume Café",
];
export const venueTypes = [
  "Coffee shop",
  "Brunch",
  "Boulangerie-café",
  "Salon de thé",
];
export const allTags = [
  "Végétarien",
  "Vegan",
  "Sans gluten",
  "Halal",
  "Terrasse",
  "Wifi",
  "Ordinateurs bienvenus",
  "Enfants bienvenus",
  "Accessible",
];
export const demoVenues: Venue[] = cities.flatMap((city, c) =>
  names.map((name, i) => ({
    id: `demo-${c}-${i}`,
    slug: `${["paris", "lyon", "marseille", "bordeaux", "lille"][c]}-${i + 1}`,
    name,
    city: city.name,
    neighborhood: city.areas[i % 5],
    address: `${12 + i * 3} rue des Jardins (adresse fictive)`,
    latitude: city.lat + ((i % 5) - 2) * 0.006,
    longitude: city.lng + (Math.floor(i / 5) - 0.5) * 0.014,
    type: venueTypes[i % 4],
    price: (i % 3) + 1,
    tags: allTags.filter((_, t) => (i + t) % 3 === 0),
    description:
      "Un refuge lumineux pour ralentir, savourer un café de spécialité et partager une cuisine de saison. Pâtisseries maison et accueil attentionné au fil de la journée.",
    claimed: false,
    source: "DEMO",
    photo: i % 3,
    menu: [
      {
        name: "Flat white",
        price: 450,
        description: "Double espresso, lait onctueux.",
      },
      {
        name: "Tartine de saison",
        price: 1250,
        description: "Pain au levain et légumes du marché.",
      },
      {
        name: "Formule brunch",
        price: 2600,
        description: "Une assiette, une douceur et une boisson chaude.",
      },
    ],
    hours: Array.from({ length: 7 }, (_, day) => ({
      day,
      open: day === 0 ? "09:00" : "08:30",
      close: day === 0 ? "16:00" : "18:00",
    })),
  })),
);
export const cityNames = cities.map((c) => c.name);
