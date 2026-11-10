import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { transaction } from "@/lib/db";
import { apiError, AppError, assertSameOrigin } from "@/lib/errors";
import { normalizeStandId, normalizeStandName } from "@/lib/stands";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    if (!isAdmin(request)) throw new AppError(401, "请先输入管理密钥。");
    const { id } = await context.params;
    const standId = normalizeStandId(id);
    const body = await request.json();
    const name = normalizeStandName(body.name);
    try {
      await transaction(async (client) => {
        const current = await client.query<{ name: string }>("SELECT name FROM stands WHERE id = $1 FOR UPDATE", [standId]);
        if (!current.rowCount) throw new AppError(404, "立牌不存在。");
        if (current.rows[0].name === name) return;
        await client.query("UPDATE stands SET name = $1 WHERE id = $2", [name, standId]);
        await client.query("INSERT INTO audit_log (stand_id, action, detail) VALUES ($1, 'admin_rename_stand', $2::jsonb)", [standId, JSON.stringify({ from: current.rows[0].name, to: name })]);
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new AppError(409, "这个立牌名称已经存在。");
      throw error;
    }
    return NextResponse.json({ ok: true, standId, name });
  } catch (error) { return apiError(error); }
}
