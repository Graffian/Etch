"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { getProof, requestAnchor, submitHash } from "@/lib/api";
import type { Certificate } from "@/lib/certificate";
import { digestFile } from "@/lib/hash";
import { connectWallet, ensureSepolia, signAnchor } from "@/lib/wallet";
import { Certificate as CertificateCard } from "./Certificate";
import { Dropzone } from "./Dropzone";
import { MerkleViz } from "./MerkleViz";
import { SampleCertificate } from "./SampleCertificate";
import { StatusMessage } from "./StatusMessage";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 45;

type Stage =
  | "idle"
  | "hashing"
  | "submitting"
  | "batching"
  | "ready"
  | "signing"
  | "confirming"
  | "confirmed"
  | "timeout"
  | "error";

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function shortAddress(account: string): string {
  return `${account.slice(0, 6)}…${account.slice(-4)}`;
}

export function TimestampFlow() {
  const [stage, setStage] = useState<Stage>("idle");
  const [digest, setDigest] = useState<string | null>(null);
  const [root, setRoot] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollEpoch, setPollEpoch] = useState(0);
  const pollCount = useRef(0);

  const handleFile = useCallback(async (file: File) => {
    setStage("hashing");
    setCertificate(null);
    setError(null);
    setDigest(null);
    setRoot(null);
    setFileName(file.name);
    pollCount.current = 0;

    try {
      const hash = await digestFile(file);
      setDigest(hash);
      setStage("submitting");
      await submitHash(hash);
      setStage("batching");
    } catch (err) {
      setError(toMessage(err));
      setStage("error");
    }
  }, []);

  useEffect(() => {
    if ((stage !== "batching" && stage !== "confirming") || !digest) {
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
        if (result.kind === "ready") {
          setRoot(result.root);
          setStage("ready");
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

  async function handleSignAnchor() {
    if (!root) {
      return;
    }
    setStage("signing");
    setError(null);
    try {
      const acct = account ?? (await connectWallet());
      setAccount(acct);
      await ensureSepolia();
      const txHash = await signAnchor(acct, root);

      // The server reads the transaction from the chain, so wait for it to
      // be mined (a Sepolia block lands every ~12s).
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          await requestAnchor(root, txHash);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          await new Promise((resolve) => setTimeout(resolve, 4000));
        }
      }
      if (lastErr) {
        throw lastErr;
      }

      pollCount.current = 0;
      setStage("confirming");
    } catch (err) {
      setError(toMessage(err));
      setStage("ready");
    }
  }

  function retry() {
    pollCount.current = 0;
    setStage("batching");
    setPollEpoch((n) => n + 1);
  }

  return (
    <>
      <div className="hero hero--split">
        <div className="hero__copy">
          <h1>Prove a file existed by a date.</h1>
          <p className="lede">
            Etch hashes the file in your browser, anchors the fingerprint to
            Ethereum from your wallet, and hands you a certificate you can
            verify any time.
          </p>
        </div>
        <div className="hero__figure">
          <SampleCertificate />
        </div>
      </div>

      <Dropzone onFileSelect={handleFile} />

      <div className="operate-status" aria-live="polite">
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
        {stage === "batching" && (
          <StatusMessage tone="info" title="Batching">
            <span className="spinner" aria-hidden="true" /> The server is
            grouping submissions into a Merkle tree.
          </StatusMessage>
        )}
        {stage === "ready" && (
          <>
            <StatusMessage tone="info" title="Ready to anchor">
              The proof is ready. Sign the anchor transaction to write the root
              to Sepolia.
            </StatusMessage>
            {root ? (
              <div className="digest-block">
                <p className="field__label">Merkle root</p>
                <code className="hash hash--block">{root}</code>
              </div>
            ) : null}
            <button
              type="button"
              className="button button--primary"
              onClick={handleSignAnchor}
            >
              Sign anchor with MetaMask
            </button>
          </>
        )}
        {stage === "signing" && (
          <StatusMessage tone="info" title="Anchoring">
            <span className="spinner" aria-hidden="true" /> Confirm the
            transaction in MetaMask, then wait for it to be mined.
          </StatusMessage>
        )}
        {stage === "confirming" && (
          <StatusMessage tone="info" title="Confirming">
            <span className="spinner" aria-hidden="true" /> Fetching your
            certificate.
          </StatusMessage>
        )}
        {stage === "timeout" && (
          <>
            <StatusMessage tone="warning" title="Still pending">
              The batch hasn&apos;t finalized yet.
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

        {account ? (
          <p className="dropzone__note">Wallet: {shortAddress(account)}</p>
        ) : null}

        {digest ? (
          <div className="digest-block">
            <p className="field__label">SHA-256 fingerprint</p>
            <code className="hash hash--block">{digest}</code>
          </div>
        ) : null}
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
        <p className="how__lead">
          Every file becomes a leaf in a Merkle tree. Your digest is combined
          with the rest of the batch until a single root remains, and that root
          is written to the chain from your wallet. Change one byte and the
          whole path breaks.
        </p>
        <div className="how__grid">
          <ul className="how__list">
            <li>
              <strong>Hash</strong>
              <p>
                Etch computes the file&apos;s SHA-256 in your browser. The file
                never leaves your device.
              </p>
            </li>
            <li>
              <strong>Batch</strong>
              <p>
                The server groups pending hashes and combines them pairwise into
                one Merkle root.
              </p>
            </li>
            <li>
              <strong>Anchor</strong>
              <p>
                You sign a transaction carrying that root. It lands on Sepolia
                with a block number and timestamp — your proof of existence.
              </p>
            </li>
          </ul>
          <figure className="how__viz">
            <MerkleViz />
            <figcaption className="how__caption">
              Four hashes roll up into one root. The highlighted leaf is yours —
              the certificate is the path from that leaf to the root.
            </figcaption>
          </figure>
        </div>
      </section>

      <p className="link-row">
        <Link className="text-link" href="/verify">
          Verify a file against its certificate →
        </Link>
      </p>
    </>
  );
}
