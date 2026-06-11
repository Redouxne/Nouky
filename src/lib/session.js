import { cookies } from "next/headers";
import { prisma } from "./db";

export async function getSession() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    return user;
  } catch (error) {
    return null;
  }
}
