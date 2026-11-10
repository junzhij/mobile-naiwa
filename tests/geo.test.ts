import assert from "node:assert/strict";
import { test } from "node:test";
import { gcj02ToWgs84, wgs84ToGcj02 } from "../lib/geo";

test("campus GPS points round-trip through the AMap display conversion", () => {
  const original = { latitude: 39.92095, longitude: 119.54468 };
  const displayed = wgs84ToGcj02(original);
  assert.ok(Math.abs(displayed.latitude - original.latitude) > 0.0001);
  assert.ok(Math.abs(displayed.longitude - original.longitude) > 0.0001);
  const restored = gcj02ToWgs84(displayed);
  assert.ok(Math.abs(restored.latitude - original.latitude) < 0.000001);
  assert.ok(Math.abs(restored.longitude - original.longitude) < 0.000001);
});

test("coordinates outside China stay unchanged", () => {
  const point = { latitude: 48.8584, longitude: 2.2945 };
  assert.deepEqual(wgs84ToGcj02(point), point);
  assert.deepEqual(gcj02ToWgs84(point), point);
});
