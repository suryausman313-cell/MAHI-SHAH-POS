const http = require('http');
const net = require('net');

const HOST = '127.0.0.1';
const PORT = 18181;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function json(res, status, body) {
  cors(res);
  res.writeHead(status, {'Content-Type':'application/json'});
  res.end(JSON.stringify(body));
}

function escposBuffer(lines, cut=true) {
  const init = Buffer.from([0x1b, 0x40]);
  const center = Buffer.from([0x1b, 0x61, 0x01]);
  const left = Buffer.from([0x1b, 0x61, 0x00]);
  const textParts = [];
  lines.forEach((line, idx) => {
    if (idx === 0) textParts.push(center);
    if (idx === 1) textParts.push(left);
    textParts.push(Buffer.from(String(line) + '\n', 'utf8'));
  });
  textParts.push(Buffer.from('\n\n\n', 'utf8'));
  if (cut) textParts.push(Buffer.from([0x1d, 0x56, 0x00]));
  return Buffer.concat([init, ...textParts]);
}

function sendRaw(ip, port, buffer) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({host: ip, port: Number(port), timeout: 5000}, () => {
      socket.write(buffer, () => socket.end());
    });
    socket.on('close', hadError => hadError ? reject(new Error('Printer connection closed with error')) : resolve());
    socket.on('timeout', () => { socket.destroy(); reject(new Error('Printer connection timeout')); });
    socket.on('error', reject);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, {ok:true, service:'MAHI POS Printer Bridge'});
  }


  if (req.method === 'POST' && req.url === '/drawer') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.ip) return json(res, 400, {error:'Printer IP is required'});
        const port = Number(data.port || 9100);
        const pulse = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);
        await sendRaw(data.ip, port, pulse);
        return json(res, 200, {ok:true, ip:data.ip, port});
      } catch (e) {
        return json(res, 500, {error:e.message || String(e)});
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.ip) return json(res, 400, {error:'Printer IP is required'});
        const port = Number(data.port || 9100);
        const lines = Array.isArray(data.lines) ? data.lines : [];
        const buffer = escposBuffer(lines, data.cut !== false);
        await sendRaw(data.ip, port, buffer);
        return json(res, 200, {ok:true, ip:data.ip, port});
      } catch (e) {
        return json(res, 500, {error: e.message || String(e)});
      }
    });
    return;
  }

  return json(res, 404, {error:'Not found'});
});

server.listen(PORT, HOST, () => {
  console.log(`MAHI POS Printer Bridge running on http://${HOST}:${PORT}`);
  console.log('Keep this window open while using POS.');
});
