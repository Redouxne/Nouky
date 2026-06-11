import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import NoukyApp from "@/components/NoukyApp";

export const metadata = {
  title: "Dashboard - Nouky",
  description: "Simulation de consultation medicale pour l'entrainement clinique.",
};

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth/signin");
  }

  return <NoukyApp user={session} />;
}
