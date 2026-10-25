"use client";

import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/components/Logo";
import { SampleCertificate } from "@/components/SampleCertificate";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
};

function getProvider(): EthereumProvider | undefined {
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum;
}

function shortAddress(account: string): string {
  return `${account.slice(0, 6)}…${account.slice(-4)}`;
}

export default function LandingPage() {
  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const provider = getProvider();
      if (!provider) {
        setError(
          "MetaMask isn't installed. Get it at metamask.io, then reload this page.",
        );
        return;
      }
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      setAccount(accounts[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't connect.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="landing">
      <header className="landing__header">
        <div className="landing__header-inner">
          <Link className="brand" href="/" aria-label="Etch home">
            <Logo />
            <span className="brand__name">Etch</span>
          </Link>
          <nav className="landing__nav" aria-label="Primary">
            <a href="#how">How it works</a>
            <Link href="/timestamp">Timestamp</Link>
            <Link href="/verify">Verify</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="landing__hero">
          <div className="landing__hero-copy">
            <h1>Prove a file existed. On-chain.</h1>
            <p className="landing__lede">
              Etch fingerprints your file in the browser and anchors it to
              Ethereum. You get a certificate that proves — years later — the
              file was exactly this, on this date.
            </p>
            <div className="landing__cta">
              <button
                type="button"
                className="button button--primary"
                onClick={connect}
                disabled={connecting}
              >
                {account
                  ? shortAddress(account)
                  : connecting
                    ? "Connecting…"
                    : "Connect MetaMask"}
              </button>
              <button type="button" className="button button--quiet" disabled>
                Phantom — soon
              </button>
              <Link className="button button--quiet" href="/timestamp">
                Timestamp a file
              </Link>
            </div>
            {error ? <p className="landing__error">{error}</p> : null}
            <p className="landing__meta">
              Sepolia testnet · the file never leaves your device · Solana via
              Phantom coming soon
            </p>
          </div>
          <div className="landing__hero-figure">
            <SampleCertificate />
          </div>
        </section>

        <section className="landing__section" id="how">
          <h2>How it works</h2>
          <div className="landing__grid">
            <div>
              <h3>Hash</h3>
              <p>
                The file is hashed in your browser. Its SHA-256 is a unique
                fingerprint — the file itself never leaves your device.
              </p>
            </div>
            <div>
              <h3>Batch</h3>
              <p>
                Etch combines fingerprints into a Merkle tree. One root
                represents the whole batch.
              </p>
            </div>
            <div>
              <h3>Anchor</h3>
              <p>
                That root is written to Ethereum. The transaction becomes your
                permanent, public proof.
              </p>
            </div>
          </div>
        </section>

        <section className="landing__section">
          <h2>Why it holds up</h2>
          <div className="landing__grid">
            <div>
              <h3>Irrefutable</h3>
              <p>
                A transaction hash on Ethereum can&apos;t be edited, deleted, or
                backdated. Not by you, not by Etch.
              </p>
            </div>
            <div>
              <h3>Self-hosted</h3>
              <p>
                Run the server yourself. The proof lives on-chain, so your
                certificate verifies even if Etch disappears.
              </p>
            </div>
            <div>
              <h3>Portable</h3>
              <p>
                A certificate is one JSON file. Verify it anywhere, forever.
              </p>
            </div>
          </div>
        </section>

        <section className="landing__close">
          <h2>Timestamp something.</h2>
          <div className="landing__cta">
            <Link className="button button--primary" href="/timestamp">
              Timestamp a file
            </Link>
            <Link className="button button--quiet" href="/verify">
              Verify a certificate
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing__footer">
        <div className="landing__footer-inner">
          <p>Etch · tamper-evident file timestamping</p>
          <p>Anchors to Ethereum. Your files stay yours.</p>
        </div>
      </footer>
    </div>
  );
}
