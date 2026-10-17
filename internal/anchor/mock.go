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
	mu sync.Mutex
	block uint64
	roots map[string][32]byte
}

func NewMock() *Mock{
	return &Mock{
		roots: make(map[string][32]byte),
	}
}

func (m *Mock) Anchor(ctx context.Context , root [32]byte) (Reciept , error){
	err := ctx.Err()
	if err != nil{
		return Reciept{} , err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.block++

	buf := make([]byte , 0 , 40)
	buf = append(buf, root[:]...)
	buf = binary.BigEndian.AppendUint64(buf , m.block)
	sum := sha256.Sum256(buf)
	tx := "0x" + hex.EncodeToString(sum[:])

	m.roots[tx] = root

	return Reciept{
		Chain: "mock",
		TxHash: tx,
		BlockNumber: m.block,
		BlockTime: time.Now().UTC(),
	} , nil
}

func (m *Mock) Lookup(ctx context.Context , txHash string) ([32]byte , error){
	err := ctx.Err()
	if err!=nil{
		return [32]byte{} , err
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	root,ok := m.roots[txHash]
	if !ok{
		return [32]byte{} , ErrNotFound
	}
	return root , nil
}