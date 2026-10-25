import type { Certificate, DemoExport } from "./certificate.ts";
import { bytesToHex, hexToBytes, sha256Hex } from "./hash.ts";
import { hashLeaf } from "./merkle.ts";

const ZERO_TIME = "0001-01-01T00:00:00Z";
const DEMO_WARNING =
  "Simulated demo export. No blockchain transaction or real anchor was performed. This certificate shows local file integrity only, not authorship or creation time.";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const parts: string[] = [];

  for (const key of Object.keys(record).sort()) {
    const item = record[key];
    if (item === undefined) {
      continue;
    }
    parts.push(`${JSON.stringify(key)}:${stableStringify(item)}`);
  }

  return `{${parts.join(",")}}`;
}

function isDemoExport(value: DemoExport | Certificate): value is DemoExport {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as DemoExport).kind === "etch-demo-export"
  );
}

export async function createDemoCertificate(
  fileDigestHex: string
): Promise<Certificate> {
  const digest = hexToBytes(fileDigestHex);
  if (digest.length !== 32) {
    throw new Error("File digest must be 32 bytes");
  }

  return {
    version: 1,
    file_hash: bytesToHex(digest),
    leaf_index: 0,
    steps: [],
    root: bytesToHex(await hashLeaf(digest)),
    anchor: {
      chain: "",
      tx_hash: "",
      block_number: 0,
      block_time: ZERO_TIME,
    },
  };
}

export function createDemoExport(certificate: Certificate): DemoExport {
  return {
    kind: "etch-demo-export",
    simulated: true,
    warning: DEMO_WARNING,
    anchor_status: "not-performed",
    certificate,
  };
}

export async function canonicalCertificateId(
  input: DemoExport | Certificate
): Promise<string> {
  const envelope = isDemoExport(input) ? input : createDemoExport(input);
  return sha256Hex(stableStringify(envelope));
}
