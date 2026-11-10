import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { transaction } from "@/lib/db";
import { apiError, AppError, assertSameOrigin } from "@/lib/errors";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    if (!isAdmin(request)) throw new AppError(401, "请先输入管理密钥。");
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new AppError(400, "记录编号无效。");
    const body = await request.json();
    if (typeof body.hidden !== "boolean") throw new AppError(400, "请指定显示状态。");
    await transaction(async (client) => {
      const result = await client.query<{ stand_id: string }>("UPDATE visits SET hidden = $1 WHERE id = $2 RETURNING stand_id", [body.hidden, id]);
      if (!result.rowCount) throw new AppError(404, "记录不存在。");
      await client.query("INSERT INTO audit_log (stand_id, action, detail) VALUES ($1, $2, $3::jsonb)", [result.rows[0].stand_id, body.hidden ? "admin_hide_visit" : "admin_show_visit", JSON.stringify({ visitId: id })]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
