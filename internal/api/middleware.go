package api

import (
	"log/slog"
	"net/http"
	"time"
)

func CORS(allowedOrigin string, next http.Handler) http.Handler{
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowedOrigin == "*" || (origin != "" && origin == allowedOrigin){
			w.Header().Set("Access-Control-Allow-Origin" , allowedOrigin)
			w.Header().Set("Access-Control-Allow-Methods" , "GET,POST,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers" , "Content-Type")
		}
		w.Header().Add("Vary" , "Origin")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return 
		}
		next.ServeHTTP(w , r)
	})
}

func Logging(next http.Handler) http.Handler{
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w , status: http.StatusOK}
		next.ServeHTTP(rec , r)
		slog.Info("request" , 
			"method" , r.Method,
			"path" , r.URL.Path,
			"status" , rec.status,
			"took" , time.Since(start),
		)
	})
}

type statusRecorder struct{
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}