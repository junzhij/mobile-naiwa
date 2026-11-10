import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const base = process.env.TEST_ORIGIN || "http://localhost:3100";
const databaseUrl = process.env.DATABASE_URL || "";
const defaultStandId = "00000000-0000-4000-8000-000000000001";
if (!databaseUrl.includes("127.0.0.1:55432/naiwa_test")) throw new Error("Refusing to reset any database except the local naiwa_test instance");
if (!process.env.ADMIN_KEY) throw new Error("ADMIN_KEY is required");

const pool = new Pool({ connectionString: databaseUrl });
async function reset() {
  await pool.query("TRUNCATE photos, visits, audit_log, upload_intents, holder_state, stands RESTART IDENTITY CASCADE");
  await pool.query("INSERT INTO stands (id, name) VALUES ($1, '初代奶蛙')", [defaultStandId]);
}
await reset();

async function request(path, method = "GET", body, cookie) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  return { status: response.status, data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

assert.equal((await request("/api/admin/overview")).status, 401);
assert.equal((await request("/api/admin/session", "POST", { key: "wrong" })).status, 401);
const login = await request("/api/admin/session", "POST", { key: process.env.ADMIN_KEY });
assert.equal(login.status, 200);
const cookie = login.cookie;
assert.ok(cookie);
assert.equal((await request("/api/admin/overview", "GET", undefined, cookie)).data.stands.length, 1);

const firstHolder = await request("/api/admin/holder", "POST", { standId: defaultStandId, phone: "13800138000" }, cookie);
assert.equal(firstHolder.status, 200);
assert.match(firstHolder.data.code, /^\d{4}$/);
const created = await request("/api/admin/stands", "POST", { name: "第二只奶蛙", phone: "13800138000" }, cookie);
assert.equal(created.status, 200);
const secondStandId = created.data.stand.id;
let secondCode = created.data.code;
assert.match(secondCode, /^\d{4}$/);
if (secondCode === firstHolder.data.code) {
  const regenerated = await request("/api/admin/holder", "POST", { standId: secondStandId, phone: "13800138000" }, cookie);
  secondCode = regenerated.data.code;
}
assert.equal((await request("/api/stands")).data.stands.length, 2);

const wrongCode = firstHolder.data.code === "0000" ? "0001" : "0000";
for (let attempt = 1; attempt <= 5; attempt++) {
  const response = await request("/api/upload-intent", "POST", { standId: defaultStandId, phone: "13800138000", code: wrongCode, count: 1 });
  assert.equal(response.status, attempt === 5 ? 429 : 403);
}
const unlocked = await request("/api/admin/holder", "POST", { standId: defaultStandId, phone: "13800138000" }, cookie);
assert.equal(unlocked.status, 200);
assert.match(unlocked.data.code, /^\d{4}$/);

const photo = await readFile(new URL("../tests/fixtures/test-frog.webp", import.meta.url));
async function prepare(standId, code) {
  const result = await request("/api/upload-intent", "POST", { standId, phone: "13800138000", code, types: ["image/webp"] });
  assert.equal(result.status, 200);
  const upload = await fetch(result.data.uploads[0].url, { method: "PUT", headers: { "Content-Type": "image/webp" }, body: photo });
  assert.equal(upload.status, 200);
  return result.data.intentId;
}

const firstIntent = await prepare(defaultStandId, unlocked.data.code);
const secondIntent = await prepare(secondStandId, secondCode);
const location = { latitude: 39.92095, longitude: 119.54468, locationSource: "manual", placeName: "本地测试点", caption: "仅用于本地测试" };
const [first, second] = await Promise.all([
  request("/api/handoff", "POST", { standId: defaultStandId, phone: "13800138000", code: unlocked.data.code, nextPhone: "13900139000", intentId: firstIntent, ...location }),
  request("/api/handoff", "POST", { standId: secondStandId, phone: "13800138000", code: secondCode, nextPhone: "13700137000", intentId: secondIntent, ...location }),
]);
assert.equal(first.status, 200);
assert.equal(second.status, 200);
assert.match(first.data.nextCode, /^\d{4}$/);
assert.match(second.data.nextCode, /^\d{4}$/);

const overview = await request("/api/admin/overview", "GET", undefined, cookie);
assert.equal(overview.status, 200);
assert.equal(overview.data.stands.find((stand) => stand.id === defaultStandId).holder.phone, "13900139000");
assert.equal(overview.data.stands.find((stand) => stand.id === secondStandId).holder.phone, "13700137000");
assert.ok(!JSON.stringify(overview.data.logs).includes("13800138000"));

const journey = await request("/api/journey");
assert.equal(journey.status, 200);
assert.equal(journey.data.entries.length, 2);
assert.deepEqual(new Set(journey.data.entries.map((entry) => entry.standName)), new Set(["初代奶蛙", "第二只奶蛙"]));
assert.ok(!JSON.stringify(journey.data).includes("13800138000"));
const photoResponse = await fetch(journey.data.entries[0].photos[0].url);
assert.equal(photoResponse.status, 200);
assert.deepEqual(Buffer.from(await photoResponse.arrayBuffer()), photo);

const bVisit = journey.data.entries.find((entry) => entry.standId === secondStandId);
assert.equal((await request(`/api/admin/visits/${bVisit.id}`, "PATCH", { hidden: true })).status, 401);
assert.equal((await request(`/api/admin/visits/${bVisit.id}`, "PATCH", { hidden: true }, cookie)).status, 200);
assert.equal((await request("/api/journey")).data.entries.length, 1);
assert.equal((await request("/api/locations")).data.locations.length, 1);

assert.equal((await request(`/api/admin/stands/${secondStandId}`, "PATCH", { name: "教学楼奶蛙" }, cookie)).status, 200);
assert.ok((await request("/api/stands")).data.stands.some((stand) => stand.name === "教学楼奶蛙"));
assert.equal((await request(`/api/admin/visits/${bVisit.id}`, "PATCH", { hidden: false }, cookie)).status, 200);
assert.ok((await request("/api/journey")).data.entries.some((entry) => entry.standName === "教学楼奶蛙"));

await reset();
await pool.end();
console.log("Local API smoke test passed: parallel stands, four-digit codes, lockout, uploads, privacy, rename, and hiding");
