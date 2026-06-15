import "./globals.css";

export const metadata = {
  title: "Nouky",
  description: "Dossiers, corrections et revisions pour l'internat de pharmacie.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
