import { bytesToHex, hexToBytes, sha256 } from "./hash.ts";

export type MerkleStep = {
  hash: string;
  left: boolean;
};

export type MerkleLeafInput = Uint8Array | string;

export type MerkleTree = {
  data: Uint8Array[];
  leaves: Uint8Array[];
  levels: Uint8Array[][];
  root: Uint8Array;
  rootHex: string;
  proof(index: number): MerkleStep[];
};

function toLeafBytes(input: MerkleLeafInput): Uint8Array {
  return typeof input === "string" ? hexToBytes(input) : input;
}

const DIGEST_LENGTH = 32;

function assertDigestLength(bytes: Uint8Array, label: string): void {
  if (bytes.length !== DIGEST_LENGTH) {
    throw new Error(`${label} must be exactly ${DIGEST_LENGTH} bytes`);
  }
}

export async function hashLeaf(data: Uint8Array): Promise<Uint8Array> {
  assertDigestLength(data, "Merkle leaf digest");
  const buf = new Uint8Array(1 + data.length);
  buf[0] = 0x00;
  buf.set(data, 1);
  return sha256(buf);
}

export async function hashNode(
  left: Uint8Array,
  right: Uint8Array
): Promise<Uint8Array> {
  assertDigestLength(left, "Merkle node left input");
  assertDigestLength(right, "Merkle node right input");
  const buf = new Uint8Array(1 + left.length + right.length);
  buf[0] = 0x01;
  buf.set(left, 1);
  buf.set(right, 1 + left.length);
  return sha256(buf);
}

export async function buildMerkleTree(
  data: readonly MerkleLeafInput[]
): Promise<MerkleTree> {
  if (data.length === 0) {
    throw new Error("Cannot build Merkle tree with no leaves");
  }

  const inputs = data.map((input) => new Uint8Array(toLeafBytes(input)));
  const leaves = await Promise.all(inputs.map((input) => hashLeaf(input)));

  const levels: Uint8Array[][] = [leaves];
  let current = leaves;

  while (current.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        next.push(await hashNode(current[i], current[i + 1]));
      } else {
        next.push(current[i]);
      }
    }
    levels.push(next);
    current = next;
  }

  const root = current[0];

  return {
    data: inputs,
    leaves,
    levels,
    root,
    rootHex: bytesToHex(root),
    proof(index: number): MerkleStep[] {
      if (!Number.isInteger(index) || index < 0 || index >= leaves.length) {
        throw new Error("Merkle leaf index out of range");
      }

      const steps: MerkleStep[] = [];
      let idx = index;

      for (let level = 0; level < levels.length - 1; level++) {
        const row = levels[level];
        if (idx % 2 === 0) {
          if (idx + 1 < row.length) {
            steps.push({ hash: bytesToHex(row[idx + 1]), left: false });
          }
        } else {
          steps.push({ hash: bytesToHex(row[idx - 1]), left: true });
        }
        idx = Math.floor(idx / 2);
      }

      return steps;
    },
  };
}

export async function verifyMerkleProof(
  fileDigestHex: string,
  steps: readonly MerkleStep[],
  rootHex: string
): Promise<boolean> {
  const fileDigest = hexToBytes(fileDigestHex);
  assertDigestLength(fileDigest, "File digest");
  const root = hexToBytes(rootHex);
  assertDigestLength(root, "Merkle root");

  let hash = await hashLeaf(fileDigest);

  for (const step of steps) {
    if (typeof step !== "object" || step === null) {
      throw new Error("Merkle proof step must be an object");
    }
    if (typeof step.left !== "boolean") {
      throw new Error("Merkle proof step left must be a boolean");
    }
    const sibling = hexToBytes(step.hash);
    assertDigestLength(sibling, "Merkle proof step hash");
    hash = step.left
      ? await hashNode(sibling, hash)
      : await hashNode(hash, sibling);
  }

  return bytesToHex(hash) === bytesToHex(root);
}
