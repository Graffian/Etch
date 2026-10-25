import assert from "node:assert/strict";
import test from "node:test";

test("Node built-in test runner works", () => {
  assert.equal(1 + 1, 2);
});
