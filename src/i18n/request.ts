import { getRequestConfig } from "next-intl/server";
export default getRequestConfig(async () => ({
  locale: "fr",
  timeZone: "Europe/Paris",
  messages: {
    Common: {
      brand: "Pause Café",
      tagline: "Les bonnes adresses, les vrais bons moments.",
    },
  },
}));
