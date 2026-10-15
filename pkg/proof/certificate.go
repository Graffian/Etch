package proof

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/Graffian/etch/pkg/merkle"
)

const Version = 1

var ErrInvalidProof = errors.New("proof : file does not match root")

type Step struct{
	Hash string `json:"hash"`
	Left bool `json:"left"`
}

type Anchor struct{
	Chain string `json:"chain"`
	TxHash string `json:"tx_hash"`
	BlockNumber uint64 `json:"block_number"`
	BlockTime time.Time `json:"block_time"`
}

type Certificate struct{
	Version int `json:"version"`
	FileHash string `json:"file_hash"`
	LeafIndex int `json:"leaf_index"`
	Steps []Step `json:"steps"`
	Root string `json:"root"`
	Anchor Anchor `json:"anchor"`
}

func New(fileHash [32]byte , index int , steps []merkle.Step, root [32]byte, anchor Anchor) *Certificate{
	out := make([]Step , len(steps))
	for i,s := range steps{
		out[i] = Step{
			Hash: hex.EncodeToString(s.Hash[:]),
			Left : s.Left,
		}
	}
	return  &Certificate{
		Version: Version,
		FileHash: hex.EncodeToString(fileHash[:]),
		LeafIndex: index,
		Steps: out,
		Root: hex.EncodeToString(root[:]),
		Anchor: anchor,
	}
}

func (c *Certificate) Verify() error {
	if c.Version != Version{
		return fmt.Errorf("proof:Unsupported version %d" , c.Version)
	}
	fileHash , err := decode32(c.FileHash)
	if err!=nil{
		return fmt.Errorf("proof:File hash : %w" , err)
	}
	root,err := decode32(c.Root)
	if err!=nil{
		return fmt.Errorf("proof:Root:%w" , err)
	}
	steps := make([]merkle.Step , len(c.Steps))
	for i,s := range c.Steps{
		h,err := decode32(s.Hash)
		if err!=nil{
			return  fmt.Errorf("proof : step:%d : %w" , i , &err)
		}
		steps[i] = merkle.Step{
			Hash : h,
			Left : s.Left,
		}
	}
	if !merkle.Verify(fileHash[:] , steps , root){
		return ErrInvalidProof
	}
	return nil
}


func (c *Certificate) Marshal() ([]byte , error){
	return json.MarshalIndent(c , "" , "  ")
}

func Parse(data []byte) (*Certificate , error){
	var c Certificate
	if err := json.Unmarshal(data , &c);err!=nil{
		return nil , fmt.Errorf("proof:parse:%w" , err)
	}
	return &c , nil
}

func decode32(s string) ([32]byte , error) {
	var out [32]byte
	b,err := hex.DecodeString(s)
	if err!= nil{
		return out , fmt.Errorf("invalid hex : %w" , err)
	}
	if len(b) != 32 {
		return out , fmt.Errorf("want 32 byte got %d" , len(b))
	}
	copy(out[:] , b)
	return out,nil
}

