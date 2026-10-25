package config

import (
	"fmt"
	"os"
	"time"
)

type Config struct {
	Addr          string
	AllowedOrigin string
	BatchInterval time.Duration
	AnchorMode    string // "evm" (client-sign, real chain) or "mock"
	RPCURL        string
	Chain         string
}

func Load() (Config, error) {
	c := Config{
		Addr:          env("ETCH_ADDR", ":8080"),
		AllowedOrigin: env("ETCH_ALLOWED_ORIGIN", "http://localhost:3000"),
		AnchorMode:    env("ETCH_ANCHOR_MODE", "evm"),
		RPCURL:        env("ETCH_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com"),
		Chain:         env("ETCH_CHAIN", "sepolia"),
	}
	interval, err := time.ParseDuration(env("ETCH_BATCH_INTERVAL", "10s"))
	if err != nil {
		return Config{}, fmt.Errorf("config : ETCH_BATCH_INTERVAL : %w", err)
	}
	if interval <= 0 {
		return Config{}, fmt.Errorf("ETCH_BATCH_INTERVAL must be positive got %s", interval)
	}
	c.BatchInterval = interval
	if c.AnchorMode != "evm" && c.AnchorMode != "mock" {
		return Config{}, fmt.Errorf("ETCH_ANCHOR_MODE must be 'evm' or 'mock', got %q", c.AnchorMode)
	}
	return c, nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
