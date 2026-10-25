# Etch

Tamper-evident proof for files. Hash a file in your browser, sign an anchor
transaction from your wallet, and get a certificate that stays permanently
verifiable on Ethereum (Sepolia testnet).

## Repository layout

```
etch/
├── cmd/
│   ├── etchd/                # server: API + batcher
│   └── etch/                 # CLI: hash, verify
├── pkg/                      # public, importable by others
│   ├── merkle/
│   └── proof/
├── internal/                 # private to the server
│   ├── hasher/
│   ├── api/
│   ├── batcher/
│   ├── anchor/               # mock + EVM (Sepolia) anchorers
│   ├── store/
│   └── config/
├── web/                      # Next.js frontend (landing + tool)
└── docs/
```

## Running

Backend (Go, default `:8080`, in-memory store):

    go run ./cmd/etchd

Frontend (Next.js, default `:3000`):

    cd web
    npm install
    npm run dev

The frontend calls the backend at `http://localhost:8080` by default. Override
with `NEXT_PUBLIC_ETCH_API` (see `web/.env.example`). Set `ETCH_ALLOWED_ORIGIN`
on the backend to match the frontend origin for CORS.

## Anchor modes

`ETCH_ANCHOR_MODE` selects how Merkle roots reach a chain:

- `evm` (default) — **client-sign**. The server batches hashes into a Merkle
  tree and returns the root; your wallet (MetaMask) signs a zero-value
  transaction whose calldata carries the 32-byte root, and the server reads it
  back from Sepolia to finalize the certificate.
- `mock` — the server anchors locally on a fake chain. No wallet, for offline
  development and tests.

In `evm` mode the server reads Sepolia over JSON-RPC:

    ETCH_RPC_URL   default https://ethereum-sepolia-rpc.publicnode.com
    ETCH_CHAIN     default sepolia

The frontend wallet flow needs MetaMask on the Sepolia network with some test
ETH (faucet: sepoliafaucet.com).

## API

    POST /submit       {"hash": "<64 hex>"}                             → 202 pending
    GET  /proof/{hash} → 202 pending | 202 ready (+root & proof) | 200 certificate
    POST /anchor       {"root": "<64 hex>", "tx_hash": "0x…"}          → 200 anchored
    POST /verify       <certificate JSON>                              → {"valid": true|false}

## Certificate format

A certificate pins one file to a Merkle root and a chain anchor:

    {
      "version": 1,
      "file_hash": "<sha256 hex>",
      "leaf_index": 0,
      "steps": [{"hash": "<hex>", "left": true}],
      "root": "<merkle root hex>",
      "anchor": {
        "chain": "sepolia",
        "tx_hash": "0x…",
        "block_number": 123,
        "block_time": "2026-10-26T04:11:00Z"
      }
    }

The transaction's calldata is the 32-byte root, so the proof verifies forever
against the chain, independently of Etch.

See `docs/ARCHITECTURE.md` and `docs/PROOF_FORMAT.md`.
