import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { adminKey, constantTimeEqual } from "./secrets";

export const COOKIE_NAME = "naiwa_admin";
const SESSION_SECONDS = 60 * 60 * 12;

export function makeAdminSession() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", adminKey()).update(`admin-session:${issuedAt}`).digest("hex");
  return { value: `${issuedAt}.${signature}`, maxAge: SESSION_SECONDS };
}

export function isAdmin(request: NextRequest) {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const [issued, signature] = raw.split(".");
  const issuedAt = Number(issued);
  if (!Number.isSafeInteger(issuedAt) || !signature || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now + 60 || now - issuedAt > SESSION_SECONDS) return false;
  const expected = createHmac("sha256", adminKey()).update(`admin-session:${issuedAt}`).digest("hex");
  return constantTimeEqual(signature, expected);
}
