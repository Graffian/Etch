"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { verifyCertificate } from "@/lib/api";
import { parseCertificate } from "@/lib/certificate";
import type { Certificate } from "@/lib/certificate";
import { digestFile } from "@/lib/hash";
import { verifyMerkleProof } from "@/lib/merkle";
import { Dropzone } from "./Dropzone";
import { StatusMessage } from "./StatusMessage";

type CheckStatus = "unchecked" | "pass" | "fail" | "error";

type CheckRow = { status: CheckStatus; detail: string };

type Checks = {
  file: CheckRow;
  proof: CheckRow;
  anchor: CheckRow;
};

const ROWS: { key: keyof Checks; label: string }[] = [
  { key: "file", label: "File" },
  { key: "proof", label: "Merkle proof" },
  { key: "anchor", label: "Anchor" },
];

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseCertText(text: string): Certificate | null {
  try {
    return parseCertificate(JSON.parse(text));
  } catch {
    return null;
  }
}

function checkBadgeLabel(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "fail":
      return "Fail";
    case "error":
      return "Error";
    default:
      return "Not checked";
  }
}

export function VerifyFlow() {
  const [certText, setCertText] = useState("");
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [certError, setCertError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<Checks | null>(null);
  const certFileRef = useRef<HTMLInputElement>(null);

  function applyCert(text: string) {
    if (!text.trim()) {
      setCertificate(null);
      setCertError(null);
      return;
    }
    const parsed = parseCertText(text);
    if (parsed) {
      setCertificate(parsed);
      setCertError(null);
    } else {
      setCertificate(null);
      setCertError(
        "That isn't a valid certificate — check the JSON is complete and unmodified."
      );
    }
  }

  function handleTextChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setCertText(event.currentTarget.value);
  }

  function handleTextBlur() {
    applyCert(certText);
  }

  function handleCertFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!selected) {
      return;
    }
    selected
      .text()
      .then((text) => {
        setCertText(text);
        applyCert(text);
      })
      .catch(() => setCertError("Couldn't read that file."));
  }

  async function handleVerify() {
    const parsed = parseCertText(certText);
    if (!parsed) {
      applyCert(certText);
      setChecks(null);
      return;
    }
    setCertificate(parsed);
    setCertError(null);
    setBusy(true);

    const next: Checks = {
      file: { status: "unchecked", detail: "" },
      proof: { status: "unchecked", detail: "" },
      anchor: { status: "unchecked", detail: "" },
    };

    if (file) {
      try {
        const digest = await digestFile(file);
        if (digest === parsed.file_hash) {
          next.file = {
            status: "pass",
            detail:
              "The selected file's SHA-256 matches the certificate's file digest.",
          };
        } else {
          next.file = {
            status: "fail",
            detail:
              "The selected file's digest does not match the certificate — the file has changed (or is the wrong file).",
          };
        }
      } catch (err) {
        next.file = { status: "error", detail: toMessage(err) };
      }
    }

    try {
      const ok = await verifyMerkleProof(parsed.file_hash, parsed.steps, parsed.root);
      next.proof = ok
        ? {
            status: "pass",
            detail: "The proof steps reconstruct the declared Merkle root.",
          }
        : {
            status: "fail",
            detail:
              "The proof steps do not reconstruct the declared root — the certificate is internally inconsistent.",
          };
    } catch (err) {
      next.proof = { status: "error", detail: toMessage(err) };
    }

    try {
      const result = await verifyCertificate(parsed);
      next.anchor = result.valid
        ? {
            status: "pass",
            detail: "The certificate's root is confirmed on the server's chain.",
          }
        : { status: "fail", detail: result.reason ?? "The anchor check failed." };
    } catch (err) {
      next.anchor = {
        status: "error",
        detail: `Couldn't reach the server: ${toMessage(err)}`,
      };
    }

    setChecks(next);
    setBusy(false);
  }

  const anyError =
    checks !== null && ROWS.some((r) => checks[r.key].status === "error");
  const allPass =
    checks !== null && ROWS.every((r) => checks[r.key].status === "pass");
  const fileUnchecked = checks?.file.status === "unchecked";

  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">Verify / Inspect</p>
        <h1>Check that a file is unchanged.</h1>
        <p className="lede">
          Provide the original file and its certificate. Etch checks three things
          separately: that the file still matches its digest, that the proof
          reconstructs the declared root, and that the root is anchored on the
          chain.
        </p>
      </div>

      <div className="verify-grid">
        <section aria-labelledby="file-heading">
          <div className="section-heading">
            <p className="eyebrow">Original file</p>
            <h2 id="file-heading">The file to check</h2>
          </div>
          <Dropzone onFileSelect={(f) => setFile(f)} />
          <div className="status-stack">
            <button
              type="button"
              className="button button--primary"
              onClick={handleVerify}
              disabled={busy || !certText.trim()}
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
          </div>
        </section>

        <aside className="verify-aside" aria-labelledby="certificate-heading">
          <h2 id="certificate-heading">Certificate</h2>
          <div className="field">
            <label className="field__label" htmlFor="cert-json">
              Certificate JSON
            </label>
            <textarea
              id="cert-json"
              className="textarea"
              value={certText}
              onChange={handleTextChange}
              onBlur={handleTextBlur}
              placeholder='{"version":1,"file_hash":"…","leaf_index":0,"steps":[…],"root":"…","anchor":{…}}'
              spellCheck={false}
            />
            <p className="field__hint">
              Paste the certificate JSON, or load it from a file.
            </p>
          </div>
          <div className="dropzone__actions">
            <button
              type="button"
              className="button button--quiet"
              onClick={() => certFileRef.current?.click()}
            >
              Load certificate from file
            </button>
            <input
              ref={certFileRef}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              onChange={handleCertFile}
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>

          {certError ? (
            <div className="status-stack">
              <StatusMessage tone="error" title="Certificate problem">
                {certError}
              </StatusMessage>
            </div>
          ) : certificate ? (
            <div className="status-stack">
              <StatusMessage tone="success" title="Certificate parsed">
                Digest <code>{certificate.file_hash.slice(0, 16)}…</code> ·{" "}
                {certificate.steps.length} proof step
                {certificate.steps.length === 1 ? "" : "s"}.
              </StatusMessage>
            </div>
          ) : null}
        </aside>
      </div>

      {checks ? (
        <section className="verify-result" aria-label="Verification result">
          <div className="section-heading">
            <p className="eyebrow">Result</p>
            <h2>Three independent checks</h2>
          </div>

          {allPass ? (
            <StatusMessage tone="success" title="All checks passed">
              The file matches its digest, the proof is valid, and the root is
              anchored.
            </StatusMessage>
          ) : anyError ? (
            <StatusMessage tone="error" title="Couldn't complete verification">
              At least one check couldn&apos;t run. See the details below.
            </StatusMessage>
          ) : fileUnchecked ? (
            <StatusMessage tone="warning" title="Partial result">
              No original file was provided, so the file itself was not checked.
              Proof and anchor results are shown below.
            </StatusMessage>
          ) : (
            <StatusMessage tone="error" title="Not verified">
              One or more checks failed. See the details below.
            </StatusMessage>
          )}

          <dl className="check-list">
            {ROWS.map((row) => (
              <div key={row.key}>
                <dt className="verify-result__label">
                  <span className={`check-badge check-badge--${checks[row.key].status}`}>
                    {checkBadgeLabel(checks[row.key].status)}
                  </span>
                  {row.label}
                </dt>
                <dd>{checks[row.key].detail || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </>
  );
}
