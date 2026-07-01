#!/usr/bin/env node
import { createServer } from 'node:http';
import { getDb } from '../ingest/db.mjs';
import { routeRequest } from './handlers.mjs';

const PORT = process.env.API_PORT || 3001;
const db = getDb();

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const result = routeRequest(db, req.url);
    if (result.binary) {
      res.writeHead(result.status, {
        'Content-Type': result.mime,
        'Access-Control-Allow-Origin': '*',
        ...result.headers,
      });
      res.end(result.body);
      return;
    }
    const { status, body } = result;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`API server http://localhost:${PORT}`);
});