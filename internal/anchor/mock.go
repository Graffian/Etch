package anchor

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"sync"
	"time"
)

var _ Anchorer = (*Mock)(nil)

type Mock struct {
	mu       sync.Mutex
	block    uint64
	receipts map[string]Reciept
}

func NewMock() *Mock {
	return &Mock{
		receipts: make(map[string]Reciept),
	}
}

func (m *Mock) Anchor(ctx context.Context, root [32]byte) (Reciept, error) {
	err := ctx.Err()
	if err != nil {
		return Reciept{}, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.block++

	buf := make([]byte, 0, 40)
	buf = append(buf, root[:]...)
	buf = binary.BigEndian.AppendUint64(buf, m.block)
	sum := sha256.Sum256(buf)
	tx := "0x" + hex.EncodeToString(sum[:])

	r := Reciept{
		Chain:       "mock",
		TxHash:      tx,
		BlockNumber: m.block,
		BlockTime:   time.Now().UTC(),
		Root:        root,
	}
	m.receipts[tx] = r
	return r, nil
}

func (m *Mock) Lookup(ctx context.Context, txHash string) ([32]byte, error) {
	r, err := m.LookupReceipt(ctx, txHash)
	if err != nil {
		return [32]byte{}, err
	}
	return r.Root, nil
}

func (m *Mock) LookupReceipt(ctx context.Context, txHash string) (Reciept, error) {
	err := ctx.Err()
	if err != nil {
		return Reciept{}, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	r, ok := m.receipts[txHash]
	if !ok {
		return Reciept{}, ErrNotFound
	}
	return r, nil
}
