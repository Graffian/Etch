package merkle

import "errors"

var ErrNoLeaves = errors.New("merkle: No Leaves")

type Tree struct {
	levels [][][32]byte
}

func Build(data [][]byte) (*Tree , error) {
	if len(data) == 0 {
		return nil,ErrNoLeaves
	}
	leaves := make([][32]byte , len(data))
	for i,d := range data{
		leaves[i] = HashLeaf(d)
	}

	levels := [][][32]byte{leaves}
	current := leaves
	for len(current)>1{
		next:= make([][32]byte , 0 , (len(current)+1)/2)
		for i:=0 ; i<len(current) ; i+=2 {
			if i+1 < len(current){
				next = append(next, HashNode(current[i] , current[i+1]))
			}else{
				next = append(next, current[i])
			}
		}
		levels = append(levels, next)
		current = next
	}
	return &Tree{levels: levels} , nil
}

func (t *Tree) Root() [32]byte{
	top := t.levels[len(t.levels)-1]
	return  top[0]
}

func (t *Tree) Len() int{
	return len(t.levels[0])
}