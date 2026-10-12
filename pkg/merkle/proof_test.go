package merkle

import (
	"fmt"
	"testing"
)

func makeData(n int) [][]byte{
	data := make([][]byte , n)
	for i:= range data{
		data[i] = []byte(fmt.Sprintf("leaf-%d" , i))
	}
	return data
}

func TestProofVerifiesForEveryLeaf(t *testing.T){
	for n:=1 ; n<=17 ; n++{
		data := makeData(n)
		tree,err := Build(data)
		if err!=nil{
			t.Fatal(err)
		}
		for i:=0 ; i<n ; i++{
			steps,err := tree.Proof(i)
			if err!=nil{
				t.Fatal(err)
			}
			if !Verify(data[i] , steps , tree.Root()){
				t.Fatalf("n=%d leaf=%d : valid proof rejected" , n , i)
			}
		}
	}
}

func TestVerifyRejectsWrongData(t *testing.T){
	tree,_ := Build(makeData(5))
	steps,_ := tree.Proof(2)
	if Verify([]byte("not the file") , steps , tree.Root()){
		t.Fatal("Wrong Data Must not verify")
	}
}

func TestVerifyRejectsTamperedProof(t *testing.T){
	data := makeData(5)
	tree,_ := Build(data)
	steps, _ := tree.Proof(2)
	steps[0].Hash[0] ^= 0xff
	if Verify(data[2] , steps , tree.Root()){
		t.Fatal("Tampered proof must not verify")
	}
}

func TestVerifyRejectsWrongRoot(t *testing.T){
	data := makeData(5)
	tree,_ := Build(data)
	other,_:= Build(makeData(6))
	steps,_ := tree.Proof(2)
	if Verify(data[2] , steps , other.Root()){
		t.Fatal("Proof must not verify against a wrong root")
	}
}

func TestProofOutOfRange(t *testing.T){
	tree , _ := Build(makeData(3))
	_,err := tree.Proof(3)
	if err!=ErrIndexOutOfRange{
		t.Fatalf("Got %v sd be ErrIndexOutOfRange" , err)
	}
	_,err = tree.Proof(-1)
	if err != ErrIndexOutOfRange{
		t.Fatalf("Got %v sd be ErrIndexOutOfRange" , err)
	}
}