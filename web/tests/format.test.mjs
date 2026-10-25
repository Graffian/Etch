import assert from "node:assert/strict";
import test from "node:test";

import { formatBytes } from "../lib/format.ts";

test("formatBytes formats zero", () => {
  assert.equal(formatBytes(0), "0 B");
});

test("formatBytes formats byte values", () => {
  assert.equal(formatBytes(1), "1 B");
  assert.equal(formatBytes(999), "999 B");
});

test("formatBytes formats KiB values", () => {
  assert.equal(formatBytes(1024), "1 KiB");
  assert.equal(formatBytes(1536), "1.5 KiB");
});

test("formatBytes formats MiB values", () => {
  assert.equal(formatBytes(1024 ** 2), "1 MiB");
  assert.equal(formatBytes(5 * 1024 ** 2), "5 MiB");
});

test("formatBytes formats large values with the largest fitting unit", () => {
  assert.equal(formatBytes(1024 ** 4), "1 TiB");
  assert.equal(formatBytes(2.5 * 1024 ** 5), "2.5 PiB");
});
