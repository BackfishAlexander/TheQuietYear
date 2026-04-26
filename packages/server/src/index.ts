import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { registerHandlers } from './socketHandlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  registerHandlers(io, socket);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve the built client - try multiple possible paths
const possibleClientPaths = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../../../packages/client/dist'),
  path.resolve(process.cwd(), 'packages/client/dist'),
];

const clientDist = possibleClientPaths.find(p => fs.existsSync(path.join(p, 'index.html')));

if (clientDist) {
  console.log(`Serving client from: ${clientDist}`);
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  console.log('No client build found, tried:', possibleClientPaths);
  app.get('*', (_req, res) => {
    res.status(200).send('Server is running. Client build not found — run npm run build first.');
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
