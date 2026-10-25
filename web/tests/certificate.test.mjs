import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCertificate, parseDemoExport } from "../lib/certificate.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesPath = path.join(__dirname, "fixtures", "merkle-vectors.json");
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));

test("parseCertificate accepts backend-shaped Certificate JSON from fixtures (Go field names/casing)", () => {
  for (const f of fixtures) {
    const cert = parseCertificate(f.certificate);
    assert.ok(cert);
    assert.equal(typeof cert.version, "number");
    assert.equal(cert.version, 1);
    assert.match(cert.file_hash, /^[0-9a-f]{64}$/);
    assert.match(cert.root, /^[0-9a-f]{64}$/);
    assert.equal(typeof cert.leaf_index, "number");
    assert.equal(cert.leaf_index >= 0, true);
    assert.ok(Array.isArray(cert.steps));
    assert.ok(cert.anchor);
    assert.equal(typeof cert.anchor.chain, "string");
    assert.equal(typeof cert.anchor.tx_hash, "string");
    assert.equal(typeof cert.anchor.block_number, "number");
    assert.equal(cert.anchor.block_number >= 0, true);
    assert.equal(typeof cert.anchor.block_time, "string");
    assert.match(cert.anchor.block_time, /T/);
  }
});

test("parseCertificate handles nested anchor and step shape {hash,left}", () => {
  const twoZero = fixtures.find(f => f.name === "two-leaves-proof-index-0");
  const cert = parseCertificate(twoZero.certificate);
  assert.ok(Array.isArray(cert.steps));
  assert.equal(cert.steps.length >= 1, true);
  const step = cert.steps[0];
  assert.ok(Object.prototype.hasOwnProperty.call(step, "hash"));
  assert.ok(Object.prototype.hasOwnProperty.call(step, "left"));
  assert.match(step.hash, /^[0-9a-f]{64}$/);
  assert.equal(typeof step.left, "boolean");
});

test("parseCertificate accepts zero-time sentinel anchor (Go zero time)", () => {
  for (const f of fixtures) {
    const cert = parseCertificate(f.certificate);
    assert.equal(cert.anchor.block_time, "0001-01-01T00:00:00Z");
  }
});

test("parseDemoExport accepts valid demo wrapper with kind etch-demo-export, simulated true, warning, anchor_status not-performed", () => {
  const baseCert = fixtures[0].certificate;
  const demo = {
    kind: "etch-demo-export",
    simulated: true,
    warning: "some warning",
    anchor_status: "not-performed",
    certificate: baseCert
  };
  const parsed = parseDemoExport(demo);
  assert.ok(parsed);
  assert.equal(parsed.kind, "etch-demo-export");
  assert.equal(parsed.simulated, true);
  assert.equal(typeof parsed.warning, "string");
  assert.equal(parsed.anchor_status, "not-performed");
  assert.ok(parsed.certificate);
});

test("parseCertificate rejects malformed/missing/wrongly typed fields", () => {
  assert.throws(() => parseCertificate({}));
  assert.throws(() => parseCertificate({
    version: "1",
    file_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    leaf_index: 0,
    steps: [],
    root: "4e59bf27372b1304bc0b137d1be9d566ad58b154b6a6b5778af7f414b1d4b84c",
    anchor: { chain: "", tx_hash: "", block_number: 0, block_time: "0001-01-01T00:00:00Z" }
  }));
  assert.throws(() => parseCertificate({
    version: 1,
    file_hash: "zzzz",
    leaf_index: 0,
    steps: [],
    root: "4e59bf27372b1304bc0b137d1be9d566ad58b154b6a6b5778af7f414b1d4b84c",
    anchor: { chain: "", tx_hash: "", block_number: 0, block_time: "0001-01-01T00:00:00Z" }
  }));
  assert.throws(() => parseCertificate({
    version: 1,
    file_hash: "abcd",
    leaf_index: 0,
    steps: [],
    root: "4e59bf27372b1304bc0b137d1be9d566ad58b154b6a6b5778af7f414b1d4b84c",
    anchor: { chain: "", tx_hash: "", block_number: 0, block_time: "0001-01-01T00:00:00Z" }
  }));
  assert.throws(() => parseCertificate({
    version: 1,
    file_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    leaf_index: -1,
    steps: [],
    root: "4e59bf27372b1304bc0b137d1be9d566ad58b154b6a6b5778af7f414b1d4b84c",
    anchor: { chain: "", tx_hash: "", block_number: 0, block_time: "0001-01-01T00:00:00Z" }
  }));
  assert.throws(() => parseCertificate({
    version: 1,
    file_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    leaf_index: 0,
    steps: [{ hash: "nothex", left: false }],
    root: "4e59bf27372b1304bc0b137d1be9d566ad58b154b6a6b5778af7f414b1d4b84c",
    anchor: { chain: "", tx_hash: "", block_number: 0, block_time: "0001-01-01T00:00:00Z" }
  }));
  assert.throws(() => parseCertificate({
    version: 1,
    file_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    leaf_index: 0,
    steps: [],
    root: "4e59bf27372b1304bc0b137d1be9d566ad58b154b6a6b5778af7f414b1d4b84c"
  }));
});

test("parseCertificate rejects unsupported certificate version 2", () => {
  const cert = fixtures[0].certificate;
  assert.throws(() => parseCertificate({ ...cert, version: 2 }));
});

test("parseCertificate rejects block_time without RFC3339 timezone", () => {
  const cert = fixtures[0].certificate;
  const invalidTimes = [
    "0001-01-01T00:00:00",
    "2026-10-25 12:00:00",
    "2026-10-25T12:00:00+0000",
    "2026-10-25T12:00:00",
    "not-a-time"
  ];
  for (const block_time of invalidTimes) {
    assert.throws(
      () => parseCertificate({ ...cert, anchor: { ...cert.anchor, block_time } }),
      `expected block_time to be rejected: ${block_time}`
    );
  }
});

test("parseCertificate accepts RFC3339 timezone offsets", () => {
  const cert = fixtures[0].certificate;
  for (const block_time of [
    "2026-10-25T12:00:00Z",
    "2026-10-25T12:00:00.123Z",
    "2026-10-25T12:00:00+05:30",
    "2026-10-25T12:00:00-07:00"
  ]) {
    const parsed = parseCertificate({ ...cert, anchor: { ...cert.anchor, block_time } });
    assert.equal(parsed.anchor.block_time, block_time);
  }
});

test("parseCertificate rejects invalid calendar and time component values", () => {
  const cert = fixtures[0].certificate;
  const invalidTimes = [
    "2026-02-30T00:00:00Z",
    "2025-02-29T00:00:00Z",
    "2026-13-01T00:00:00Z",
    "2026-10-25T25:00:00Z",
    "2026-10-25T12:60:00Z",
    "2026-10-25T12:00:00+01:60"
  ];
  for (const block_time of invalidTimes) {
    assert.throws(
      () => parseCertificate({ ...cert, anchor: { ...cert.anchor, block_time } }),
      `expected block_time to be rejected: ${block_time}`
    );
  }

  const block_time = "2024-02-29T12:30:45Z";
  const parsed = parseCertificate({ ...cert, anchor: { ...cert.anchor, block_time } });
  assert.equal(parsed.anchor.block_time, block_time);
});

test("parseCertificate rejects demo export envelopes instead of unwrapping them", () => {
  const demo = {
    kind: "etch-demo-export",
    simulated: true,
    warning: "demo export",
    anchor_status: "not-performed",
    certificate: fixtures[0].certificate
  };
  assert.throws(() => parseCertificate(demo));
});

test("parseCertificate requires safe integers and complete step/anchor shapes", () => {
  const cert = fixtures[0].certificate;
  assert.throws(() => parseCertificate({ ...cert, leaf_index: Number.MAX_SAFE_INTEGER + 1 }));
  assert.throws(() => parseCertificate({ ...cert, leaf_index: 1.5 }));
  assert.throws(() => parseCertificate({
    ...cert,
    anchor: { ...cert.anchor, block_number: Number.MAX_SAFE_INTEGER + 1 }
  }));
  assert.throws(() => parseCertificate({ ...cert, steps: [{ hash: cert.root }] }));
  assert.throws(() => parseCertificate({ ...cert, steps: [{ hash: cert.root, left: "false" }] }));
  assert.throws(() => parseCertificate({ ...cert, anchor: { ...cert.anchor, chain: 1 } }));
  assert.throws(() => parseCertificate({ ...cert, anchor: { ...cert.anchor, tx_hash: null } }));
});

test("parseDemoExport rejects simulated:false", () => {
  const demo = {
    kind: "etch-demo-export",
    simulated: true,
    warning: "demo export",
    anchor_status: "not-performed",
    certificate: fixtures[0].certificate
  };
  assert.throws(() => parseDemoExport({ ...demo, simulated: false }));
  assert.throws(() => parseDemoExport({ ...demo, simulated: "true" }));
});

test("parseDemoExport requires a non-empty warning", () => {
  const demo = {
    kind: "etch-demo-export",
    simulated: true,
    warning: "demo export",
    anchor_status: "not-performed",
    certificate: fixtures[0].certificate
  };
  assert.throws(() => parseDemoExport({ ...demo, warning: "" }));
  assert.throws(() => parseDemoExport({ ...demo, warning: "   " }));
  assert.throws(() => parseDemoExport({ ...demo, warning: undefined }));
  const { warning, ...withoutWarning } = demo;
  assert.throws(() => parseDemoExport(withoutWarning));
});

test("parseDemoExport requires anchor_status exactly not-performed", () => {
  const demo = {
    kind: "etch-demo-export",
    simulated: true,
    warning: "demo export",
    anchor_status: "not-performed",
    certificate: fixtures[0].certificate
  };
  assert.throws(() => parseDemoExport({ ...demo, anchor_status: "performed" }));
  assert.throws(() => parseDemoExport({ ...demo, anchor_status: "not_performed" }));
  assert.throws(() => parseDemoExport({ ...demo, anchor_status: "" }));
  assert.throws(() => parseDemoExport({ ...demo, kind: "other-export" }));
  assert.throws(() => parseDemoExport({ ...demo, certificate: { ...demo.certificate, version: 2 } }));
});
