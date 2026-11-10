import assert from "node:assert/strict";
import { test } from "node:test";
import { codeHash, constantTimeEqual, newHandoffCode, normalizeCode, normalizePhone, openPhone, phoneHash, sealPhone } from "../lib/secrets";

process.env.ADMIN_KEY = "local-test-key-with-more-than-thirty-two-characters";

test("phone normalization and encryption", () => {
  const phone = normalizePhone("+86 138 0013 8000");
  assert.equal(phone, "13800138000");
  assert.equal(openPhone(sealPhone(phone)), phone);
  assert.notEqual(sealPhone(phone), sealPhone(phone));
  assert.equal(phoneHash(phone), phoneHash("13800138000"));
  assert.throws(() => normalizePhone("12345"));
});

test("handoff code is random, normalized, and separately hashed", () => {
  const a = newHandoffCode();
  assert.match(a, /^\d{4}$/);
  assert.equal(normalizeCode(a), a);
  assert.ok(new Set(Array.from({ length: 20 }, newHandoffCode)).size > 1);
  assert.notEqual(codeHash(a), phoneHash(a));
  assert.ok(constantTimeEqual(codeHash(a), codeHash(a)));
  assert.ok(!constantTimeEqual(codeHash(a), codeHash("not-a-valid-code")));
});
