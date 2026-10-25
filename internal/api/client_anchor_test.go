package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Graffian/etch/internal/anchor"
	"github.com/Graffian/etch/internal/batcher"
	"github.com/Graffian/etch/internal/store"
)

type stubAnchorer struct {
	root    [32]byte
	receipt anchor.Reciept
}

func (s *stubAnchorer) Anchor(context.Context, [32]byte) (anchor.Reciept, error) {
	return s.receipt, nil
}

func (s *stubAnchorer) Lookup(context.Context, string) ([32]byte, error) {
	return s.root, nil
}

func (s *stubAnchorer) LookupReceipt(context.Context, string) (anchor.Reciept, error) {
	return s.receipt, nil
}

func TestClientSignAnchorFlow(t *testing.T) {
	ctx := context.Background()
	st := store.NewMemory()

	fileHash := sha256.Sum256([]byte("client signed file"))
	hexHash := hex.EncodeToString(fileHash[:])
	if _, err := st.AddPending(ctx, fileHash); err != nil {
		t.Fatal(err)
	}

	stub := &stubAnchorer{
		receipt: anchor.Reciept{
			Chain:       "sepolia",
			TxHash:      "0xdeadbeef",
			BlockNumber: 42,
			BlockTime:   time.Now().UTC(),
		},
	}

	b := batcher.New(st, stub, time.Minute)
	_, root, err := b.PrepareOnce(ctx)
	if err != nil {
		t.Fatal(err)
	}
	stub.root = root
	stub.receipt.Root = root

	h := New(st, stub).Handler()

	// Proof should report "ready" (batched, not yet anchored).
	rec := do(t, h, "GET", "/proof/"+hexHash, "")
	if rec.Code != http.StatusAccepted {
		t.Fatalf("ready proof: got %d body %s", rec.Code, rec.Body)
	}
	if !strings.Contains(rec.Body.String(), `"ready"`) {
		t.Fatalf("expected ready status: %s", rec.Body)
	}

	// Client signs; server finalizes.
	rec = do(t, h, "POST", "/anchor", fmt.Sprintf(`{"root":%q,"tx_hash":"0xdeadbeef"}`, hex.EncodeToString(root[:])))
	if rec.Code != http.StatusOK {
		t.Fatalf("anchor: got %d body %s", rec.Code, rec.Body)
	}

	// Proof now returns a full certificate with the tx hash.
	rec = do(t, h, "GET", "/proof/"+hexHash, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("cert proof: got %d body %s", rec.Code, rec.Body)
	}
	if !strings.Contains(rec.Body.String(), "0xdeadbeef") {
		t.Fatalf("cert missing tx hash: %s", rec.Body)
	}
}

func TestAnchorRejectsWrongRoot(t *testing.T) {
	ctx := context.Background()
	st := store.NewMemory()

	fileHash := sha256.Sum256([]byte("client signed file"))
	if _, err := st.AddPending(ctx, fileHash); err != nil {
		t.Fatal(err)
	}

	stub := &stubAnchorer{
		root:    [32]byte{9, 9, 9}, // on-chain root differs
		receipt: anchor.Reciept{Chain: "sepolia", TxHash: "0xdeadbeef", Root: [32]byte{9, 9, 9}},
	}

	b := batcher.New(st, stub, time.Minute)
	_, root, err := b.PrepareOnce(ctx)
	if err != nil {
		t.Fatal(err)
	}

	h := New(st, stub).Handler()
	rec := do(t, h, "POST", "/anchor", fmt.Sprintf(`{"root":%q,"tx_hash":"0xdeadbeef"}`, hex.EncodeToString(root[:])))
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("anchor wrong root: got %d want 422, body %s", rec.Code, rec.Body)
	}
}
