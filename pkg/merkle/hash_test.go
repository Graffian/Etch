package merkle

import "testing"

func TestHashIsDeterministic(t *testing.T){
	a := HashLeaf([]byte("hello"))
	b := HashLeaf([]byte("hello"))
	if a!=b {
		t.Fatal("Same input must give same Hash")
	}
}



func TestLeafAndNodeAreDomainSeparated(t *testing.T){
	leaf:=HashLeaf(make([]byte, 64))
	var zero [32]byte
	node:=HashNode(zero,zero)
	if leaf==node{
		t.Fatal("Leaf and node hashes must differ")
	}
}