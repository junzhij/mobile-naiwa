import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, makeAdminSession } from "@/lib/admin-session";
import { apiError, AppError, assertSameOrigin } from "@/lib/errors";
import { adminKey, constantTimeEqual } from "@/lib/secrets";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    if (typeof body.key !== "string" || !constantTimeEqual(body.key, adminKey())) throw new AppError(401, "管理密钥不正确。");
    const session = makeAdminSession();
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(COOKIE_NAME, session.value, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: session.maxAge });
    return response;
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(COOKIE_NAME);
    return response;
  } catch (error) { return apiError(error); }
}
