package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Graffian/etch/internal/anchor"
	"github.com/Graffian/etch/internal/batcher"
	"github.com/Graffian/etch/internal/store"
	"github.com/Graffian/etch/pkg/proof"
)

func do(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method , path , strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec , req)
	return rec
}

func confirmedCert(t *testing.T) (http.Handler , *anchor.Mock , *proof.Certificate){
	t.Helper()
	st := store.NewMemory()
	chain := anchor.NewMock()
	h := New(st , chain).Handler()

	fileHash := sha256.Sum256([]byte("my file"))
	hexHash := hex.EncodeToString(fileHash[:])

	do(t , h , "POST" , "/submit" , fmt.Sprintf(`{"hash" : %q}` , hexHash))
	_,err := batcher.New(st , chain , time.Minute).RunOnce(context.Background())
	if err != nil{
		t.Fatal(err)
	}
	rec := do(t , h , "GET" , "/proof/"+hexHash , "")
	if rec.Code != http.StatusOK {
		t.Fatalf("proof : got %d , body : %s" , rec.Code , rec.Body)
	}
	cert , err := proof.Parse(rec.Body.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	return h,chain,cert
}

func TestFullFLow(t *testing.T) {
	h,_,cert := confirmedCert(t)

	want := sha256.Sum256([]byte("my file"))
	if cert.FileHash != hex.EncodeToString(want[:]){
		t.Fatal("Certificate is for the wrong file hash")
	}
	err := cert.Verify()
	if err != nil{
		t.Fatal(err)
	}

	raw , _ := cert.Marshal()
	rec := do(t , h , "POST" , "/verify" , string(raw))
	var vr verifyResponse
	if err := json.Unmarshal(rec.Body.Bytes() , &vr);err !=nil{
		t.Fatal(err)
	}
	if rec.Code != http.StatusOK || !vr.Valid{
		t.Fatalf("verify : code = %d response=%+v" , rec.Code , vr)
	}
}


func TestProofIsPendingUntilBatched(t *testing.T){
	h := New(store.NewMemory() , anchor.NewMock()).Handler()
	hexHash := strings.Repeat("ef" , 32)

	do(t , h , "POST" , "/submit" , fmt.Sprintf(`{"hash" : %q}` , hexHash))
	rec := do(t , h , "GET" , "/proof/"+hexHash , "")
	if rec.Code != http.StatusAccepted {
		t.Fatalf("Got %d want 202" , rec.Code)
	}
	if !strings.Contains(rec.Body.String() , `"pending"`){
		t.Fatalf("body sd say pending : %s" , rec.Body)
	}
}

func TestSubmitRejectsBadInput(t *testing.T){
	h := New(store.NewMemory() , anchor.NewMock()).Handler()
	tests := []struct{name,body string}{
		{"not json" , "nope"},
		{"not hex" , `{"hash" : "zzzz"}`},
		{"too short" , `{"hash" ; "abcd"}`},
		{"missing field" , `{}`},
	}
	for _,tc := range tests{
		t.Run(tc.name , func(t *testing.T) {
			rec := do(t , h , "POST" , "/submit" , tc.body)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("Got %d want 400" , rec.Code)
			}
		})
	}
}


func TestSubmitIsNotAnError(t *testing.T){
	h := New(store.NewMemory() , anchor.NewMock()).Handler()
	body := fmt.Sprintf(`{"hash" : %q}` , strings.Repeat("cd" , 32))


	if rec := do(t , h , "POST" , "/submit" , body) ; rec.Code != http.StatusAccepted{
		t.Fatalf("first submit : got %d , want 202" , rec.Code)
	}
	if rec := do(t , h , "POST" , "/submit" , body) ; rec.Code != http.StatusOK{
		t.Fatalf("second submit : got %d , want 200 " , rec.Code)
	}
}

func TestProofUnknownAndBadHash(t *testing.T){
	h := New(store.NewMemory() , anchor.NewMock()).Handler()

	if rec := do(t , h , "GET" , "/proof/"+strings.Repeat("ab" , 32) , "");rec.Code != http.StatusNotFound{
		t.Fatalf("unknown hash got %d want 404" , rec.Code)
	}
	if rec := do(t , h , "GET" , "/proof/nothex" , "");rec.Code != http.StatusBadRequest {
		t.Fatalf("bad hash got %d want 400" , rec.Code)
	}
}

func TestVerifyDetectsProblem(t *testing.T){
	tests := []struct{
		name string
		mutate func(c *proof.Certificate , chain *anchor.Mock)
	}{
		{
			"different file" , func(c *proof.Certificate, chain *anchor.Mock) {
				other := sha256.Sum256([]byte("other file"))
				c.FileHash = hex.EncodeToString(other[:])
			},
		},
		{
			"root swapped" , func(c *proof.Certificate, chain *anchor.Mock) {
				c.Root = strings.Repeat("00" , 32)
			},
		},
		{
			"unknown Transaction" , func(c *proof.Certificate, chain *anchor.Mock) {
				c.Anchor.TxHash = "0xnope"
			},
		},
		{
			"Transaction holds a different root" , func(c *proof.Certificate, chain *anchor.Mock) {
				rcpt , _ := chain.Anchor(context.Background() , [32]byte{7})
				c.Anchor.TxHash = rcpt.TxHash
			},
		},
	}
	for _,tc := range tests{
		t.Run(tc.name , func(t *testing.T) {
			h , chain ,cert := confirmedCert(t)
			tc.mutate(cert , chain)
			raw , err := cert.Marshal()
			if err != nil{
				t.Fatal(err)
			}
			rec := do(t , h , "POST" , "/verify" , string(raw))
			if rec.Code != http.StatusOK{
				t.Fatalf("Got %d want 200" , rec.Code)
			}
			var vr verifyResponse
			if err := json.Unmarshal(rec.Body.Bytes() , &vr);err !=nil{
				t.Fatal(err)
			}
			if vr.Valid || vr.Reason == ""{
				t.Fatalf("tampered certificate must be invalid w a reason ; %+v" , vr)
			}
		})
	}
}