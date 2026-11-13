import { cookies } from "next/headers";
import { prisma } from "./db";
import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function createSessionCookie(userId) {
  const payload = `${userId}.${Math.floor(Date.now() / 1000)}`;
  const signature = createHmac("sha256", process.env.NEXTAUTH_SECRET).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function verifySessionCookie(value) {
  const parts = String(value || "").split(".");
  if (parts.length !== 3 || !process.env.NEXTAUTH_SECRET) return null;
  const [userId, issued, signature] = parts;
  const age = Math.floor(Date.now() / 1000) - Number(issued);
  if (!userId || !Number.isInteger(Number(issued)) || age < 0 || age > SESSION_MAX_AGE || !/^[0-9a-f]{64}$/.test(signature)) return null;
  const expected = createHmac("sha256", process.env.NEXTAUTH_SECRET).update(`${userId}.${issued}`).digest("hex");
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return userId;
}

export async function getSession() {
  try {
    const cookieStore = await cookies();
    const userId = verifySessionCookie(cookieStore.get("userId")?.value);

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
