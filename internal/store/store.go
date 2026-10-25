package store

import (
	"context"
	"errors"
	"time"

	"github.com/Graffian/etch/internal/anchor"
	"github.com/Graffian/etch/pkg/merkle"
)

var (
	ErrNotFound   = errors.New("store : Not Found")
	ErrNotPending = errors.New("store : hash is not pending")
)

type Submission struct {
	Hash      [32]byte
	CreatedAt time.Time
	BatchID   int64
	LeafIndex int
	Steps     []merkle.Step
}

func (s Submission) Batched() bool {
	return s.BatchID != 0
}

type Batch struct {
	ID      int64
	Root    [32]byte
	Reciept anchor.Reciept
	Leaves  [][32]byte
	Steps   [][]merkle.Step
}

// Anchored reports whether the batch has a finalized on-chain receipt.
func (b Batch) Anchored() bool {
	return b.Reciept.TxHash != ""
}

type Store interface {
	AddPending(ctx context.Context, hash [32]byte) (created bool, err error)
	Pending(ctx context.Context) ([][32]byte, error)
	SaveBatch(ctx context.Context, b Batch) (int64, error)
	Get(ctx context.Context, hash [32]byte) (Submission, error)
	GetBatch(ctx context.Context, id int64) (Batch, error)
	GetBatchByRoot(ctx context.Context, root [32]byte) (Batch, error)
	FinalizeBatch(ctx context.Context, id int64, receipt anchor.Reciept) error
}
