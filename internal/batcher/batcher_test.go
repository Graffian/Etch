package batcher

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/Graffian/etch/internal/anchor"
	"github.com/Graffian/etch/internal/store"
	"github.com/Graffian/etch/pkg/merkle"
)

func TestRunOnceBatchesAndProofsVerify(t *testing.T) {
	ctx := context.Background()
	st := store.NewMemory()
	chain := anchor.NewMock()
	b := New(st, chain, time.Minute)

	hashes := make([][32]byte, 5)
	for i := range hashes {
		hashes[i] = sha256.Sum256([]byte(fmt.Sprintf("file-%d", i)))
		if _, err := st.AddPending(ctx, hashes[i]); err != nil {
			t.Fatal(err)
		}
	}

	id, err := b.RunOnce(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if id == 0 {
		t.Fatal("expected a batch to be created")
	}

	batch, err := st.GetBatch(ctx, id)
	if err != nil {
		t.Fatal(err)
	}

	// The root recorded on the "chain" must be the batch's root.
	onChain, err := chain.Lookup(ctx, batch.Receipt.TxHash)
	if err != nil {
		t.Fatal(err)
	}
	if onChain != batch.Root {
		t.Fatal("root on chain does not match the batch root")
	}

	// Every submission must now carry a proof that climbs to that root.
	for i, h := range hashes {
		sub, err := st.Get(ctx, h)
		if err != nil {
			t.Fatal(err)
		}
		if !sub.Batched() || sub.LeafIndex != i {
			t.Fatalf("hash %d: batched=%v leafIndex=%d", i, sub.Batched(), sub.LeafIndex)
		}
		if !merkle.Verify(h[:], sub.Steps, batch.Root) {
			t.Fatalf("hash %d: proof does not verify against the root", i)
		}
	}

	pending, _ := st.Pending(ctx)
	if len(pending) != 0 {
		t.Fatalf("got %d still pending, want 0", len(pending))
	}
}

func TestRunOnceNothingPending(t *testing.T) {
	b := New(store.NewMemory(), anchor.NewMock(), time.Minute)
	id, err := b.RunOnce(context.Background())
	if err != nil || id != 0 {
		t.Fatalf("got id=%d err=%v, want 0, nil", id, err)
	}
}

// failingAnchor is a fake chain that always errors.
type failingAnchor struct{}

func (failingAnchor) Anchor(context.Context, [32]byte) (anchor.Receipt, error) {
	return anchor.Receipt{}, errors.New("chain down")
}

func (failingAnchor) Lookup(context.Context, string) ([32]byte, error) {
	return [32]byte{}, anchor.ErrNotFound
}

func TestFailedAnchorKeepsHashesPending(t *testing.T) {
	ctx := context.Background()
	st := store.NewMemory()
	st.AddPending(ctx, [32]byte{1})

	b := New(st, failingAnchor{}, time.Minute)
	if _, err := b.RunOnce(ctx); err == nil {
		t.Fatal("expected an error when the chain is down")
	}

	pending, _ := st.Pending(ctx)
	if len(pending) != 1 {
		t.Fatal("hash must stay pending after a failed anchor")
	}
}

func TestRunBatchesOnTimer(t *testing.T) {
	ctx := context.Background()
	st := store.NewMemory()
	st.AddPending(ctx, [32]byte{1})

	b := New(st, anchor.NewMock(), 10*time.Millisecond)

	runCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() {
		defer close(done)
		b.Run(runCtx)
	}()

	// Wait (up to 2s) for the timer to pick the hash up.
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		pending, _ := st.Pending(ctx)
		if len(pending) == 0 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}

	cancel()
	<-done // Run must return once the context is cancelled

	sub, err := st.Get(ctx, [32]byte{1})
	if err != nil || !sub.Batched() {
		t.Fatalf("hash was not batched by the timer: sub=%+v err=%v", sub, err)
	}
}