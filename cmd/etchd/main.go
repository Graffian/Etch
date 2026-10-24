package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Graffian/etch/internal/anchor"
	"github.com/Graffian/etch/internal/api"
	"github.com/Graffian/etch/internal/batcher"
	"github.com/Graffian/etch/internal/config"
	"github.com/Graffian/etch/internal/store"
)

func main() {
	if err := run(); err != nil {
		slog.Error("Etchd stopped" , "err" , err)
		os.Exit(1)
	}
}


func run() error{
	cfg , err := config.Load()
	if err !=nil{
		return err
	}

	st := store.NewMemory()
	chain := anchor.NewMock()

	ctx,stop := signal.NotifyContext(context.Background() , os.Interrupt , syscall.SIGTERM)
	defer stop()

	b := batcher.New(st , chain , cfg.BatchInterval)
	batcherDone := make(chan struct{})
	go func ()  {
		defer close(batcherDone)
		b.Run(ctx)
	}()

	srv := &http.Server{
		Addr: cfg.Addr,
		Handler: api.Logging(api.CORS(cfg.AllowedOrigin , api.New(st , chain).Handler())),
		ReadHeaderTimeout: 5*time.Second,
	}

	serverErr := make(chan error , 1)
	go func ()  {
		slog.Info("Etchd listening" , "addr" , cfg.Addr , "batch_interval" , cfg.BatchInterval)
		serverErr <- srv.ListenAndServe()
	}()

	select{
		case err := <- serverErr:
			return err
		case <- ctx.Done():
			slog.Info("Shutting Down")
	}

	shutdownCtx , cancel := context.WithTimeout(context.Background() , 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err !=nil{
		return err
	}
	<-batcherDone
	return  nil
}