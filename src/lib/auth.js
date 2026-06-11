import bcryptjs from "bcryptjs";

export async function hashPassword(password) {
  return bcryptjs.hash(password, 10);
}

export async function verifyPassword(password, hashedPassword) {
  return bcryptjs.compare(password, hashedPassword);
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password) {
  return password.length >= 8;
}
