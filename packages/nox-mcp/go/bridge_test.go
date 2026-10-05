package noxmcp

import (
	"context"
	"encoding/json"
	"github.com/coder/websocket"
	"github.com/modelcontextprotocol/go-sdk/auth"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestBridgeCancellationHasNoLateResponseOrReplay(t *testing.T) {
	started := make(chan struct{})
	cancelled := make(chan struct{})
	done := make(chan struct{})
	serverErr := make(chan error, 1)
	runtime := echoRuntime(t, func(ctx ExecutionContext, input map[string]any) (map[string]any, error) {
		close(started)
		<-ctx.Done()
		close(cancelled)
		return input, ctx.Err()
	})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer close(done)
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			serverErr <- err
			return
		}
		defer conn.CloseNow()
		ctx, stop := context.WithTimeout(r.Context(), 2*time.Second)
		defer stop()
		send := func(value any) {
			data, _ := json.Marshal(value)
			if err := conn.Write(ctx, websocket.MessageText, data); err != nil {
				serverErr <- err
			}
		}
		_, data, err := conn.Read(ctx)
		if err != nil {
			serverErr <- err
			return
		}
		var authFrame map[string]any
		json.Unmarshal(data, &authFrame)
		if authFrame["type"] != "authenticate" {
			t.Error("missing authentication")
		}
		send(map[string]any{"type": "authenticated"})
		_, data, err = conn.Read(ctx)
		if err != nil {
			serverErr <- err
			return
		}
		var ready map[string]any
		json.Unmarshal(data, &ready)
		if ready["protocolVersion"] != "2.0" {
			t.Error("missing v2 readiness")
		}
		request := map[string]any{"type": "request", "requestId": "b30d5e74-430d-497e-a456-1a12d9732b38", "command": "echo", "input": map[string]any{"message": "private-fixture"}, "deadlineAt": time.Now().Add(time.Second).Format(time.RFC3339Nano)}
		send(request)
		<-started
		send(map[string]any{"type": "cancel", "requestId": request["requestId"]})
		<-cancelled
		// A duplicate is never executed, even after cancellation.
		send(request)
		_, data, err = conn.Read(ctx)
		if err == nil {
			t.Errorf("late response received: %s", data)
		}
	}))
	defer server.Close()
	ctx, stop := context.WithTimeout(context.Background(), 3*time.Second)
	defer stop()
	err := RunBridge(ctx, BridgeOptions{URL: strings.Replace(server.URL, "http:", "ws:", 1), Ticket: strings.Repeat("a", 43), AppVersion: "test", Runtime: runtime, Identity: &auth.TokenInfo{Scopes: []string{"read"}}})
	if err == nil {
		t.Fatal("duplicate bridge request accepted")
	}
	<-done
	select {
	case err := <-serverErr:
		t.Fatal(err)
	default:
	}
}
