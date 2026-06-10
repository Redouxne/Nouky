import "./globals.css";

export const metadata = {
  title: "Nouky",
  description: "Simulation de consultation medicale pour l'entrainement clinique.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
