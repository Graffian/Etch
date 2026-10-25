"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { ApiError, getProof } from "@/lib/api";
import type { Certificate } from "@/lib/certificate";
import { Certificate as CertificateCard } from "./Certificate";
import { StatusMessage } from "./StatusMessage";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 45;

type State =
  | "loading"
  | "pending"
  | "timeout"
  | "confirmed"
  | "notfound"
  | "error";

export function CertificateDetail({ hash }: { hash: string }) {
  const [state, setState] = useState<State>("loading");
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [epoch, setEpoch] = useState(0);
  const pollCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) {
        return;
      }
      try {
        const result = await getProof(hash);
        if (cancelled) {
          return;
        }
        if (result.kind === "confirmed") {
          setCertificate(result.certificate);
          setState("confirmed");
          return;
        }
        pollCount.current += 1;
        if (pollCount.current >= MAX_POLLS) {
          setState("timeout");
          return;
        }
        setState("pending");
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) {
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          setState("notfound");
        } else {
          setError(err instanceof Error ? err.message : String(err));
          setState("error");
        }
      }
    };

    setState("loading");
    setCertificate(null);
    setError(null);
    pollCount.current = 0;
    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [hash, epoch]);

  if (state === "confirmed" && certificate) {
    return (
      <div className="detail-layout">
        <section className="panel canonical-panel" aria-labelledby="canonical-heading">
          <h2 id="canonical-heading">File digest</h2>
          <code className="hash hash--block">{hash}</code>
          <p className="canonical-note">
            The file&apos;s SHA-256 fingerprint, as submitted to the Etch server.
            Keep the certificate below together with the original file.
          </p>
          <p className="link-row">
            <Link className="text-link" href="/verify">
              Verify this file
            </Link>
          </p>
        </section>
        <CertificateCard certificate={certificate} />
      </div>
    );
  }

  return (
    <div className="detail-layout">
      <section className="panel canonical-panel" aria-labelledby="canonical-heading">
        <h2 id="canonical-heading">File digest</h2>
        <code className="hash hash--block">{hash}</code>
      </section>
      <section aria-label="Certificate status">
        {state === "loading" && (
          <StatusMessage tone="info" title="Loading certificate">
            <span className="spinner" aria-hidden="true" /> Looking up this digest
            on the Etch server…
          </StatusMessage>
        )}
        {state === "pending" && (
          <StatusMessage tone="info" title="Queued for anchoring">
            <span className="spinner" aria-hidden="true" /> This digest is waiting
            to be included in an anchored batch.
          </StatusMessage>
        )}
        {state === "timeout" && (
          <>
            <StatusMessage tone="warning" title="Still pending">
              The server hasn&apos;t anchored this digest yet.
            </StatusMessage>
            <p className="link-row">
              <button
                type="button"
                className="button button--quiet"
                onClick={() => setEpoch((n) => n + 1)}
              >
                Check again
              </button>
            </p>
          </>
        )}
        {state === "notfound" && (
          <StatusMessage tone="error" title="No certificate found">
            The server doesn&apos;t know this digest. It may not have been
            submitted, or the hash is mistyped.
          </StatusMessage>
        )}
        {state === "error" && (
          <StatusMessage tone="error" title="Something went wrong">
            {error}
          </StatusMessage>
        )}
      </section>
    </div>
  );
}
