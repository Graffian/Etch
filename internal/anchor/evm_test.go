package anchor

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEVMLookupReceipt(t *testing.T) {
	root := [32]byte{1, 2, 3}
	rootHex := hex.EncodeToString(root[:])

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Method string `json:"method"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)

		switch req.Method {
		case "eth_getTransactionByHash":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"jsonrpc": "2.0",
				"id":      1,
				"result": map[string]any{
					"blockNumber": "0x10d4f",
					"input":       "0x" + rootHex,
				},
			})
		case "eth_getBlockByNumber":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"jsonrpc": "2.0",
				"id":      1,
				"result": map[string]any{
					"timestamp": "0x64c0b7f0",
				},
			})
		default:
			_ = json.NewEncoder(w).Encode(map[string]any{
				"jsonrpc": "2.0",
				"id":      1,
				"error":   map[string]any{"code": -32601, "message": "method not found"},
			})
		}
	}))
	defer ts.Close()

	e := NewEVM(ts.URL, "sepolia")
	rcpt, err := e.LookupReceipt(context.Background(), "0xabc")
	if err != nil {
		t.Fatal(err)
	}
	if rcpt.Root != root {
		t.Fatalf("root = %x want %x", rcpt.Root, root)
	}
	if rcpt.BlockNumber != 0x10d4f {
		t.Fatalf("block = %d want %d", rcpt.BlockNumber, 0x10d4f)
	}
	if rcpt.Chain != "sepolia" {
		t.Fatalf("chain = %q", rcpt.Chain)
	}
	if rcpt.TxHash != "0xabc" {
		t.Fatalf("tx = %q", rcpt.TxHash)
	}
}

func TestEVMLookupNotFound(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"jsonrpc": "2.0", "id": 1, "result": nil})
	}))
	defer ts.Close()

	e := NewEVM(ts.URL, "sepolia")
	_, err := e.LookupReceipt(context.Background(), "0xabc")
	if err != ErrNotFound {
		t.Fatalf("got %v want ErrNotFound", err)
	}
}

func TestEVMBadCalldata(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]any{
				"blockNumber": "0x1",
				"input":       "0x1234", // not 32 bytes
			},
		})
	}))
	defer ts.Close()

	e := NewEVM(ts.URL, "sepolia")
	_, err := e.LookupReceipt(context.Background(), "0xabc")
	if err == nil {
		t.Fatal("expected error for malformed calldata")
	}
}
