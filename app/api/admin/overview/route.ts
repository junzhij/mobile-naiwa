import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-session";
import { database } from "@/lib/db";
import { apiError, AppError } from "@/lib/errors";
import { openPhone } from "@/lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    if (!isAdmin(request)) throw new AppError(401, "请先输入管理密钥。");
    const [standRows, logs, visits] = await Promise.all([
      database().query<{ id: string; name: string; active: boolean; phone_ciphertext: string | null; version: string | null; updated_at: Date | null; code_reset_required: boolean | null }>(
        "SELECT s.id, s.name, s.active, h.phone_ciphertext, h.version, h.updated_at, h.code_reset_required FROM stands s LEFT JOIN holder_state h ON h.stand_id = s.id ORDER BY s.created_at, s.id"
      ),
      database().query("SELECT l.id, l.created_at, l.action, l.detail, l.stand_id, s.name AS stand_name FROM audit_log l JOIN stands s ON s.id = l.stand_id ORDER BY l.id DESC LIMIT 100"),
      database().query("SELECT v.id, v.sequence, v.created_at, v.place_name, v.hidden, v.stand_id, s.name AS stand_name FROM visits v JOIN stands s ON s.id = v.stand_id ORDER BY v.sequence DESC LIMIT 100"),
    ]);
    return NextResponse.json({
      stands: standRows.rows.map((row) => ({
        id: row.id, name: row.name, active: row.active,
        holder: row.phone_ciphertext ? {
          phone: openPhone(row.phone_ciphertext), version: Number(row.version), updatedAt: row.updated_at,
          codeResetRequired: row.code_reset_required,
        } : null,
      })),
      logs: logs.rows,
      visits: visits.rows.map((row) => ({ ...row, sequence: Number(row.sequence) })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
