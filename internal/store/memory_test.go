package store

import (
	"context"
	"testing"

	"github.com/Graffian/etch/pkg/merkle"
)

func h(b byte) [32]byte {
	return [32]byte{b}
}

func TestAddPendingDedupes(t *testing.T) {
	s := NewMemory()
	ctx := context.Background()

	created,err := s.AddPending(ctx , h(1))
	if err!=nil || !created{
		t.Fatalf("First submit : created-%v err-%v" , created , err)
	}
	created,err = s.AddPending(ctx , h(1))
	if err!=nil || created{
		t.Fatalf("second submit of same hash: created-%v err-%v , want false and nil" , created , err)
	}
	pending , _ := s.Pending(ctx)
	if len(pending)!=1{
		t.Fatalf("Got %d pending , want 1" , len(pending))
	}
}

func TestPendingKeepsSubmissionOrder(t *testing.T){
	s := NewMemory()
	ctx := context.Background()
	for _,b := range []byte{3,1,2}{
		s.AddPending(ctx , h(b))
	}
	got,_ := s.Pending(ctx)
	want := [][32]byte{h(3) , h(1) , h(2)}
	if len(got) != len(want){
		t.Fatalf("Got %d want %d" , len(got) , len(want))
	}
	for i := range want{
		if got[i] != want[i]{
			t.Fatalf("pending [%d] is out of order" , i)
		}
	}
}

func TestSaveBatchMarksSubmissions(t *testing.T){
	s:=NewMemory()
	ctx := context.Background()
	s.AddPending(ctx , h(1))
	s.AddPending(ctx , h(2))
	s.AddPending(ctx , h(3))

	step := []merkle.Step{{Left: true}}
	id , err := s.SaveBatch(ctx , Batch{
		Root: [32]byte{9},
		Leaves: [][32]byte{h(1) , h(2)},
		Steps: [][]merkle.Step{step , step},
	})

	if err != nil{
		t.Fatal(err)
	}
	if id == 0 {
		t.Fatal("batch ID must be non zero")
	}

	sub,err := s.Get(ctx , h(2))
	if err!= nil{
		t.Fatal(err)
	}
	if !sub.Batched() || sub.BatchID != id || sub.LeafIndex != 1 {
		t.Fatalf("Unexpected Submission : %+v" , sub)
	}

	pending,_ := s.Pending(ctx)
	if len(pending) != 1 || pending[0]!=h(3){
		t.Fatalf("pending = %v , want only h(3)" , pending)
	}

	b,err := s.GetBatch(ctx , id)
	if err!= nil || b.Root != [32]byte{9} {
		t.Fatalf("GetBatch : root=%v err=%v" , b.Root , err)
	}
}

func TestSaveBatchRejectsBadLeaves(t *testing.T){
	s := NewMemory()
	ctx := context.Background()

	_,err := s.SaveBatch(ctx , Batch{
		Leaves: [][32]byte{h(1)},
		Steps: [][]merkle.Step{nil},
	})
	if err != ErrNotPending{
		t.Fatalf("unknown hash : got %v want ErrnotPending" , err)
	}

	s.AddPending(ctx , h(1))
	b := Batch{
		Leaves: [][32]byte{h(1)},
		Steps: [][]merkle.Step{nil},
	}
	_,errs := s.SaveBatch(ctx , b)
	if errs != nil{
		t.Fatal(errs)
	}
	_,errrs := s.SaveBatch(ctx , b)
	if errrs!=ErrNotPending{
		t.Fatalf("Already batched got %v want ErrNotPending" , errrs)
	}
}

func TestGetUnknown(t *testing.T){
	s := NewMemory()
	_,err := s.Get(context.Background() , h(1))
	if err!=ErrNotFound{
		t.Fatalf("Got %v want ErrNotFound" , err)
	}
}