package proof

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/Graffian/etch/pkg/merkle"
)

func setup(t *testing.T) *Certificate {
	t.Helper()
	hashes := make([][32]byte, 5)
	data := make([][]byte, 5)
	for i := range hashes {
		hashes[i] = sha256.Sum256([]byte(fmt.Sprintf("file-%d" , i)))
		data[i] = hashes[i][:]
	}

	tree,err := merkle.Build(data)
	if err!=nil{
		t.Fatal(err)
	}
	steps,err := tree.Proof(3)
	if err!= nil {
		t.Fatal(err)
	}
	anchor := Anchor{
		Chain: "mock",
		TxHash: "0xabc",
		BlockNumber: 1,
		BlockTime: time.Unix(0,0).UTC(),
	}
	raw,err := New(hashes[3] , 3 , steps , tree.Root() , anchor).Marshal()
	if err!= nil{
		t.Fatal(err)
	}
	cert,err := Parse(raw)
	if err != nil{
		t.Fatal(err)
	}
	return cert

}

func TestRoundTripVerifies(t *testing.T) {
	if err := setup(t).Verify();err!=nil{
		t.Fatal(err)
	}
}

func TestWrongFileFails(t *testing.T){
	cert := setup(t)
	other := sha256.Sum256([]byte("some other file"))
	cert.FileHash = fmt.Sprintf("%x" , other)
	if err := cert.Verify(); !errors.Is(err , ErrInvalidProof){
		t.Fatalf("got %v want errorinvalidproof" , err)
	}
}

func TestBadHexFails(t *testing.T){
	cert := setup(t)
	cert.Root = "not hex"
	if err := cert.Verify(); err == nil {
		t.Fatal("bad hex must return an error")
	} 
}
