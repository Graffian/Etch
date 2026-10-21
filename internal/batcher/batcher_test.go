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
	b := New(st , chain , time.Minute)

	hashes := make([][32]byte, 5)
	for i := range hashes{
		hashes[i] = sha256.Sum256([]byte(fmt.Sprintf("file-%d" , i)))
		_ , err := st.AddPending(ctx , hashes[i])
		if err!=nil{
			t.Fatal(err)
		}
	}

	id , err := b.RunOnce(ctx)
	if err!=nil{
		t.Fatal(err)
	}
	if id==0{
		t.Fatal("Expected a batch to be created")
	}

	batch,err := st.GetBatch(ctx , id)
	if err!=nil{
		t.Fatal(err)
	}

	onChain , err := chain.Lookup(ctx , batch.Reciept.TxHash)
	if err!=nil {
		t.Fatal(err)
	}
	if onChain != batch.Root{
		t.Fatal("Root on chain does not match batch root")
	}

	for i,h := range hashes{
		sub , err := st.Get(ctx , h)
		if err!=nil{
			t.Fatal(err)
		}
		if !sub.Batched() || sub.LeafIndex!=i{
			t.Fatalf("Hash ; %d : batched=%v leafIndex=%d" , i , sub.Batched() , sub.LeafIndex)
		}
		if !merkle.Verify(h[:] , sub.Steps , batch.Root){
			t.Fatalf("Hash : %d proof does not verify against root" , i)
		}
	}

	pending , _ := st.Pending(ctx)
	if len(pending) != 0 {
		t.Fatalf("Got %d still pending want 0" , len(pending))
	}
}

func TestRunOnceNothingPending(t *testing.T){
	b:=New(store.NewMemory() , anchor.NewMock() , time.Minute)
	id , err := b.RunOnce(context.Background())
	if err!=nil || id !=0{
		t.Fatalf("Got id=%d err=%v , want 0 , nil" , id , err)
	}
}

type failingAnchor struct{}

func (failingAnchor) Anchor(context.Context , [32]byte) (anchor.Reciept , error){
	return anchor.Reciept{} , errors.New("chain down")
}

func (failingAnchor) Lookup(context.Context , string) ([32]byte , error){
	return [32]byte{} , anchor.ErrNotFound
}

func TestFailedAnchorKeepsHashesPending(t *testing.T){
	ctx := context.Background()
	st := store.NewMemory()
	st.AddPending(ctx , [32]byte{1})

	b:= New(st , failingAnchor{},time.Minute)
	_,err := b.RunOnce(ctx)
	if err == nil{
		t.Fatal("Expected an error when chain is down")
	}
	pending,_ := st.Pending(ctx)
	if len(pending) != 1{
		t.Fatal("Hash must stay pending after a failed anchor")
	}
}


func TestRunBatchesOnTimer(t *testing.T){
	ctx := context.Background()
	st := store.NewMemory()
	st.AddPending(ctx , [32]byte{1})

	b := New(st , anchor.NewMock() , 10*time.Millisecond)

	runCtx , cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func(){
		defer close(done)
		b.Run(runCtx)
	}()

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		pending , _ := st.Pending(ctx)
		if len(pending) == 0{
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	cancel()
	<-done

	sub,err := st.Get(ctx , [32]byte{1})
	if err!=nil || !sub.Batched(){
		t.Fatalf("Hash was not batched by the timer : sub=%v err=%v" , sub ,err)
	}
}