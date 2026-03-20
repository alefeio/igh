const http = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const { addClient, removeClient, broadcastSupportBadge } = require("./src/lib/support-ws.js");

const BROADCAST_PATH = "/__broadcast_support";
const BROADCAST_SECRET = process.env.SUPPORT_WS_BROADCAST_SECRET || "support-ws-broadcast-dev";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const nextUpgradeHandler = typeof app.getUpgradeHandler === "function" ? app.getUpgradeHandler() : null;

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "", true);
      const { pathname } = parsedUrl;
      if (pathname === BROADCAST_PATH && req.method === "POST") {
        const secret = req.headers["x-broadcast-secret"];
        if (secret === BROADCAST_SECRET) {
          let audience = "all";
          const chunks = [];
          req.on("data", (chunk) => chunks.push(chunk));
          req.on("end", () => {
            let forUserId;
            try {
              const body = Buffer.concat(chunks).toString("utf8");
              if (body) {
                const parsed = JSON.parse(body);
                if (parsed.audience === "student" || parsed.audience === "admin") audience = parsed.audience;
                if (typeof parsed.forUserId === "string" && parsed.forUserId.length > 0) {
                  forUserId = parsed.forUserId;
                }
              }
            } catch (_) {}
            broadcastSupportBadge(audience, forUserId);
            res.writeHead(204);
            res.end();
          });
          return;
        }
      }
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request", err);
      res.statusCode = 500;
      res.end("Internal server error");
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  const WS_PATH = "/ws/support";

  wss.on("connection", (ws) => {
    addClient(ws);
    ws.on("close", () => removeClient(ws));
  });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "", true);
    if (pathname === WS_PATH) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
      return;
    }
    if (nextUpgradeHandler) {
      nextUpgradeHandler(req, socket, head);
      return;
    }
    socket.destroy();
  });

  server
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> WebSocket support badge on ws://${hostname}:${port}${WS_PATH}`);
    });
});
