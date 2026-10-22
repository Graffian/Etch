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
}

func Load()(Config , error){
	c := Config{
		Addr: env("ETCH_ADDR" , ":8080"),
		AllowedOrigin: env("ETCH_ALLOWED_ORIGIN" , "http://localhost:3000"),
	}
	interval , err := time.ParseDuration(env("ETCH_BATCH_INTERVAL" , "10s"))
	if err != nil {
		return Config{} , fmt.Errorf("config : ETCH_BATCH_INTERVAL : %w" , err)
	}
	if interval<=0{
		return Config{} , fmt.Errorf("ETCH_BATCH_INTERVAL must be positive got %s" , interval)
	}
	c.BatchInterval = interval
	return c , nil
}

	

func env(key , fallback string) string{
	if v := os.Getenv(key) ; v != ""{
		return v		
	}
	return fallback
}