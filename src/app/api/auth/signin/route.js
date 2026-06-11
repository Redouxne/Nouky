import { prisma } from "@/lib/db";
import { verifyPassword, validateEmail } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }

    if (!validateEmail(email)) {
      return Response.json({ error: "Email invalide" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return Response.json({ error: "Email ou mot de passe incorrect" }, { status: 401 });
    }

    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid) {
      return Response.json({ error: "Email ou mot de passe incorrect" }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set("userId", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    return Response.json(
      {
        message: "Connexion réussie",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Sign in error:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
