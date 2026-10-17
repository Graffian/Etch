package anchor

import (
	"context"
	"testing"
)

func TestAnchorThenLookup(t *testing.T) {
	m := NewMock()
	root := [32]byte{1, 2, 3}
	rcpt, err := m.Anchor(context.Background() , root)
	if err!=nil{
		t.Fatal(err)
	}
	got , err := m.Lookup(context.Background() , rcpt.TxHash)
	if err!=nil{
		t.Fatal(err)
	}
	if got!=root{
		t.Fatal("Lookup must return the anchored root")
	}
}

func TestLookupUnknownTx(t *testing.T){
	m := NewMock()
	_,err := m.Lookup(context.Background() , "0xnope")
	if err!=ErrNotFound{
		t.Fatalf("Got %v want ErrNotFound" , err)
	}
}

func TestSameRootTwiceGivesDifferentHash(t *testing.T){
	m := NewMock()
	root := [32]byte{9}
	a,_ := m.Anchor(context.Background() , root)
	b,_ := m.Anchor(context.Background() , root)
	if a.TxHash == b.TxHash{
		t.Fatal("Each anchor call must produce a diff txhash")
	}
	if b.BlockNumber != a.BlockNumber+1{
		t.Fatal("Block numbers must increase")
	}
}

func TestCancelledContext(t *testing.T){
	m:=NewMock()
	ctx,cancel := context.WithCancel(context.Background())
	cancel()
	_,err := m.Anchor(ctx , [32]byte{})
	if err == nil{
		t.Fatal("A cancelled context must return a error")
	}
}