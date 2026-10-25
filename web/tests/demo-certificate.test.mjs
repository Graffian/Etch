import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDemoCertificate,
  createDemoExport,
  canonicalCertificateId,
} from "../lib/demo-certificate.ts";
import { bytesToHex, hexToBytes } from "../lib/hash.ts";
import { hashLeaf } from "../lib/merkle.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "merkle-vectors.json"), "utf8")
);

const ZERO_TIME = "0001-01-01T00:00:00Z";

function reorderKeys(value) {
  if (Array.isArray(value)) {
    return value.map(reorderKeys);
  }
  if (value && typeof value === "object") {
    const reordered = {};
    for (const key of Object.keys(value).sort().reverse()) {
      reordered[key] = reorderKeys(value[key]);
    }
    return reordered;
  }
  return value;
}

test("createDemoCertificate produces the exact backend single-leaf certificate", async () => {
  const empty = fixtures.find(
    (vector) => vector.name === "empty-file-single-leaf"
  );
  const cert = await createDemoCertificate(empty.file_digest);

  assert.deepEqual(cert, empty.certificate);
  assert.equal(cert.version, 1);
  assert.equal(cert.file_hash, empty.file_digest);
  assert.equal(cert.leaf_index, 0);
  assert.deepEqual(cert.steps, []);
  assert.equal(cert.anchor.chain, "");
  assert.equal(cert.anchor.tx_hash, "");
  assert.equal(cert.anchor.block_number, 0);
  assert.equal(cert.anchor.block_time, ZERO_TIME);
});

test("createDemoCertificate hashes the decoded 32-byte file digest, not its hex text", async () => {
  const empty = fixtures.find(
    (vector) => vector.name === "empty-file-single-leaf"
  );
  const cert = await createDemoCertificate(empty.file_digest);

  const decoded = hexToBytes(empty.file_digest);
  assert.equal(decoded.length, 32);
  assert.equal(cert.root, bytesToHex(await hashLeaf(decoded)));
  assert.equal(cert.root, empty.merkle_root);
  assert.notEqual(cert.root, cert.file_hash);
  assert.equal(
    (await createDemoCertificate(empty.file_digest.toUpperCase())).file_hash,
    empty.file_digest
  );

  await assert.rejects(createDemoCertificate(""));
  await assert.rejects(createDemoCertificate("abcd"));
  await assert.rejects(createDemoCertificate("zz"));
});

test("demo certificate anchor is the zero-time sentinel with no transaction or time", async () => {
  const cert = await createDemoCertificate(fixtures[1].file_digest);

  assert.deepEqual(cert.anchor, {
    chain: "",
    tx_hash: "",
    block_number: 0,
    block_time: ZERO_TIME,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(cert, "created_at"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(cert, "timestamp"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(cert, "tx_hash"), false);
});

test("createDemoExport returns the exact disclosure wrapper", async () => {
  const cert = await createDemoCertificate(fixtures[0].file_digest);
  const exported = createDemoExport(cert);

  assert.deepEqual(Object.keys(exported), [
    "kind",
    "simulated",
    "warning",
    "anchor_status",
    "certificate",
  ]);
  assert.equal(exported.kind, "etch-demo-export");
  assert.equal(exported.simulated, true);
  assert.equal(typeof exported.warning, "string");
  assert.ok(exported.warning.trim().length > 0);
  assert.equal(exported.anchor_status, "not-performed");
  assert.deepEqual(exported.certificate, cert);
  assert.equal(exported.certificate.anchor.tx_hash, "");
  assert.equal(exported.certificate.anchor.chain, "");
  assert.equal(exported.certificate.anchor.block_number, 0);
  assert.equal(exported.certificate.anchor.block_time, ZERO_TIME);
});

test("canonicalCertificateId is stable across key order and changes with payload", async () => {
  const certA = await createDemoCertificate(fixtures[0].file_digest);
  const exportA = createDemoExport(certA);
  const idA = await canonicalCertificateId(exportA);

  assert.match(idA, /^[0-9a-f]{64}$/);
  assert.equal(await canonicalCertificateId(reorderKeys(exportA)), idA);
  assert.equal(
    await canonicalCertificateId({
      ...exportA,
      certificate: {
        ...exportA.certificate,
        anchor: { ...exportA.certificate.anchor },
      },
    }),
    idA
  );

  const certB = await createDemoCertificate(fixtures[1].file_digest);
  const idB = await canonicalCertificateId(createDemoExport(certB));
  assert.notEqual(idB, idA);

  const changedWarning = await canonicalCertificateId({
    ...exportA,
    warning: `${exportA.warning} changed`,
  });
  assert.notEqual(changedWarning, idA);
});
