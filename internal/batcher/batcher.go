package batcher

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/Graffian/etch/internal/anchor"
	"github.com/Graffian/etch/internal/store"
	"github.com/Graffian/etch/pkg/merkle"
)

type Batcher struct {
	store store.Store
	anchorer anchor.Anchorer
	interval time.Duration
}

func New(s store.Store , a anchor.Anchorer , interval time.Duration) *Batcher{
	return &Batcher{
		store: s,
		anchorer: a,
		interval: interval,
	}
}

func (b *Batcher) RunOnce(ctx context.Context) (int64,error){
	pending , err := b.store.Pending(ctx)
	if err!=nil{
		return 0 , fmt.Errorf("Batcher load pending : %w" , err)
	}
	if len(pending) == 0{
		return 0,nil
	}

	leaves := make([][]byte , len(pending))
	for i := range pending{
		leaves[i] = pending[i][:]
	}

	tree,err := merkle.Build(leaves)
	if err != nil{
		return 0 , fmt.Errorf("batcher : build tree : %w" , err)
	}
	root := tree.Root()

	steps := make([][]merkle.Step , len(pending))
	for i := range pending{
		steps[i] , err = tree.Proof(i)
		if err!=nil{
			return 0 , fmt.Errorf("Proof for leaf %d : %w" , i , err)
		}
	}

	reciept , err := b.anchorer.Anchor(ctx , root)
	if err!=nil{
		return 0 , fmt.Errorf("batcher : anchor root : %w" , err)
	}

	id , err := b.store.SaveBatch(ctx , store.Batch{
		Root: root,
		Reciept: reciept,
		Leaves: pending,
		Steps: steps,
	})
	if err!= nil{
		return 0 , fmt.Errorf("Batcher : save batch : %w" , err)
	}
	return id , nil
}

func (b *Batcher) Run(ctx context.Context){
	ticker := time.NewTicker(b.interval)
	defer ticker.Stop()

	for {
		select{
			case <- ctx.Done():
				return
			case <- ticker.C:
				id ,err := b.RunOnce(ctx)
				if err!=nil{
					slog.Error("Batch failed" , "err" , err)
					continue
				}
				if id !=0{
					slog.Info("batch anchored" , "batch_id" , id)
				}
		}
	}
}