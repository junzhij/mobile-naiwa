import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { AppError } from "./errors";

export function adminKey() {
  const key = process.env.ADMIN_KEY;
  if (!key || key.length < 32) throw new AppError(503, "管理密钥尚未配置。请联系站点管理员。 ");
  return key;
}

export function constantTimeEqual(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

function digest(label: string, value: string) {
  return createHmac("sha256", adminKey()).update(`${label}:${value}`).digest("hex");
}

export function normalizePhone(value: unknown) {
  if (typeof value !== "string") throw new AppError(400, "请输入中国大陆手机号。");
  const compact = value.replace(/[\s()-]/g, "");
  const phone = compact.startsWith("+86") ? compact.slice(3) : compact;
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new AppError(400, "请输入有效的中国大陆手机号。");
  return phone;
}

export function phoneHash(phone: string) {
  return digest("phone", phone);
}

export function normalizeCode(value: unknown) {
  if (typeof value !== "string") throw new AppError(400, "请输入交接码。");
  const code = value.trim();
  if (!/^\d{4}$/.test(code)) throw new AppError(400, "请输入 4 位数字交接码。");
  return code;
}

export function codeHash(code: string) {
  return digest("handoff", code);
}

export function newHandoffCode() {
  return randomInt(0, 10_000).toString().padStart(4, "0");
}

export function sealPhone(phone: string) {
  const key = createHash("sha256").update(`phone-encryption:${adminKey()}`).digest();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([cipher.update(phone, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function openPhone(sealed: string) {
  const key = createHash("sha256").update(`phone-encryption:${adminKey()}`).digest();
  const data = Buffer.from(sealed, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}

export function maskPhone(phone: string) {
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}
