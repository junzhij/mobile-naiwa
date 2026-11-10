import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { database, transaction } from "@/lib/db";
import { apiError, AppError, assertSameOrigin } from "@/lib/errors";
import { verifyHolder } from "@/lib/holder";
import { removePhoto, signedUpload } from "@/lib/r2";
import { constantTimeEqual, phoneHash } from "@/lib/secrets";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    const { standId, phone, version } = await verifyHolder(body.standId, body.phone, body.code);
    const fallbackCount = Number(body.count);
    if (!Array.isArray(body.types) && (!Number.isInteger(fallbackCount) || fallbackCount < 1 || fallbackCount > 3)) {
      throw new AppError(400, "每次请选择 1 至 3 张照片。");
    }
    const types: string[] = Array.isArray(body.types)
      ? body.types
      : Array.from({ length: fallbackCount }, () => "image/webp");
    if (types.length < 1 || types.length > 3 || types.some((type) => type !== "image/webp" && type !== "image/jpeg")) {
      throw new AppError(400, "每次请选择 1 至 3 张 JPG 或 WebP 照片。");
    }
    const active = await database().query<{ count: string }>(
      "SELECT count(*)::text AS count FROM upload_intents WHERE stand_id = $1 AND phone_hash = $2 AND expires_at > now() AND consumed_at IS NULL",
      [standId, phoneHash(phone)]
    );
    if (Number(active.rows[0].count) >= 4) throw new AppError(429, "短时间内上传次数过多，请十分钟后再试。");
    const id = randomUUID();
    const keys = types.map((type) => `pending/${id}/${randomUUID()}.${type === "image/jpeg" ? "jpg" : "webp"}`);
    const uploads = await Promise.all(keys.map(async (key) => ({ key, url: await signedUpload(key) })));
    await database().query(
      "INSERT INTO upload_intents (id, stand_id, holder_version, phone_hash, object_keys, expires_at) VALUES ($1, $2, $3, $4, $5::jsonb, now() + interval '10 minutes')",
      [id, standId, version, phoneHash(phone), JSON.stringify(keys)]
    );
    return NextResponse.json({ intentId: id, uploads }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    const holder = await verifyHolder(body.standId, body.phone, body.code);
    const intentId = typeof body.intentId === "string" ? body.intentId : "";
    if (!/^[0-9a-f-]{36}$/.test(intentId)) throw new AppError(400, "上传凭证无效。");
    const keys = await transaction(async (client) => {
      const result = await client.query<{ stand_id: string; holder_version: string; phone_hash: string; object_keys: string[]; consumed_at: Date | null }>("SELECT stand_id, holder_version, phone_hash, object_keys, consumed_at FROM upload_intents WHERE id = $1 FOR UPDATE", [intentId]);
      const intent = result.rows[0];
      if (!intent || intent.stand_id !== holder.standId || intent.consumed_at || Number(intent.holder_version) !== holder.version || !constantTimeEqual(intent.phone_hash, phoneHash(holder.phone))) return [];
      await client.query("DELETE FROM upload_intents WHERE id = $1", [intentId]);
      return intent.object_keys;
    });
    await Promise.allSettled(keys.map(removePhoto));
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
