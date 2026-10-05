package noxmcp

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"errors"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/jsonschema-go/jsonschema"
	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func echoRuntime(t *testing.T, execute func(ExecutionContext, map[string]any) (map[string]any, error)) *Runtime {
	t.Helper()
	schema := &jsonschema.Schema{Type: "object", Required: []string{"message"}, Properties: map[string]*jsonschema.Schema{"message": {Type: "string"}}}
	r, err := New(Options{AppID: "test", Name: "test", Version: "1", Tools: []Tool{{Name: "echo", Description: "echo", InputSchema: schema, OutputSchema: schema, RequiredScopes: []string{"read"}, ReadOnly: true, Execute: execute}}})
	if err != nil {
		t.Fatal(err)
	}
	return r
}
func TestSharedConformance(t *testing.T) {
	data, _ := Contracts.ReadFile("contracts/cases.json")
	var cases []struct {
		Name, Schema string
		Valid        bool
		Value        json.RawMessage
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		t.Run(c.Name, func(t *testing.T) {
			if (ValidateFrame(c.Schema, c.Value) == nil) != c.Valid {
				t.Fatalf("unexpected validation: %v", ValidateFrame(c.Schema, c.Value))
			}
		})
	}
}
func TestExecutionValidationAndCancellation(t *testing.T) {
	calls := 0
	r := echoRuntime(t, func(ctx ExecutionContext, input map[string]any) (map[string]any, error) {
		calls++
		return input, ctx.Err()
	})
	identity := &auth.TokenInfo{UserID: "u", Scopes: []string{"read"}}
	if _, err := r.Execute(context.Background(), "echo", map[string]any{"message": 3}, identity); err == nil {
		t.Fatal("accepted invalid input")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := r.Execute(ctx, "echo", map[string]any{"message": "hello"}, identity); err == nil {
		t.Fatal("accepted cancelled work")
	}
	if calls != 0 {
		t.Fatal("invalid work executed")
	}
	if _, err := r.Execute(context.Background(), "echo", map[string]any{"message": "hello"}, nil); err == nil {
		t.Fatal("missing scope accepted")
	}
}
func TestWriteTimeoutDoesNotSuggestRetry(t *testing.T) {
	release := make(chan struct{})
	r := echoRuntime(t, func(ctx ExecutionContext, input map[string]any) (map[string]any, error) {
		<-release
		return input, ctx.Err()
	})
	r.options.Timeout = 5 * time.Millisecond
	tool := r.tools["echo"]
	tool.definition.ReadOnly = false
	r.tools["echo"] = tool
	_, err := r.Execute(context.Background(), "echo", map[string]any{"message": "hello"}, &auth.TokenInfo{Scopes: []string{"read"}})
	close(release)
	var public *Error
	if !errors.As(err, &public) || public.Retryable || public.Code != "TIMEOUT" {
		t.Fatalf("unsafe timeout: %v", err)
	}
}
func TestNativeClientFullCall(t *testing.T) {
	r := echoRuntime(t, func(ctx ExecutionContext, input map[string]any) (map[string]any, error) {
		if input["message"] == "oversized-error" {
			return nil, &Error{Code: "DOMAIN", Message: "Failure", Details: map[string]any{"private": strings.Repeat("x", MaxPayloadBytes)}}
		}
		return input, nil
	})
	tool := r.tools["echo"]
	tool.definition.RequiredScopes = nil
	r.tools["echo"] = tool
	server := httptest.NewServer(r.HTTPHandler())
	defer server.Close()
	client := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil)
	ctx, stop := context.WithTimeout(context.Background(), 5*time.Second)
	defer stop()
	session, err := client.Connect(ctx, &mcp.StreamableClientTransport{Endpoint: server.URL}, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()
	tools, err := session.ListTools(ctx, nil)
	if err != nil || len(tools.Tools) != 1 {
		t.Fatalf("discovery: %v", err)
	}
	out, err := session.CallTool(ctx, &mcp.CallToolParams{Name: "echo", Arguments: map[string]any{"message": "hello"}})
	if err != nil || out.IsError || out.StructuredContent == nil {
		t.Fatalf("call: %v %#v", err, out)
	}
	out, err = session.CallTool(ctx, &mcp.CallToolParams{Name: "echo", Arguments: map[string]any{"message": "oversized-error"}})
	if err != nil || !out.IsError {
		t.Fatalf("oversized error not rejected: %v", err)
	}
	data, _ := json.Marshal(out)
	if strings.Contains(string(data), "private") {
		t.Fatal("oversized error details escaped")
	}
}
func TestRealJWTRevocationExpiryAudienceAndScope(t *testing.T) {
	public, key, _ := ed25519.GenerateKey(rand.Reader)
	verify, err := JWTVerifier("https://issuer.example", "https://app.example/mcp", func(*jwt.Token) (any, error) { return public, nil })
	if err != nil {
		t.Fatal(err)
	}
	active := true
	gate, _ := Protect(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(strings.Join(auth.TokenInfoFromContext(r.Context()).Scopes, " "), "read") {
			w.WriteHeader(403)
			return
		}
		w.WriteHeader(204)
	}), verify, func(context.Context, *auth.TokenInfo) bool { return active }, "https://app.example/metadata")
	sign := func(aud, scope string, expiration time.Time) string {
		token := jwt.NewWithClaims(jwt.SigningMethodEdDSA, jwt.MapClaims{"iss": "https://issuer.example", "aud": aud, "sub": "u", "scope": scope, "exp": expiration.Unix(), "iat": time.Now().Unix()})
		raw, err := token.SignedString(key)
		if err != nil {
			t.Fatal(err)
		}
		return raw
	}
	request := func(raw string) int {
		req := httptest.NewRequest("POST", "http://app.example/mcp", nil)
		req.Header.Set("Authorization", "Bearer "+raw)
		rec := httptest.NewRecorder()
		gate.ServeHTTP(rec, req)
		return rec.Code
	}
	token := sign("https://app.example/mcp", "read", time.Now().Add(time.Minute))
	if request(token) != 204 {
		t.Fatal("valid JWT rejected")
	}
	active = false
	if request(token) != 401 {
		t.Fatal("revoked JWT accepted")
	}
	active = true
	if request(sign("wrong", "read", time.Now().Add(time.Minute))) != 401 || request(sign("https://app.example/mcp", "read", time.Now().Add(-time.Minute))) != 401 || request(sign("https://app.example/mcp", "write", time.Now().Add(time.Minute))) != 403 {
		t.Fatal("invalid authorization accepted")
	}
}
