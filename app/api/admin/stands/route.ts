import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { transaction } from "@/lib/db";
import { apiError, AppError, assertSameOrigin } from "@/lib/errors";
import { codeHash, maskPhone, newHandoffCode, normalizePhone, phoneHash, sealPhone } from "@/lib/secrets";
import { normalizeStandName } from "@/lib/stands";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    if (!isAdmin(request)) throw new AppError(401, "请先输入管理密钥。");
    const body = await request.json();
    const name = normalizeStandName(body.name);
    const phone = normalizePhone(body.phone);
    const id = randomUUID();
    const code = newHandoffCode();
    try {
      await transaction(async (client) => {
        await client.query("INSERT INTO stands (id, name) VALUES ($1, $2)", [id, name]);
        await client.query(
          "INSERT INTO holder_state (stand_id, phone_ciphertext, phone_hash, code_hash) VALUES ($1, $2, $3, $4)",
          [id, sealPhone(phone), phoneHash(phone), codeHash(code)]
        );
        await client.query("INSERT INTO audit_log (stand_id, action, detail) VALUES ($1, 'admin_start', $2::jsonb)", [id, JSON.stringify({ to: maskPhone(phone) })]);
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new AppError(409, "这个立牌名称已经存在。");
      throw error;
    }
    return NextResponse.json({ ok: true, stand: { id, name }, code }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
