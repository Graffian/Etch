"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { getProof, submitHash } from "@/lib/api";
import type { Certificate } from "@/lib/certificate";
import { digestFile } from "@/lib/hash";
import { Certificate as CertificateCard } from "./Certificate";
import { Dropzone } from "./Dropzone";
import { MerkleViz } from "./MerkleViz";
import { StatusMessage } from "./StatusMessage";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 45;

type Stage =
  | "idle"
  | "hashing"
  | "submitting"
  | "pending"
  | "confirmed"
  | "timeout"
  | "error";

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function TimestampFlow() {
  const [stage, setStage] = useState<Stage>("idle");
  const [digest, setDigest] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollEpoch, setPollEpoch] = useState(0);
  const pollCount = useRef(0);

  const handleFile = useCallback(async (file: File) => {
    setStage("hashing");
    setCertificate(null);
    setError(null);
    setDigest(null);
    setFileName(file.name);
    pollCount.current = 0;

    try {
      const hash = await digestFile(file);
      setDigest(hash);
      setStage("submitting");
      await submitHash(hash);
      setStage("pending");
    } catch (err) {
      setError(toMessage(err));
      setStage("error");
    }
  }, []);

  useEffect(() => {
    if (stage !== "pending" || !digest) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) {
        return;
      }
      try {
        const result = await getProof(digest);
        if (cancelled) {
          return;
        }
        if (result.kind === "confirmed") {
          setCertificate(result.certificate);
          setStage("confirmed");
          return;
        }
        pollCount.current += 1;
        if (pollCount.current >= MAX_POLLS) {
          setStage("timeout");
          return;
        }
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(toMessage(err));
        setStage("error");
      }
    };

    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [stage, digest, pollEpoch]);

  function retry() {
    pollCount.current = 0;
    setStage("pending");
    setPollEpoch((n) => n + 1);
  }

  return (
    <>
      <div className="page-intro">
        <h1>Timestamp a file</h1>
        <p className="lede">
          Etch hashes the file in your browser, anchors the fingerprint through
          your server, and returns a certificate you can keep and verify later.
        </p>
      </div>

      <div className="operate-layout">
        <section className="operate-primary" aria-labelledby="select-file-heading">
          <div className="section-heading">
            <h2 id="select-file-heading">Choose a file</h2>
          </div>
          <Dropzone onFileSelect={handleFile} />
        </section>

        <aside className="operate-aside" aria-labelledby="status-heading">
          <h2 id="status-heading">Status</h2>

          {stage === "idle" && (
            <StatusMessage tone="info" title="Ready">
              Select a file to begin. Hashing happens locally; the file itself never
              leaves your device.
            </StatusMessage>
          )}
          {stage === "hashing" && (
            <StatusMessage tone="info" title="Hashing">
              Computing the SHA-256 fingerprint
              {fileName ? (
                <>
                  {" "}
                  of <strong>{fileName}</strong>
                </>
              ) : null}
              …
            </StatusMessage>
          )}
          {stage === "submitting" && (
            <StatusMessage tone="info" title="Submitting">
              Sending the fingerprint to the Etch server.
            </StatusMessage>
          )}
          {stage === "pending" && (
            <StatusMessage tone="info" title="Waiting for anchor">
              <span className="spinner" aria-hidden="true" /> The fingerprint is
              queued. The server batches submissions and anchors them every few
              seconds.
            </StatusMessage>
          )}
          {stage === "timeout" && (
            <>
              <StatusMessage tone="warning" title="Still pending">
                The batch hasn&apos;t anchored yet. The server anchors on a timer,
                so this can take a moment longer than usual.
              </StatusMessage>
              <button
                type="button"
                className="button button--quiet"
                onClick={retry}
              >
                Check again
              </button>
            </>
          )}
          {stage === "error" && (
            <StatusMessage tone="error" title="Something went wrong">
              {error}
            </StatusMessage>
          )}

          {digest ? (
            <div className="digest-block">
              <p className="field__label">SHA-256 fingerprint</p>
              <code className="hash hash--block">{digest}</code>
            </div>
          ) : null}

          <p className="link-row">
            <Link className="text-link" href="/verify">
              Verify a file against its certificate
            </Link>
          </p>
        </aside>
      </div>

      {certificate ? (
        <section className="result-block" aria-label="Certificate">
          <div className="section-heading">
            <h2>Certificate</h2>
          </div>
          <CertificateCard certificate={certificate} />
        </section>
      ) : null}

      <section className="how" aria-labelledby="how-heading">
        <div className="section-heading">
          <h2 id="how-heading">How it works</h2>
        </div>
        <div className="how__grid">
          <MerkleViz />
          <ol className="how__steps">
            <li>
              <div>
                <strong>Hash</strong>
                <p>
                  Etch computes the file&apos;s SHA-256 in your browser. The file
                  never leaves your device.
                </p>
              </div>
            </li>
            <li>
              <div>
                <strong>Batch</strong>
                <p>
                  The server groups pending hashes and combines them pairwise into
                  one Merkle root.
                </p>
              </div>
            </li>
            <li>
              <div>
                <strong>Anchor</strong>
                <p>
                  That root is written to the chain with a block number and
                  timestamp — your proof of existence.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
