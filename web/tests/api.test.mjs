import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiError,
  getProof,
  submitHash,
  verifyCertificate,
} from "../lib/api.ts";

const CERT = {
  version: 1,
  file_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  leaf_index: 0,
  steps: [],
  root: "4e59bf27372b1304bc0b137d1be9d566ad58b154b6a6b5778af7f414b1d4b84c",
  anchor: {
    chain: "mock",
    tx_hash: "0xabc",
    block_number: 1,
    block_time: "2026-10-25T00:00:00Z",
  },
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("submitHash posts the hash and parses the status", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse(202, { hash: CERT.file_hash, status: "pending" });
  };

  const result = await submitHash(CERT.file_hash);
  assert.equal(result.status, "pending");
  assert.equal(result.hash, CERT.file_hash);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(JSON.parse(calls[0].init.body).hash, CERT.file_hash);
});

test("submitHash surfaces the backend error message", async () => {
  globalThis.fetch = async () =>
    jsonResponse(400, { error: "Hash must be hex" });

  await assert.rejects(submitHash("nope"), (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 400);
    assert.match(err.message, /Hash must be hex/);
    return true;
  });
});

test("getProof returns pending for 202 and a parsed certificate for 200", async () => {
  globalThis.fetch = async () =>
    jsonResponse(202, { hash: CERT.file_hash, status: "pending" });
  const pending = await getProof(CERT.file_hash);
  assert.equal(pending.kind, "pending");

  globalThis.fetch = async () => jsonResponse(200, CERT);
  const confirmed = await getProof(CERT.file_hash);
  assert.equal(confirmed.kind, "confirmed");
  assert.equal(confirmed.certificate.file_hash, CERT.file_hash);
  assert.equal(confirmed.certificate.anchor.block_number, 1);
});

test("getProof throws on an unknown hash", async () => {
  globalThis.fetch = async () => jsonResponse(404, { error: "unknown hash" });
  await assert.rejects(getProof(CERT.file_hash), (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 404);
    return true;
  });
});

test("verifyCertificate posts the certificate and returns the verdict", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse(200, { valid: true });
  };

  const result = await verifyCertificate(CERT);
  assert.equal(result.valid, true);
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), CERT);
});
