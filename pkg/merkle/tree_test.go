package merkle
import "testing"

func TestBuildEmpty(t *testing.T){
	_,err := Build(nil)
	if err!= ErrNoLeaves {
		t.Fatalf("got %v want ErrnoLeaves" , err)
	}
}

func TestBuildOneLeaf(t *testing.T){
	tree,err := Build([][]byte{[]byte("a")})
	if err != nil{
		t.Fatal(err)
	}
	if tree.Root() != HashLeaf([]byte("a")){
		t.Fatal("root of a one leaf tree must be same as the leaf hash")
	}
}

func TestBuildTwoLeaves(t *testing.T){
	tree,_ := Build([][]byte{[]byte("a") , []byte("b")})
	want := HashNode(HashLeaf([]byte("a")) , HashLeaf([]byte("b")))
	if tree.Root() != want {
		t.Fatal("Root must be hashnode (Leaf A , Leaf B)")
	}
}

func TestBuildThreeLeavesPromotesOdd(t *testing.T){
	tree,_ := Build([][]byte{[]byte("a") , []byte("b") , []byte("c")})
	ab:= HashNode(HashLeaf([]byte("a")) , HashLeaf([]byte("b")))
	want:= HashNode(ab , HashLeaf([]byte("c")))
	if tree.Root() != want {
		t.Fatal("odd leaf sd be promoted")
	}
}

func TestRootChangesWhenLeafChanges(t *testing.T){
	t1,_ := Build([][]byte {[]byte("a") , []byte("b") , []byte("c")})
	t2,_ := Build([][]byte {[]byte("a") , []byte("b") , []byte("X")})
	if t1.Root() == t2.Root(){
		t.Fatal("Root should change with change in leaves")
	}
}