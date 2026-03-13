/**
 * City Signals — Proxy Server
 *
 * Connects to aisstream.io on the backend (bypassing CORS restrictions),
 * then relays vessel data to your browser via a local WebSocket.
 * Also proxies TfNSW API requests (traffic hazards + car park occupancy).
 *
 * Usage:
 *   npm install ws
 *   node ais-proxy.js
 *
 * Then open index.html in your browser.
 */

const http = require('http');
const https = require('https');
const { WebSocketServer, WebSocket } = require('ws');

const AIS_KEY   = process.env.AIS_KEY || 'e52201e85895a1b69f671f22a80a7d62088ccb2a';
const TFNSW_KEY = process.env.TFNSW_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJTUFpaNnFiODNCanVWZUlDSTk2NzhYaGw5R2I4bzZySDltQ25CQTRZUXJNIiwiaWF0IjoxNzczMzc2ODM3fQ.pCtRqCe3vZNhfcnDJ3ANTma6OqWg1tfcKUe73O9ZfW0';
const AIS_URL   = 'wss://stream.aisstream.io/v0/stream';
const PORT      = process.env.PORT || 8765;

// Sydney Harbour + Port Botany bounding box
const BOUNDING_BOXES = [[[-34.05, 151.05], [-33.75, 151.35]]];

// ── TfNSW proxy helper ────────────────────────────────────────
function proxyTfNSW(apiPath, res) {
  const opts = {
    hostname: 'api.transport.nsw.gov.au',
    path: apiPath,
    headers: { 'Authorization': 'apikey ' + TFNSW_KEY, 'Accept': 'application/json' },
  };
  https.get(opts, (upstream) => {
    const chunks = [];
    upstream.on('data', c => chunks.push(c));
    upstream.on('end', () => {
      res.writeHead(upstream.statusCode, {
        'Content-Type': upstream.headers['content-type'] || 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(Buffer.concat(chunks));
    });
  }).on('error', (err) => {
    console.error('[tfnsw] Proxy error:', err.message);
    res.writeHead(502, { 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: err.message }));
  });
}

// ── HTTP server (Railway requires a real HTTP server on PORT) ──
const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    return res.end();
  }

  if (req.url === '/api/traffic') {
    // Fetch open incidents, roadworks, and major events in parallel and merge
    const categories = ['incident', 'roadwork', 'majorevent'];
    const fetches = categories.map(cat => new Promise((resolve) => {
      const opts = {
        hostname: 'api.transport.nsw.gov.au',
        path: `/v1/live/hazards/${cat}/open`,
        headers: { 'Authorization': 'apikey ' + TFNSW_KEY, 'Accept': 'application/json' },
      };
      https.get(opts, (upstream) => {
        const chunks = [];
        upstream.on('data', c => chunks.push(c));
        upstream.on('end', () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
          catch(e) { resolve({ type: 'FeatureCollection', features: [] }); }
        });
      }).on('error', () => resolve({ type: 'FeatureCollection', features: [] }));
    }));
    return Promise.all(fetches).then(results => {
      const merged = {
        type: 'FeatureCollection',
        features: results.flatMap(r => r.features || []),
      };
      console.log(`[tfnsw] Traffic: ${merged.features.length} open hazards`);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(merged));
    });
  }
  if (req.url === '/api/carpark') {
    return proxyTfNSW('/v1/carpark', res);
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('City Signals Proxy — OK');
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
