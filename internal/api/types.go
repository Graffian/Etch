package api

import "github.com/Graffian/etch/pkg/proof"

type submitRequest struct {
	Hash string `json:"Hash"`
}

type statusResponse struct {
	Hash   string `json:"hash"`
	Status string `json:"status"`
}

type readyResponse struct {
	Hash      string       `json:"hash"`
	Status    string       `json:"status"`
	Root      string       `json:"root"`
	LeafIndex int          `json:"leaf_index"`
	Steps     []proof.Step `json:"steps"`
}

type anchorRequest struct {
	Root   string `json:"root"`
	TxHash string `json:"tx_hash"`
}

type verifyResponse struct {
	Valid  bool   `json:"valid"`
	Reason string `json:"reason,omitempty"`
}

type errorResponse struct {
	Error string `json:"error"`
}
