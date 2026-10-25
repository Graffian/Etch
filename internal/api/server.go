package api

import (
	"net/http"

	"github.com/Graffian/etch/internal/anchor"
	"github.com/Graffian/etch/internal/store"
)

type Server struct {
	store    store.Store
	anchorer anchor.Anchorer
}

func New(s store.Store, a anchor.Anchorer) *Server {
	return &Server{store: s, anchorer: a}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /submit", s.handleSubmit)
	mux.HandleFunc("GET /proof/{hash}", s.handleProof)
	mux.HandleFunc("POST /anchor", s.handleAnchor)
	mux.HandleFunc("POST /verify", s.handleVerify)
	return mux
}
