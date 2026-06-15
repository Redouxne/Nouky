import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import NoukyApp from "@/components/NoukyApp";

export const metadata = {
  title: "Dashboard - Nouky",
  description: "Plateforme d'entrainement aux dossiers de l'internat de pharmacie.",
};

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/signin");
  }

  return <NoukyApp user={session} />;
}
