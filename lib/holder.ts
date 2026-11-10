import { database } from "./db";
import { AppError } from "./errors";
import { codeHash, constantTimeEqual, normalizeCode, normalizePhone, phoneHash } from "./secrets";
import { normalizeStandId } from "./stands";

type HolderRow = {
  phone_hash: string;
  code_hash: string;
  version: string;
  failed_code_attempts: number;
  code_locked_until: Date | null;
  code_reset_required: boolean;
  name: string;
  active: boolean;
};

export async function verifyHolder(rawStandId: unknown, rawPhone: unknown, rawCode: unknown) {
  const standId = normalizeStandId(rawStandId);
  const phone = normalizePhone(rawPhone);
  const code = normalizeCode(rawCode);
  const client = await database().connect();
  let issue: AppError | null = null;
  let version: number | null = null;
  let standName = "";
  try {
    await client.query("BEGIN");
    const result = await client.query<HolderRow>(
      `SELECT h.phone_hash, h.code_hash, h.version, h.failed_code_attempts, h.code_locked_until,
              h.code_reset_required, s.name, s.active
       FROM holder_state h JOIN stands s ON s.id = h.stand_id
       WHERE h.stand_id = $1 FOR UPDATE OF h`, [standId]
    );
    const holder = result.rows[0];
    if (!holder || !holder.active) {
      issue = new AppError(409, "此立牌尚未开始流动，请联系管理员。");
    } else if (holder.code_reset_required) {
      issue = new AppError(409, "此立牌需要管理员重置为 4 位交接码。");
    } else {
      const lockedUntil = holder.code_locked_until ? new Date(holder.code_locked_until).getTime() : 0;
      const now = Date.now();
      const attempts = lockedUntil && lockedUntil <= now ? 0 : holder.failed_code_attempts;
      if (lockedUntil > now) {
        issue = new AppError(429, "交接码尝试过多，请 15 分钟后重试或联系管理员。");
      } else if (!constantTimeEqual(holder.phone_hash, phoneHash(phone))) {
        issue = new AppError(403, "手机号或交接码不正确。");
      } else if (!constantTimeEqual(holder.code_hash, codeHash(code))) {
        const nextAttempts = attempts + 1;
        await client.query(
          "UPDATE holder_state SET failed_code_attempts = $1, code_locked_until = $2 WHERE stand_id = $3",
          [nextAttempts, nextAttempts >= 5 ? new Date(now + 15 * 60_000) : null, standId]
        );
        issue = nextAttempts >= 5
          ? new AppError(429, "交接码尝试过多，请 15 分钟后重试或联系管理员。")
          : new AppError(403, "手机号或交接码不正确。");
      } else {
        if (attempts || holder.code_locked_until) {
          await client.query("UPDATE holder_state SET failed_code_attempts = 0, code_locked_until = NULL WHERE stand_id = $1", [standId]);
        }
        version = Number(holder.version);
        standName = holder.name;
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  if (issue) throw issue;
  if (version === null) throw new AppError(500, "立牌状态暂时不可用。");
  return { standId, standName, phone, code, version };
}
