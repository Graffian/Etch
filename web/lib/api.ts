import { parseCertificate } from "./certificate.ts";
import type { Certificate } from "./certificate.ts";

export type SubmitStatus = "pending" | "confirmed";

export interface SubmitResponse {
  hash: string;
  status: SubmitStatus;
}

export type ProofState =
  | { kind: "pending"; hash: string }
  | { kind: "confirmed"; certificate: Certificate };

export interface VerifyResponse {
  valid: boolean;
  reason?: string;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const DEFAULT_BASE_URL = "http://localhost:8080";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_ETCH_API ?? DEFAULT_BASE_URL
).replace(/\/+$/, "");

async function readError(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (
      typeof data === "object" &&
      data !== null &&
      typeof (data as { error?: unknown }).error === "string"
    ) {
      return (data as { error: string }).error;
    }
  } catch {
    // body wasn't JSON; fall through to the generic message
  }
  return `Request failed (${response.status})`;
}

export async function submitHash(hash: string): Promise<SubmitResponse> {
  const response = await fetch(`${API_BASE_URL}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hash }),
  });

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
  return (await response.json()) as SubmitResponse;
}

export async function getProof(hash: string): Promise<ProofState> {
  const response = await fetch(
    `${API_BASE_URL}/proof/${encodeURIComponent(hash)}`
  );

  if (response.status === 202) {
    const data = (await response.json()) as SubmitResponse;
    return { kind: "pending", hash: data.hash };
  }
  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
  return {
    kind: "confirmed",
    certificate: parseCertificate(await response.json()),
  };
}

export async function verifyCertificate(
  certificate: Certificate
): Promise<VerifyResponse> {
  const response = await fetch(`${API_BASE_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(certificate),
  });

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
  return (await response.json()) as VerifyResponse;
}
