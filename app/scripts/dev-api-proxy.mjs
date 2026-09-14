// Proxy de développement pour la version web locale de l'app.
// L'API de production refuse l'origine http://localhost:8081 (CORS) : ce proxy relaie les appels
// sans l'en-tête Origin, comme le fait l'app native, et ajoute les en-têtes CORS attendus par le navigateur.
// Websockets (chat) compris.
//
// Utilisation : node scripts/dev-api-proxy.mjs
// puis lancer Expo avec EXPO_PUBLIC_WEB_API_URL=http://localhost:8787
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';

const TARGET = new URL(process.env.API_TARGET ?? 'https://trainwise-backend-rnd4.onrender.com');
const PORT = Number(process.env.PROXY_PORT ?? 8787);

const corsHeaders = (req) => ({
  'Access-Control-Allow-Origin': req.headers.origin ?? '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] ?? 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  Vary: 'Origin',
});

const upstreamHeaders = (req) => {
  const headers = { ...req.headers, host: TARGET.host };
  delete headers.origin;
  delete headers.referer;
  return headers;
};

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  const upstream = https.request(new URL(req.url ?? '/', TARGET), { method: req.method, headers: upstreamHeaders(req) }, (response) => {
    const headers = Object.fromEntries(Object.entries(response.headers).filter(([key]) => !key.startsWith('access-control-')));
    res.writeHead(response.statusCode ?? 502, { ...headers, ...corsHeaders(req) });
    response.pipe(res);
  });

  upstream.on('error', (error) => {
    res.writeHead(502, { 'Content-Type': 'application/json', ...corsHeaders(req) });
    res.end(JSON.stringify({ error: `Proxy de développement : ${error.message}` }));
  });

  req.pipe(upstream);
});

// Websocket (socket.io) : tunnel TLS brut vers l'API.
server.on('upgrade', (req, socket, head) => {
  const target = tls.connect(443, TARGET.hostname, { servername: TARGET.hostname }, () => {
    const lines = Object.entries(upstreamHeaders(req)).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
    target.write(`${req.method} ${req.url} HTTP/1.1\r\n${lines.join('\r\n')}\r\n\r\n`);
    if (head.length) target.write(head);
    socket.pipe(target).pipe(socket);
  });
  target.on('error', () => socket.destroy());
  socket.on('error', () => target.destroy());
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Proxy API prêt : http://localhost:${PORT} → ${TARGET.origin}`);
});
