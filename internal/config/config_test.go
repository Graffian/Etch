package config

import (
	"testing"
	"time"
)

func TestLoadDefaults(t *testing.T){
	t.Setenv("ETCH_ADDR" , "")
	t.Setenv("ETCH_ALLOWED_ORIGIN" , "")
	t.Setenv("ETCH_BATCH_INTERVAL" , "")

	c,err := Load()
	if err !=nil{
		t.Fatal(err)
	}
	if c.Addr != ":8080" || c.AllowedOrigin != "http://localhost:3000" || c.BatchInterval != 10*time.Second{
		t.Fatalf("Unexpected defaults : %+v" , c)
	}
}

func TestLoadFromEnv(t *testing.T){
	t.Setenv("ETCH_ADDR" , ":9999")
	t.Setenv("ETCH_BATCH_INTERVAL" , "5m")

	c,err := Load()
	if err !=nil{
		t.Fatal(err)
	}
	if c.Addr != ":9999" || c.BatchInterval != 5*time.Minute {
		t.Fatalf("Env not applied : %+v" , c)
	}
}

func TestLoadRejectsBadInterval(t *testing.T){
	for _,bad := range []string{"soon" , "0s" , "-5s"} {
		t.Setenv("ETCH_BATCH_INTERVAL" , bad)
		if _,err := Load();err == nil{
			t.Fatalf("interval %q must be rejected" , bad)
		}
	}
}