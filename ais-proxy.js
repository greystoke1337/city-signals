/**
 * City Signals — AIS Proxy Server
 * 
 * Connects to aisstream.io on the backend (bypassing CORS restrictions),
 * then relays vessel data to your browser via a local WebSocket.
 * 
 * Usage:
 *   npm install ws
 *   node ais-proxy.js
 * 
 * Then open index.html in your browser.
 */

const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

const AIS_KEY   = process.env.AIS_KEY || 'ed6a70f43dbb2d5f0597ddde25dbff68aa2be2fd';
const AIS_URL   = 'wss://stream.aisstream.io/v0/stream';
const PORT      = process.env.PORT || 8765;

// Sydney Harbour + Port Botany bounding box
const BOUNDING_BOXES = [[[-34.05, 151.05], [-33.75, 151.35]]];

// ── HTTP server (Railway requires a real HTTP server on PORT) ──
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('City Signals AIS Proxy — OK');
});

// ── WebSocket server mounted on the HTTP server ────────────────
const wss = new WebSocketServer({ server });

server.listen(PORT, () => {
  console.log(`[City Signals] AIS proxy listening on port ${PORT}`);
  connectAIS();
});

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[proxy] Browser connected (${clients.size} client/s)`);
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[proxy] Browser disconnected (${clients.size} client/s)`);
  });
});

function broadcast(data) {
  const msg = typeof data === 'string' ? data : JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

// ── AISstream connection ───────────────────────────────────────
function connectAIS() {
  console.log('[ais] Connecting to aisstream.io…');
  const socket = new WebSocket(AIS_URL);

  socket.on('open', () => {
    console.log('[ais] Connected — subscribing to Sydney bounding box');
    socket.send(JSON.stringify({
      APIKey: AIS_KEY,
      BoundingBoxes: BOUNDING_BOXES,
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    }));
  });

  socket.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      // Forward only the fields the dashboard needs — keeps it lean
      const meta = msg.Metadata || {};
      const out = { MessageType: msg.MessageType, Metadata: meta, Message: msg.Message };
      broadcast(out);
    } catch (e) {
      console.error('[ais] Failed to parse message:', e.message);
    }
  });

  socket.on('error', (err) => {
    console.error('[ais] Error:', err.message);
  });

  socket.on('close', (code, reason) => {
    console.log(`[ais] Disconnected (${code}) — reconnecting in 5s…`);
    setTimeout(connectAIS, 5000);
  });
}
