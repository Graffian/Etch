# Etch

Tamper-evident proof for files. Drop a file, get a certificate anchored on-chain.

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
│   ├── anchor/
│   ├── store/
│   └── config/
├── web/                      # Next.js frontend
└── docs/
```

See `docs/ARCHITECTURE.md` and `docs/PROOF_FORMAT.md`.
