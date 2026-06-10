import crypto from "node:crypto";

function getKey() {
  const secret = process.env.CASE_TOKEN_SECRET || process.env.MISTRAL_API_KEY;
  if (!secret) {
    throw new Error("Missing token secret");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function toBase64Url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url");
}

export function sealCase(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [toBase64Url(iv), toBase64Url(tag), toBase64Url(encrypted)].join(".");
}

export function openCase(token) {
  const [ivValue, tagValue, encryptedValue] = String(token || "").split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Invalid case token");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), fromBase64Url(ivValue));
  decipher.setAuthTag(fromBase64Url(tagValue));
  const decrypted = Buffer.concat([
    decipher.update(fromBase64Url(encryptedValue)),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}
