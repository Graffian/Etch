package anchor

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

var _ Anchorer = (*EVM)(nil)

// EVM anchors to an EVM chain by reading a transaction whose calldata carries
// a 32-byte Merkle root. The client's wallet signs that transaction; the server
// only reads it back from the chain to finalize the certificate.
type EVM struct {
	rpcURL string
	chain  string
	client *http.Client
}

func NewEVM(rpcURL, chain string) *EVM {
	return &EVM{
		rpcURL: rpcURL,
		chain:  chain,
		client: &http.Client{Timeout: 20 * time.Second},
	}
}

// Anchor is not used in client-sign mode: the user's wallet signs the anchor.
func (e *EVM) Anchor(ctx context.Context, root [32]byte) (Reciept, error) {
	return Reciept{}, errors.New("anchor: server-side anchoring disabled; the client's wallet signs the anchor")
}

func (e *EVM) Lookup(ctx context.Context, txHash string) ([32]byte, error) {
	r, err := e.LookupReceipt(ctx, txHash)
	if err != nil {
		return [32]byte{}, err
	}
	return r.Root, nil
}

type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	Method  string `json:"method"`
	Params  []any  `json:"params"`
	ID      int    `json:"id"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type rpcResponse struct {
	Result json.RawMessage `json:"result"`
	Error  *rpcError       `json:"error"`
}

func (e *EVM) call(ctx context.Context, method string, params ...any) (json.RawMessage, error) {
	body, err := json.Marshal(rpcRequest{JSONRPC: "2.0", Method: method, Params: params, ID: 1})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.rpcURL, strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := e.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("anchor: rpc request: %w", err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("anchor: rpc status %d", resp.StatusCode)
	}
	var r rpcResponse
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, err
	}
	if r.Error != nil {
		return nil, fmt.Errorf("anchor: rpc error %d: %s", r.Error.Code, r.Error.Message)
	}
	return r.Result, nil
}

func (e *EVM) LookupReceipt(ctx context.Context, txHash string) (Reciept, error) {
	result, err := e.call(ctx, "eth_getTransactionByHash", txHash)
	if err != nil {
		return Reciept{}, err
	}
	if len(result) == 0 || string(result) == "null" {
		return Reciept{}, ErrNotFound
	}

	var tx struct {
		BlockNumber *string `json:"blockNumber"`
		Input       string  `json:"input"`
	}
	if err := json.Unmarshal(result, &tx); err != nil {
		return Reciept{}, err
	}
	if tx.BlockNumber == nil {
		return Reciept{}, errors.New("anchor: transaction not mined yet")
	}
	blockNumber, err := hexToUint(*tx.BlockNumber)
	if err != nil {
		return Reciept{}, err
	}
	root, err := rootFromCalldata(tx.Input)
	if err != nil {
		return Reciept{}, err
	}

	blockResult, err := e.call(ctx, "eth_getBlockByNumber", *tx.BlockNumber, false)
	if err != nil {
		return Reciept{}, err
	}
	var block struct {
		Timestamp string `json:"timestamp"`
	}
	if err := json.Unmarshal(blockResult, &block); err != nil {
		return Reciept{}, err
	}
	ts, err := hexToUint(block.Timestamp)
	if err != nil {
		return Reciept{}, err
	}

	return Reciept{
		Chain:       e.chain,
		TxHash:      strings.ToLower(txHash),
		BlockNumber: blockNumber,
		BlockTime:   time.Unix(int64(ts), 0).UTC(),
		Root:        root,
	}, nil
}

func rootFromCalldata(input string) ([32]byte, error) {
	var out [32]byte
	if !strings.HasPrefix(input, "0x") {
		return out, errors.New("anchor: transaction has no calldata")
	}
	b, err := hex.DecodeString(input[2:])
	if err != nil {
		return out, errors.New("anchor: transaction calldata is not hex")
	}
	if len(b) != 32 {
		return out, errors.New("anchor: transaction calldata must be exactly 32 bytes (the Merkle root)")
	}
	copy(out[:], b)
	return out, nil
}

func hexToUint(s string) (uint64, error) {
	s = strings.TrimPrefix(s, "0x")
	if s == "" {
		return 0, errors.New("anchor: empty hex")
	}
	return strconv.ParseUint(s, 16, 64)
}
