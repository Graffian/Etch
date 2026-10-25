import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { File } from "node:buffer";

import {
  bytesToHex,
  hexToBytes,
  sha256,
  sha256Hex,
  digestFile,
} from "../lib/hash.ts";
import {
  hashLeaf,
  hashNode,
  buildMerkleTree,
  verifyMerkleProof,
} from "../lib/merkle.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures", "merkle-vectors.json"), "utf8")
);

const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const ABC_SHA256 =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const HELLO_SHA256 =
  "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

function flipHex(hex) {
  const last = hex.slice(-1);
  return hex.slice(0, -1) + (last === "0" ? "1" : "0");
}

test("sha256 matches Web Crypto known vectors for empty input and abc", async () => {
  assert.equal(bytesToHex(await sha256(new Uint8Array())), EMPTY_SHA256);
  assert.equal(await sha256Hex(""), EMPTY_SHA256);
  assert.equal(
    bytesToHex(await sha256(new TextEncoder().encode("abc"))),
    ABC_SHA256
  );
  assert.equal(await sha256Hex("abc"), ABC_SHA256);
});

test("bytesToHex and hexToBytes round-trip and invalid hex throws", () => {
  const bytes = Uint8Array.of(0x00, 0x0f, 0x10, 0xff);
  assert.equal(bytesToHex(bytes), "000f10ff");
  assert.deepEqual(hexToBytes("000f10ff"), bytes);
  assert.deepEqual(hexToBytes(""), new Uint8Array());

  assert.throws(() => hexToBytes("abc"), /hex/i);
  assert.throws(() => hexToBytes("0g"), /hex/i);
  assert.throws(() => hexToBytes("zz"), /hex/i);
  assert.throws(() => hexToBytes("123"), /hex/i);
});

test("digestFile hashes browser File bytes with Web Crypto SHA-256", async () => {
  assert.equal(await digestFile(new File([], "empty.bin")), EMPTY_SHA256);
  assert.equal(
    await digestFile(new File(["abc"], "abc.txt", { type: "text/plain" })),
    ABC_SHA256
  );
  assert.equal(
    await digestFile(new File([new TextEncoder().encode("hello")], "hello.bin")),
    HELLO_SHA256
  );
});

test("hashLeaf uses the 0x00 leaf prefix and hashNode uses the 0x01 node prefix", async () => {
  const digest = hexToBytes(fixtures[0].file_digest);
  const prefixedLeaf = new Uint8Array(1 + digest.length);
  prefixedLeaf[0] = 0x00;
  prefixedLeaf.set(digest, 1);
  assert.equal(bytesToHex(await hashLeaf(digest)), await sha256Hex(prefixedLeaf));

  const left = new Uint8Array(32).fill(0x11);
  const right = new Uint8Array(32).fill(0x22);
  const prefixedNode = new Uint8Array(1 + left.length + right.length);
  prefixedNode[0] = 0x01;
  prefixedNode.set(left, 1);
  prefixedNode.set(right, 1 + left.length);
  assert.equal(
    bytesToHex(await hashNode(left, right)),
    await sha256Hex(prefixedNode)
  );
});

test("buildMerkleTree matches all 7 Go vectors: roots and proof-step order", async () => {
  assert.equal(fixtures.length, 7);

  for (const vector of fixtures) {
    const leaves = vector.leaves_raw_hex.map((hex) => hexToBytes(hex));
    const tree = await buildMerkleTree(leaves);

    assert.equal(bytesToHex(tree.root), vector.merkle_root, vector.name);
    assert.equal(tree.rootHex, vector.merkle_root, vector.name);

    const proof = tree.proof(vector.certificate.leaf_index);
    assert.deepEqual(proof, vector.certificate.steps, `${vector.name} steps`);

    assert.equal(
      await verifyMerkleProof(
        vector.certificate.file_hash,
        proof,
        vector.merkle_root
      ),
      true,
      `${vector.name} proof`
    );
  }
});

test("buildMerkleTree accepts hex leaf digests in addition to decoded bytes", async () => {
  for (const vector of fixtures) {
    const tree = await buildMerkleTree(vector.leaves_raw_hex);
    assert.equal(tree.rootHex, vector.merkle_root, vector.name);
    assert.deepEqual(
      tree.proof(vector.certificate.leaf_index),
      vector.certificate.steps,
      `${vector.name} steps`
    );
  }
});

test("buildMerkleTree promotes odd nodes unchanged", async () => {
  const three = fixtures.find(
    (vector) => vector.name === "three-leaves-proof-index-2-odd-promoted"
  );
  const leaves = three.leaves_raw_hex.map((hex) => hexToBytes(hex));
  const tree = await buildMerkleTree(leaves);

  assert.equal(tree.levels.length, 3);
  assert.equal(tree.levels[1].length, 2);
  assert.equal(
    bytesToHex(tree.levels[1][1]),
    bytesToHex(await hashLeaf(leaves[2]))
  );
  assert.equal(
    tree.rootHex,
    bytesToHex(await hashNode(tree.levels[1][0], tree.levels[1][1]))
  );
});

test("empty tree is rejected while an empty file is one legal leaf", async () => {
  await assert.rejects(buildMerkleTree([]), /empty|leaves/i);

  const emptyFile = fixtures.find(
    (vector) => vector.name === "empty-file-single-leaf"
  );
  const tree = await buildMerkleTree([hexToBytes(emptyFile.file_digest)]);
  assert.equal(tree.rootHex, emptyFile.merkle_root);
  assert.deepEqual(tree.proof(0), []);
  assert.equal(
    await verifyMerkleProof(emptyFile.file_digest, [], emptyFile.merkle_root),
    true
  );
});

test("hashLeaf rejects leaf digests that are not exactly 32 bytes", async () => {
  await assert.rejects(hashLeaf(new Uint8Array(0)), /32/);
  await assert.rejects(hashLeaf(new Uint8Array(31)), /32/);
  await assert.rejects(hashLeaf(new Uint8Array(33)), /32/);
  await assert.rejects(buildMerkleTree([new Uint8Array(31)]), /32/);
  await assert.rejects(
    buildMerkleTree([new Uint8Array(32), new Uint8Array(33)]),
    /32/
  );
  await assert.rejects(buildMerkleTree([""]), /32/);
  await assert.rejects(buildMerkleTree(["00".repeat(31)]), /32/);
});

test("hashNode rejects inputs that are not exactly 32 bytes", async () => {
  const valid = new Uint8Array(32);
  await assert.rejects(hashNode(new Uint8Array(0), valid), /32/);
  await assert.rejects(hashNode(new Uint8Array(31), valid), /32/);
  await assert.rejects(hashNode(valid, new Uint8Array(31)), /32/);
  await assert.rejects(hashNode(valid, new Uint8Array(33)), /32/);
});

test("verifyMerkleProof rejects a file digest or root that is not exactly 32 bytes", async () => {
  const vector = fixtures.find(
    (name) => name.name === "five-leaves-proof-index-4-last"
  );
  const { file_hash, steps, root } = vector.certificate;

  assert.equal(await verifyMerkleProof(file_hash, steps, root), true);

  await assert.rejects(
    verifyMerkleProof(file_hash.slice(0, 62), steps, root),
    /32/
  );
  await assert.rejects(verifyMerkleProof(file_hash + "00", steps, root), /32/);
  await assert.rejects(verifyMerkleProof("", steps, root), /32/);

  await assert.rejects(
    verifyMerkleProof(file_hash, steps, root.slice(0, 62)),
    /32/
  );
  await assert.rejects(verifyMerkleProof(file_hash, steps, root + "00"), /32/);
  await assert.rejects(verifyMerkleProof(file_hash, steps, ""), /32/);
});

test("verifyMerkleProof rejects steps with malformed hashes or non-boolean left", async () => {
  const vector = fixtures.find(
    (name) => name.name === "five-leaves-proof-index-4-last"
  );
  const { file_hash, steps, root } = vector.certificate;
  const validStep = steps[0];
  const rest = steps.slice(1);

  const badHashes = [
    "",
    validStep.hash.slice(0, 62),
    validStep.hash + "00",
    validStep.hash.slice(0, 63),
    "0g",
    "zz",
    123,
    null,
    undefined,
  ];
  for (const hash of badHashes) {
    await assert.rejects(
      verifyMerkleProof(file_hash, [{ ...validStep, hash }, ...rest], root),
      /hash|hex|32/i,
      `expected malformed hash ${String(hash)} to be rejected`
    );
  }

  for (const left of ["true", 0, 1, null, undefined]) {
    await assert.rejects(
      verifyMerkleProof(file_hash, [{ ...validStep, left }, ...rest], root),
      /left|boolean/i,
      `expected non-boolean left ${String(left)} to be rejected`
    );
  }
});

test("verifyMerkleProof accepts a valid proof and rejects wrong/tampered proof or root", async () => {
  const vector = fixtures.find(
    (name) => name.name === "five-leaves-proof-index-4-last"
  );
  const { file_hash, steps, root } = vector.certificate;

  assert.equal(await verifyMerkleProof(file_hash, steps, root), true);
  assert.equal(
    await verifyMerkleProof(file_hash, steps, vector.merkle_root),
    true
  );

  const tamperedHash = steps.map((step, index) =>
    index === 0 ? { ...step, hash: flipHex(step.hash) } : step
  );
  assert.equal(await verifyMerkleProof(file_hash, tamperedHash, root), false);

  const tamperedLeft = steps.map((step, index) =>
    index === 0 ? { ...step, left: !step.left } : step
  );
  assert.equal(await verifyMerkleProof(file_hash, tamperedLeft, root), false);

  assert.equal(await verifyMerkleProof(file_hash, steps, flipHex(root)), false);
  assert.equal(await verifyMerkleProof(flipHex(file_hash), steps, root), false);
  assert.equal(await verifyMerkleProof(file_hash, [], root), false);

  const twoLeaf = fixtures.find(
    (name) => name.name === "two-leaves-proof-index-0"
  );
  assert.equal(
    await verifyMerkleProof(
      twoLeaf.certificate.file_hash,
      twoLeaf.certificate.steps,
      twoLeaf.certificate.root
    ),
    true
  );
  assert.equal(
    await verifyMerkleProof(
      twoLeaf.certificate.file_hash,
      [{ ...twoLeaf.certificate.steps[0], left: true }],
      twoLeaf.certificate.root
    ),
    false
  );
});
