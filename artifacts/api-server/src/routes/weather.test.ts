/**
 * Unit tests for weather.ts's pure helpers: coordinate validation and WMO
 * weather-code descriptions. The route handlers themselves need a DB
 * connection (default-location settings) and live network (Open-Meteo),
 * neither of which this suite touches — same DB-free pattern as
 * webFetch.test.ts.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { describeCode, parseCoord } from "./weather.js";

test("parseCoord accepts valid latitude/longitude strings", () => {
  assert.equal(parseCoord("51.5", -90, 90), 51.5);
  assert.equal(parseCoord("-0.12", -180, 180), -0.12);
  assert.equal(parseCoord("0", -90, 90), 0);
});

test("parseCoord rejects out-of-range values", () => {
  assert.equal(parseCoord("91", -90, 90), null);
  assert.equal(parseCoord("-91", -90, 90), null);
  assert.equal(parseCoord("181", -180, 180), null);
});

test("parseCoord rejects non-numeric or missing input", () => {
  assert.equal(parseCoord("not-a-number", -90, 90), null);
  assert.equal(parseCoord(undefined, -90, 90), null);
  assert.equal(parseCoord("", -90, 90), null);
});

test("describeCode maps known WMO codes to readable text", () => {
  assert.equal(describeCode(0), "Clear sky");
  assert.equal(describeCode(61), "Slight rain");
  assert.equal(describeCode(95), "Thunderstorm");
});

test("describeCode falls back gracefully for unknown codes", () => {
  assert.equal(describeCode(9999), "Unknown conditions (code 9999)");
});
