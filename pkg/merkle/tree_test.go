package merkle
import "testing"

func TestBuildEmpty(t *testing.T){
	_,err := Build(nil)
	if err!= ErrNoLeaves {
		t.Fatalf("got %v want ErrnoLeaves" , err)
	}
}
