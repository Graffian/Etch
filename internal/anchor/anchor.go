package anchor

import (
	"context"
	"errors"
	"time"
)

var ErrNotFound = errors.New("anchor : Transaction not found")

type Reciept struct{
	Chain string
	TxHash string
	BlockNumber uint64
	BlockTime time.Time
}

type Anchorer interface{
	Anchor(ctx context.Context , root [32]byte) (Reciept , error)
	Lookup(ctx context.Context , txHash string) ([32]byte , error)
}