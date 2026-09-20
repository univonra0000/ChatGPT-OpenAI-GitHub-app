import { DurableObject } from "cloudflare:workers";

const MAX_TEXT = 2000;
const MAX_PACKET = 4096;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(
        "COLBAS Neuro Sync server OK\nWebSocket: wss://colbas.univonra.workers.dev/ws",
        { headers: { "content-type": "text/plain; charset=UTF-8" } }
      );
    }

    if (url.pathname !== "/ws") {
      return new Response("Not Found", { status: 404 });
    }

    if (
      request.method !== "GET" ||
      request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
    ) {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    // Optional origin restriction. Leave ALLOWED_ORIGIN unset while testing.
    const allowedOrigin = env.ALLOWED_ORIGIN;
    if (allowedOrigin) {
      const origin = request.headers.get("Origin");
      if (origin !== allowedOrigin) {
        return new Response("Forbidden origin", { status: 403 });
      }
    }

    const id = env.NEURO_SYNC_ROOM.idFromName("global");
    const stub = env.NEURO_SYNC_ROOM.get(id);
    return stub.fetch(request);
  }
};

export class NeuroSyncRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);

    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    );
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);

    server.serializeAttachment({
      id: crypto.randomUUID(),
      connectedAt: Date.now()
    });

    // Broadcast after this socket is accepted.
    await this.broadcastPresence();

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== "string") return;
    if (message.length > MAX_PACKET) return;

    let packet;
    try {
      packet = JSON.parse(message);
    } catch {
      this.safeSend(ws, {
        type: "error",
        message: "Invalid JSON"
      });
      return;
    }

    if (packet.type === "presence") {
      await this.broadcastPresence();
      return;
    }

    if (packet.type === "message") {
      const text = String(packet.text ?? "").trim().slice(0, MAX_TEXT);
      if (!text) return;

      this.broadcast(JSON.stringify({
        type: "message",
        sentAt: Date.now(),
        text
      }));
      return;
    }

    if (packet.type === "ping") {
      this.safeSend(ws, {
        type: "pong",
        time: Date.now()
      });
    }
  }

  async webSocketClose(ws, code, reason) {
    try {
      ws.close(code, reason);
    } catch {}
    await this.broadcastPresence();
  }

  async webSocketError(ws) {
    try {
      ws.close(1011, "WebSocket error");
    } catch {}
    await this.broadcastPresence();
  }

  broadcast(message) {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message);
      } catch {}
    }
  }

  safeSend(ws, object) {
    try {
      ws.send(JSON.stringify(object));
    } catch {}
  }

  async broadcastPresence() {
    this.broadcast(JSON.stringify({
      type: "presence",
      online: this.ctx.getWebSockets().length
    }));
  }
}
