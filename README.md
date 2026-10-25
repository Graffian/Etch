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

## Running

Backend (Go, default `:8080`, in-memory store + mock anchor):

    go run ./cmd/etchd

Frontend (Next.js, default `:3000`):

    cd web
    npm install
    npm run dev

The frontend calls the backend at `http://localhost:8080` by default. Override
with `NEXT_PUBLIC_ETCH_API` (see `web/.env.example`) if the backend runs
elsewhere. Set `ETCH_ALLOWED_ORIGIN` on the backend to match the frontend origin
for CORS.

See `docs/ARCHITECTURE.md` and `docs/PROOF_FORMAT.md`.
