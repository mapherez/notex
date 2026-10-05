package main

import (
	"context"
	"github.com/google/jsonschema-go/jsonschema"
	noxmcp "github.com/mapherez/mcp/go"
	"log"
	"net/http"
	"os"
)

func main() {
	limit := 200
	schema := &jsonschema.Schema{Type: "object", Required: []string{"message"}, Properties: map[string]*jsonschema.Schema{"message": {Type: "string", MaxLength: &limit}}}
	runtime, err := noxmcp.New(noxmcp.Options{AppID: "echo", Name: "NoX Echo", Version: "0.1.0", Tools: []noxmcp.Tool{{Name: "echo", Description: "Echo a message", InputSchema: schema, OutputSchema: schema, ReadOnly: true, Execute: func(ctx noxmcp.ExecutionContext, input map[string]any) (map[string]any, error) {
		return input, ctx.CheckActive()
	}}}})
	if err != nil {
		log.Fatal(err)
	}
	if len(os.Args) > 1 && os.Args[1] == "http" {
		log.Fatal(http.ListenAndServe("127.0.0.1:8089", runtime.HTTPHandler()))
	}
	if err = runtime.ServeStdio(context.Background()); err != nil {
		log.Fatal(err)
	}
}
