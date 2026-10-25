package api

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/Graffian/etch/internal/anchor"
	"github.com/Graffian/etch/internal/store"
	"github.com/Graffian/etch/pkg/proof"
)

func (s *Server) handleSubmit(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<10)

	var req submitRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		writeError(w, http.StatusBadRequest, `body must be json like {"hash" : "<64 hex characters>"}`)
		return
	}
	hash, err := parseHash(req.Hash)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx := r.Context()
	created, err := s.store.AddPending(ctx, hash)
	if err != nil {
		serverError(w, "add pending", err)
		return
	}
	if created {
		writeJSON(w, http.StatusAccepted, statusResponse{Hash: hexOf(hash), Status: "pending"})
		return
	}

	sub, err := s.store.Get(ctx, hash)
	if err != nil {
		serverError(w, "get submission", err)
		return
	}
	writeJSON(w, http.StatusOK, statusResponse{Hash: hexOf(hash), Status: statusOf(sub)})
}

func (s *Server) handleProof(w http.ResponseWriter, r *http.Request) {
	hash, err := parseHash(r.PathValue("hash"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx := r.Context()
	sub, err := s.store.Get(ctx, hash)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "unknown hash")
		return
	}
	if err != nil {
		serverError(w, "get submission", err)
		return
	}
	if !sub.Batched() {
		writeJSON(w, http.StatusAccepted, statusResponse{Hash: hexOf(hash), Status: "pending"})
		return
	}
	batch, err := s.store.GetBatch(ctx, sub.BatchID)
	if err != nil {
		serverError(w, "get batch", err)
		return
	}
	if !batch.Anchored() {
		// Batched but not yet anchored: hand the root + proof to the client
		// so its wallet can sign the anchor transaction.
		writeJSON(w, http.StatusAccepted, readyResponse{
			Hash:      hexOf(hash),
			Status:    "ready",
			Root:      hexOf(batch.Root),
			LeafIndex: sub.LeafIndex,
			Steps:     proof.EncodeSteps(sub.Steps),
		})
		return
	}

	cert := proof.New(sub.Hash, sub.LeafIndex, sub.Steps, batch.Root, proof.Anchor{
		Chain:       batch.Reciept.Chain,
		TxHash:      batch.Reciept.TxHash,
		BlockNumber: batch.Reciept.BlockNumber,
		BlockTime:   batch.Reciept.BlockTime,
	})
	writeJSON(w, http.StatusOK, cert)
}

func (s *Server) handleAnchor(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<12)

	var req anchorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, `body must be json like {"root":"<64 hex>","tx_hash":"0x..."}`)
		return
	}
	root, err := parseHash(req.Root)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.TxHash == "" {
		writeError(w, http.StatusBadRequest, "tx_hash is required")
		return
	}

	ctx := r.Context()
	reciept, err := s.anchorer.LookupReceipt(ctx, req.TxHash)
	if errors.Is(err, anchor.ErrNotFound) {
		writeError(w, http.StatusNotFound, "transaction not on chain")
		return
	}
	if err != nil {
		slog.Error("chain lookup failed", "err", err)
		writeError(w, http.StatusBadGateway, "chain lookup failed: "+err.Error())
		return
	}
	if reciept.Root != root {
		writeError(w, http.StatusUnprocessableEntity, "transaction calldata does not carry this Merkle root")
		return
	}

	batch, err := s.store.GetBatchByRoot(ctx, root)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "no batch for this root")
		return
	}
	if err != nil {
		serverError(w, "get batch by root", err)
		return
	}
	if err := s.store.FinalizeBatch(ctx, batch.ID, reciept); err != nil {
		serverError(w, "finalize batch", err)
		return
	}
	writeJSON(w, http.StatusOK, statusResponse{Hash: hexOf(root), Status: "anchored"})
}

func (s *Server) handleVerify(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	data, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "could not read req body")
		return
	}
	cert, err := proof.Parse(data)
	if err != nil {
		writeError(w, http.StatusBadRequest, "not a valid Certificate: "+err.Error())
		return
	}

	if err := cert.Verify(); err != nil {
		writeJSON(w, http.StatusOK, verifyResponse{Valid: false, Reason: err.Error()})
		return
	}

	onChain, err := s.anchorer.Lookup(r.Context(), cert.Anchor.TxHash)
	if errors.Is(err, anchor.ErrNotFound) {
		writeJSON(w, http.StatusOK, verifyResponse{Valid: false, Reason: "Transaction not on chain"})
		return
	}
	if err != nil {
		slog.Error("Chain lookup failed", "err", err)
		writeError(w, http.StatusBadGateway, "chain lookup failed")
		return
	}
	certRoot, err := parseHash(cert.Root)
	if err != nil || certRoot != onChain {
		writeJSON(w, http.StatusOK, verifyResponse{Valid: false, Reason: "Root in certificate does not match root on chain"})
		return
	}
	writeJSON(w, http.StatusOK, verifyResponse{Valid: true})
}

func statusOf(sub store.Submission) string {
	if sub.Batched() {
		return "confirmed"
	}
	return "pending"
}

func hexOf(h [32]byte) string {
	return hex.EncodeToString(h[:])
}

func serverError(w http.ResponseWriter, what string, err error) {
	slog.Error("Request failed", "Step", what, "err", err)
	writeError(w, http.StatusInternalServerError, "internal error")
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	err := json.NewEncoder(w).Encode(v)
	if err != nil {
		slog.Error("write response", "error", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorResponse{Error: msg})
}

func parseHash(s string) ([32]byte, error) {
	var out [32]byte
	b, err := hex.DecodeString(s)
	if err != nil {
		return out, errors.New("Hash must be hex")
	}
	if len(b) != 32 {
		return out, errors.New("Hash must be exactly 32 bytes")
	}
	copy(out[:], b)
	return out, nil
}
