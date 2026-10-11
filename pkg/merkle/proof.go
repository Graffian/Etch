package merkle
import "errors"
var ErrIndexOutOfRange = errors.New("Merkle : Leaf out of range")


type Step struct{
	Hash [32]byte
	Left bool
}

func(t *Tree) Proof(index int) ([]Step , error){
	if index<0 || index>=t.Len() {
		return nil,ErrIndexOutOfRange
	}

	var steps []Step
	idx:=index
	for level:=0 ; level<len(t.levels)-1 ; level++{
		row := t.levels[level]
		if idx%2 == 0{
			if idx+1 <len(row) {
				steps = append(steps, Step{Hash: row[idx+1] , Left: false})
			}
		}else{
			steps = append(steps, Step{Hash: row[idx-1] , Left: true})
		}
		idx/=2
	}
	return steps,nil
}

func Verify(data []byte , steps []Step , root [32]byte) bool {
	h := HashLeaf(data)
	for _,s := range steps {
		if s.Left{
			h = HashNode(s.Hash , h)
		}else{
			h = HashNode(h,s.Hash)
		}
	}
	return h==root
}