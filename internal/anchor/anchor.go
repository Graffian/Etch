package anchor

import (
	"context"
	"errors"
	"time"
)

var ErrNotFound = errors.New("anchor: transaction not found")

type Reciept struct {
	Chain       string
	TxHash      string
	BlockNumber uint64
	BlockTime   time.Time
	Root        [32]byte
}

type Anchorer interface {
	// Anchor anchors a root server-side. Unused in client-sign mode.
	Anchor(ctx context.Context, root [32]byte) (Reciept, error)
	// Lookup returns the root recorded by the anchor transaction.
	Lookup(ctx context.Context, txHash string) ([32]byte, error)
	// LookupReceipt returns the full on-chain receipt (block info and root)
	// so a client-signed anchor can be verified and finalized.
	LookupReceipt(ctx context.Context, txHash string) (Reciept, error)
}
