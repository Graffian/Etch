package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func okHandler(called *bool) http.Handler{
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*called = true
		w.WriteHeader(http.StatusOK)
	})
}


func TestCORSAllowsConfiguredOrigin(t *testing.T){
	var called bool
	h := CORS("http://localhost:3000" , okHandler(&called))

	req := httptest.NewRequest("GET" , "/x" , nil)
	req.Header.Set("Origin" , "http://localhost:3000")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec , req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000"{
		t.Fatalf("Allow-Origin = %q" , got)
	}
	if !called{
		t.Fatal("Request must reach the wrapped handler")
	}
}


func TestCORSIgnoresOtherOrigins(t *testing.T){
	var called bool
	h := CORS("http://localhost:3000" , okHandler(&called))

	req := httptest.NewRequest("GET" , "/x" , nil)
	req.Header.Set("Origin" , "https://evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec , req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != ""{
		t.Fatalf("Other origin must get no CORS header , got %q" , got)
	}
}


func TestCORSPreflight(t *testing.T){
	var called bool
	h := CORS("http://localhost:3000" , okHandler(&called))

	req := httptest.NewRequest("OPTIONS" , "/submit" , nil)
	req.Header.Set("Origin" , "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method" , "POST")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec , req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight got %d , want 204" , rec.Code)
	}
	if called{
		t.Fatal("preflight must not reach the wrapped handler")
	}
}