import { cookies } from "next/headers";

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("userId");

    return Response.json({ message: "Déconnexion réussie" }, { status: 200 });
  } catch (error) {
    console.error("Logout error:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
