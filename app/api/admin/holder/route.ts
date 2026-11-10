import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { transaction } from "@/lib/db";
import { apiError, AppError, assertSameOrigin } from "@/lib/errors";
import { codeHash, maskPhone, newHandoffCode, normalizePhone, openPhone, phoneHash, sealPhone } from "@/lib/secrets";
import { normalizeStandId } from "@/lib/stands";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    if (!isAdmin(request)) throw new AppError(401, "请先输入管理密钥。");
    const body = await request.json();
    const standId = normalizeStandId(body.standId);
    const phone = normalizePhone(body.phone);
    const code = newHandoffCode();
    await transaction(async (client) => {
      const stand = await client.query("SELECT id FROM stands WHERE id = $1 AND active = true", [standId]);
      if (!stand.rowCount) throw new AppError(404, "立牌不存在。");
      const existing = await client.query<{ phone_ciphertext: string }>("SELECT phone_ciphertext FROM holder_state WHERE stand_id = $1 FOR UPDATE", [standId]);
      if (existing.rows[0]) {
        const oldPhone = openPhone(existing.rows[0].phone_ciphertext);
        await client.query("UPDATE holder_state SET phone_ciphertext = $1, phone_hash = $2, code_hash = $3, version = version + 1, failed_code_attempts = 0, code_locked_until = NULL, code_reset_required = false, updated_at = now() WHERE stand_id = $4", [sealPhone(phone), phoneHash(phone), codeHash(code), standId]);
        await client.query("INSERT INTO audit_log (stand_id, action, detail) VALUES ($1, $2, $3::jsonb)", [standId, oldPhone === phone ? "admin_reset_code" : "admin_change_holder", JSON.stringify({ from: maskPhone(oldPhone), to: maskPhone(phone) })]);
      } else {
        await client.query("INSERT INTO holder_state (stand_id, phone_ciphertext, phone_hash, code_hash) VALUES ($1, $2, $3, $4)", [standId, sealPhone(phone), phoneHash(phone), codeHash(code)]);
        await client.query("INSERT INTO audit_log (stand_id, action, detail) VALUES ($1, 'admin_start', $2::jsonb)", [standId, JSON.stringify({ to: maskPhone(phone) })]);
      }
    });
    return NextResponse.json({ ok: true, standId, phone, code }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
