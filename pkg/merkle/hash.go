package merkle

import "crypto/sha256"

const (
	leafPrefix = 0x00
	nodePrefix = 0x01
)

func HashLeaf(data []byte) [32]byte {
	buf := make([]byte , 0 , 1+len(data))
	buf = append(buf, leafPrefix)
	buf = append(buf, data...)
	return sha256.Sum256(buf)
}

func HashNode(left[32]byte , right[32]byte) [32]byte {
	buf := make([]byte,0,1+32+32)
	buf = append(buf, nodePrefix)
	buf = append(buf, left[:]...)
	buf = append(buf, right[:]...)
	return sha256.Sum256(buf)
}

