const HEX_PATTERN = /^[0-9a-fA-F]*$/;
const textEncoder = new TextEncoder();

export type HashInput = string | ArrayBuffer | Uint8Array;

function toBytes(data: HashInput): Uint8Array<ArrayBuffer> {
  if (typeof data === "string") {
    return textEncoder.encode(data);
  }
  return new Uint8Array(data);
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  if (typeof hex !== "string" || hex.length % 2 !== 0 || !HEX_PATTERN.test(hex)) {
    throw new Error("Invalid hex string");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function sha256(data: HashInput): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", toBytes(data));
  return new Uint8Array(digest);
}

export async function sha256Hex(data: HashInput): Promise<string> {
  return bytesToHex(await sha256(data));
}

export async function digestFile(file: Blob): Promise<string> {
  return sha256Hex(await file.arrayBuffer());
}
