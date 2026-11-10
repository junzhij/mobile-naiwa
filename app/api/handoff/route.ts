import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { database, transaction } from "@/lib/db";
import { apiError, AppError, assertSameOrigin } from "@/lib/errors";
import { verifyHolder } from "@/lib/holder";
import { checkPhoto, copyPhoto, removePhoto } from "@/lib/r2";
import { codeHash, constantTimeEqual, maskPhone, newHandoffCode, normalizePhone, phoneHash, sealPhone } from "@/lib/secrets";

export const runtime = "nodejs";

type Intent = { id: string; stand_id: string; holder_version: string; phone_hash: string; object_keys: string[]; expires_at: Date; consumed_at: Date | null };

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const body = await request.json();
    const holder = await verifyHolder(body.standId, body.phone, body.code);
    const nextPhone = normalizePhone(body.nextPhone);
    if (nextPhone === holder.phone) throw new AppError(400, "下家手机号不能与当前手机号相同。");
    const intentId = typeof body.intentId === "string" ? body.intentId : "";
    if (!/^[0-9a-f-]{36}$/.test(intentId)) throw new AppError(400, "上传凭证无效。");
    const caption = typeof body.caption === "string" ? body.caption.trim().slice(0, 140) : "";
    const placeName = typeof body.placeName === "string" ? body.placeName.trim().slice(0, 50) : "";
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new AppError(400, "请在地图上确认拍照地点。");
    }
    const locationSource = body.locationSource === "gps" ? "gps" : "manual";
    const intentResult = await database().query<Intent>("SELECT * FROM upload_intents WHERE id = $1", [intentId]);
    const intent = intentResult.rows[0];
    if (!intent || intent.stand_id !== holder.standId || intent.consumed_at || new Date(intent.expires_at).getTime() < Date.now() || Number(intent.holder_version) !== holder.version || !constantTimeEqual(intent.phone_hash, phoneHash(holder.phone))) {
      throw new AppError(409, "上传凭证已失效，请重新选择照片。");
    }
    const keys = intent.object_keys;
    if (!Array.isArray(keys) || keys.length < 1 || keys.length > 3) throw new AppError(400, "上传凭证无效。");
    const sizes = await Promise.all(keys.map(async (key) => {
      try { return await checkPhoto(key); }
      catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(400, "照片尚未上传完成，请稍后再试。");
      }
    }));
    const nextCode = newHandoffCode();
    const visitId = randomUUID();
    const finalKeys = keys.map((key) => `photos/${visitId}/${randomUUID()}.${key.endsWith(".jpg") ? "jpg" : "webp"}`);
    const copied: string[] = [];
    try {
      for (let index = 0; index < keys.length; index++) {
        await copyPhoto(keys[index], finalKeys[index]);
        copied.push(finalKeys[index]);
      }
      await transaction(async (client) => {
      const lockedHolder = await client.query<{ phone_hash: string; code_hash: string; version: string }>("SELECT phone_hash, code_hash, version FROM holder_state WHERE stand_id = $1 FOR UPDATE", [holder.standId]);
      const state = lockedHolder.rows[0];
      if (!state || Number(state.version) !== holder.version || !constantTimeEqual(state.phone_hash, phoneHash(holder.phone)) || !constantTimeEqual(state.code_hash, codeHash(holder.code))) {
        throw new AppError(409, "奶蛙已经交给下一位啦，请刷新页面。");
      }
      const lockedIntent = await client.query<Intent>("SELECT * FROM upload_intents WHERE id = $1 FOR UPDATE", [intentId]);
      if (!lockedIntent.rows[0] || lockedIntent.rows[0].stand_id !== holder.standId || lockedIntent.rows[0].consumed_at || new Date(lockedIntent.rows[0].expires_at).getTime() < Date.now()) {
        throw new AppError(409, "上传凭证已被使用或过期。");
      }
      await client.query(
        "INSERT INTO visits (id, stand_id, caption, place_name, latitude, longitude, location_source) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [visitId, holder.standId, caption || null, placeName || null, latitude, longitude, locationSource]
      );
      for (let index = 0; index < keys.length; index++) {
        await client.query("INSERT INTO photos (id, visit_id, object_key, sort_order, size_bytes) VALUES ($1, $2, $3, $4, $5)", [randomUUID(), visitId, finalKeys[index], index, sizes[index]]);
      }
      await client.query("UPDATE holder_state SET phone_ciphertext = $1, phone_hash = $2, code_hash = $3, version = version + 1, failed_code_attempts = 0, code_locked_until = NULL, updated_at = now() WHERE stand_id = $4", [sealPhone(nextPhone), phoneHash(nextPhone), codeHash(nextCode), holder.standId]);
      await client.query("UPDATE upload_intents SET consumed_at = now() WHERE id = $1", [intentId]);
      await client.query("INSERT INTO audit_log (stand_id, action, detail) VALUES ($1, 'handoff', $2::jsonb)", [holder.standId, JSON.stringify({ visitId, from: maskPhone(holder.phone), to: maskPhone(nextPhone), photoCount: keys.length })]);
      });
    } catch (error) {
      await Promise.allSettled(copied.map(removePhoto));
      if (error instanceof AppError && error.status === 409) {
        await Promise.allSettled(keys.map(removePhoto));
        await database().query("DELETE FROM upload_intents WHERE id = $1 AND stand_id = $2 AND consumed_at IS NULL", [intentId, holder.standId]).catch(() => {});
      }
      throw error;
    }
    await Promise.allSettled(keys.map(removePhoto));
    return NextResponse.json({ ok: true, visitId, standName: holder.standName, nextCode, nextPhone: maskPhone(nextPhone) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
