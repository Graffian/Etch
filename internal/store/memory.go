package store

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/Graffian/etch/internal/anchor"
	"github.com/Graffian/etch/pkg/merkle"
)

var _ Store = (*Memory)(nil)

type Memory struct {
	mu          sync.Mutex
	submissions map[[32]byte]*Submission
	pending     [][32]byte
	batches     map[int64]Batch
	roots       map[[32]byte]int64
	nextBatchID int64
}

func NewMemory() *Memory {
	return &Memory{
		submissions: make(map[[32]byte]*Submission),
		batches:     make(map[int64]Batch),
		roots:       make(map[[32]byte]int64),
	}
}

func (m *Memory) AddPending(ctx context.Context, hash [32]byte) (bool, error) {
	err := ctx.Err()
	if err != nil {
		return false, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	_, ok := m.submissions[hash]
	if ok {
		return false, nil
	}
	m.submissions[hash] = &Submission{
		Hash:      hash,
		CreatedAt: time.Now().UTC(),
	}
	m.pending = append(m.pending, hash)
	return true, nil
}

func (m *Memory) Pending(ctx context.Context) ([][32]byte, error) {
	err := ctx.Err()
	if err != nil {
		return nil, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	out := make([][32]byte, len(m.pending))
	copy(out, m.pending)
	return out, nil
}

func (m *Memory) SaveBatch(ctx context.Context, b Batch) (int64, error) {
	err := ctx.Err()
	if err != nil {
		return 0, err
	}
	if len(b.Leaves) != len(b.Steps) {
		return 0, errors.New("store : Leaves and steps must have same length")
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, h := range b.Leaves {
		s, ok := m.submissions[h]
		if !ok || s.Batched() {
			return 0, ErrNotPending
		}
	}
	m.nextBatchID++
	b.ID = m.nextBatchID

	inBatch := make(map[[32]byte]bool, len(b.Leaves))
	for i, h := range b.Leaves {
		s := m.submissions[h]
		s.BatchID = b.ID
		s.LeafIndex = i
		s.Steps = b.Steps[i]
		inBatch[h] = true
	}

	kept := m.pending[:0]
	for _, h := range m.pending {
		if !inBatch[h] {
			kept = append(kept, h)
		}
	}
	m.pending = kept
	m.batches[b.ID] = b
	m.roots[b.Root] = b.ID
	return b.ID, nil
}

func (m *Memory) Get(ctx context.Context, hash [32]byte) (Submission, error) {
	err := ctx.Err()
	if err != nil {
		return Submission{}, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	s, ok := m.submissions[hash]
	if !ok {
		return Submission{}, ErrNotFound
	}
	out := *s
	out.Steps = append([]merkle.Step(nil), s.Steps...)
	return out, nil
}

func (m *Memory) GetBatch(ctx context.Context, id int64) (Batch, error) {
	err := ctx.Err()
	if err != nil {
		return Batch{}, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	b, ok := m.batches[id]
	if !ok {
		return Batch{}, ErrNotFound
	}
	return b, nil
}

func (m *Memory) GetBatchByRoot(ctx context.Context, root [32]byte) (Batch, error) {
	err := ctx.Err()
	if err != nil {
		return Batch{}, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	id, ok := m.roots[root]
	if !ok {
		return Batch{}, ErrNotFound
	}
	b, ok := m.batches[id]
	if !ok {
		return Batch{}, ErrNotFound
	}
	return b, nil
}

func (m *Memory) FinalizeBatch(ctx context.Context, id int64, receipt anchor.Reciept) error {
	err := ctx.Err()
	if err != nil {
		return err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	b, ok := m.batches[id]
	if !ok {
		return ErrNotFound
	}
	b.Reciept = receipt
	m.batches[id] = b
	return nil
}
