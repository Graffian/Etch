// Package batcher periodically turns pending hashes into an anchored Merkle batch.
package batcher

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/Graffian/etch/internal/anchor"
	"github.com/Graffian/etch/internal/store"
	"github.com/Graffian/etch/pkg/merkle"
)

// Batcher ties the store, the Merkle tree and the chain together.
type Batcher struct {
	store    store.Store
	anchorer anchor.Anchorer
	interval time.Duration
}

// New returns a Batcher that runs every interval. interval must be positive.
func New(s store.Store, a anchor.Anchorer, interval time.Duration) *Batcher {
	return &Batcher{store: s, anchorer: a, interval: interval}
}

// RunOnce turns everything currently pending into one batch.
// It returns the new batch ID, or 0 if nothing was pending.
func (b *Batcher) RunOnce(ctx context.Context) (int64, error) {
	pending, err := b.store.Pending(ctx)
	if err != nil {
		return 0, fmt.Errorf("batcher: load pending: %w", err)
	}
	if len(pending) == 0 {
		return 0, nil
	}

	// The leaf data is each file hash's 32 raw bytes.
	leaves := make([][]byte, len(pending))
	for i := range pending {
		leaves[i] = pending[i][:]
	}

	tree, err := merkle.Build(leaves)
	if err != nil {
		return 0, fmt.Errorf("batcher: build tree: %w", err)
	}
	root := tree.Root()

	// Compute every proof BEFORE anchoring: cheap work first, costly step last.
	steps := make([][]merkle.Step, len(pending))
	for i := range pending {
		steps[i], err = tree.Proof(i)
		if err != nil {
			return 0, fmt.Errorf("batcher: proof for leaf %d: %w", i, err)
		}
	}

	receipt, err := b.anchorer.Anchor(ctx, root)
	if err != nil {
		return 0, fmt.Errorf("batcher: anchor root: %w", err)
	}

	id, err := b.store.SaveBatch(ctx, store.Batch{
		Root:    root,
		Receipt: receipt,
		Leaves:  pending,
		Steps:   steps,
	})
	if err != nil {
		return 0, fmt.Errorf("batcher: save batch: %w", err)
	}
	return id, nil
}

// Run calls RunOnce every interval until ctx is cancelled.
func (b *Batcher) Run(ctx context.Context) {
	ticker := time.NewTicker(b.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			id, err := b.RunOnce(ctx)
			if err != nil {
				slog.Error("batch failed", "err", err)
				continue
			}
			if id != 0 {
				slog.Info("batch anchored", "batch_id", id)
			}
		}
	}
}