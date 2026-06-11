import { prisma } from "@/lib/db";
import { hashPassword, validateEmail, validatePassword } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return Response.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }

    if (!validateEmail(email)) {
      return Response.json({ error: "Email invalide" }, { status: 400 });
    }

    if (!validatePassword(password)) {
      return Response.json(
        { error: "Le mot de passe doit contenir au moins 8 caractères" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return Response.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || undefined,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set("userId", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    return Response.json(
      {
        message: "Compte créé avec succès",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Sign up error:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
