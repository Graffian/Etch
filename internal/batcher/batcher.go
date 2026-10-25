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

type Batcher struct {
	store    store.Store
	anchorer anchor.Anchorer
	interval time.Duration
}

func New(s store.Store, a anchor.Anchorer, interval time.Duration) *Batcher {
	return &Batcher{
		store:    s,
		anchorer: a,
		interval: interval,
	}
}

// buildTree groups the pending hashes into a Merkle tree and returns the root
// plus each leaf's proof, in the same order as the pending list.
func buildTree(pending [][32]byte) ([32]byte, [][]merkle.Step, error) {
	leaves := make([][]byte, len(pending))
	for i := range pending {
		leaves[i] = pending[i][:]
	}

	tree, err := merkle.Build(leaves)
	if err != nil {
		return [32]byte{}, nil, fmt.Errorf("batcher : build tree : %w", err)
	}
	root := tree.Root()

	steps := make([][]merkle.Step, len(pending))
	for i := range pending {
		steps[i], err = tree.Proof(i)
		if err != nil {
			return [32]byte{}, nil, fmt.Errorf("Proof for leaf %d : %w", i, err)
		}
	}
	return root, steps, nil
}

// RunOnce builds a batch and anchors it server-side immediately.
func (b *Batcher) RunOnce(ctx context.Context) (int64, error) {
	pending, err := b.store.Pending(ctx)
	if err != nil {
		return 0, fmt.Errorf("Batcher load pending : %w", err)
	}
	if len(pending) == 0 {
		return 0, nil
	}

	root, steps, err := buildTree(pending)
	if err != nil {
		return 0, err
	}

	reciept, err := b.anchorer.Anchor(ctx, root)
	if err != nil {
		return 0, fmt.Errorf("batcher : anchor root : %w", err)
	}

	id, err := b.store.SaveBatch(ctx, store.Batch{
		Root:    root,
		Reciept: reciept,
		Leaves:  pending,
		Steps:   steps,
	})
	if err != nil {
		return 0, fmt.Errorf("Batcher : save batch : %w", err)
	}
	return id, nil
}

// PrepareOnce builds a batch and saves it without anchoring, so a client can
// sign the anchor transaction. It returns the batch id and the Merkle root.
func (b *Batcher) PrepareOnce(ctx context.Context) (int64, [32]byte, error) {
	pending, err := b.store.Pending(ctx)
	if err != nil {
		return 0, [32]byte{}, fmt.Errorf("Batcher load pending : %w", err)
	}
	if len(pending) == 0 {
		return 0, [32]byte{}, nil
	}

	root, steps, err := buildTree(pending)
	if err != nil {
		return 0, [32]byte{}, err
	}

	id, err := b.store.SaveBatch(ctx, store.Batch{
		Root:   root,
		Leaves: pending,
		Steps:  steps,
	})
	if err != nil {
		return 0, [32]byte{}, fmt.Errorf("Batcher : save batch : %w", err)
	}
	return id, root, nil
}

func (b *Batcher) Run(ctx context.Context) {
	b.loop(ctx, false)
}

func (b *Batcher) RunPrepare(ctx context.Context) {
	b.loop(ctx, true)
}

func (b *Batcher) loop(ctx context.Context, prepare bool) {
	ticker := time.NewTicker(b.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if prepare {
				id, _, err := b.PrepareOnce(ctx)
				if err != nil {
					slog.Error("Batch prepare failed", "err", err)
					continue
				}
				if id != 0 {
					slog.Info("batch prepared for client anchor", "batch_id", id)
				}
				continue
			}
			id, err := b.RunOnce(ctx)
			if err != nil {
				slog.Error("Batch failed", "err", err)
				continue
			}
			if id != 0 {
				slog.Info("batch anchored", "batch_id", id)
			}
		}
	}
}
