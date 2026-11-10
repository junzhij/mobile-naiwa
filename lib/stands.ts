import { AppError } from "./errors";

export const DEFAULT_STAND_ID = "00000000-0000-4000-8000-000000000001";

export function normalizeStandId(value: unknown) {
  if (value === undefined || value === null) return DEFAULT_STAND_ID;
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(400, "请选择立牌。");
  }
  return value.toLowerCase();
}

export function normalizeStandName(value: unknown) {
  if (typeof value !== "string") throw new AppError(400, "请输入立牌名称。");
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > 50) throw new AppError(400, "立牌名称需在 1 至 50 字之间。");
  return name;
}
