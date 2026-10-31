import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Coffee, ArrowUpRight } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "Pause Café — Les belles adresses du quotidien",
    template: "%s · Pause Café",
  },
  description: "Trouvez votre prochain café de spécialité ou brunch en France.",
  manifest: "/manifest.webmanifest",
  applicationName: "Pause Café",
};
export const viewport: Viewport = { themeColor: "#f8f6f0" };
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>
        <NextIntlClientProvider>
          <header className="site-header">
            <Link className="brand" href="/">
              <span className="brand-icon">
                <Coffee size={23} />
              </span>
              pause café<span className="brand-dot">.</span>
            </Link>
            <nav aria-label="Navigation principale">
              <Link className="nav-discover" href="/">
                Explorer les adresses
              </Link>
              <Link className="owner-link" href="/professionnels">
                Vous êtes un établissement ? <ArrowUpRight size={15} />
              </Link>
              <Link className="login-link" href="/connexion">
                Se connecter
              </Link>
            </nav>
          </header>
          <main>{children}</main>
          <footer>
            <Link className="brand" href="/">
              pause café.
            </Link>
            <p>Un bon café. Une belle rencontre. Une pause à soi.</p>
            <Link href="/avis-et-moderation">Notre politique d’avis</Link>
            <Link href="/villes/paris">Les adresses par ville</Link>
            <span>France · Français · EUR €</span>
            <small>
              © {new Date().getFullYear()} Pause Café ·{" "}
              {process.env.DEMO_MODE !== "false"
                ? "Démonstration — établissements et adresses fictifs."
                : "Données importées : © OpenStreetMap contributors · ODbL. Les fiches de démonstration sont signalées."}
            </small>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
