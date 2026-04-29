import dotenv from 'dotenv';
import path from 'path';
// Load .env relative to this file's directory (works regardless of cwd)
dotenv.config({ path: path.join(__dirname ?? new URL('.', import.meta.url).pathname, '.env') });
import express from 'express';
import cors from 'cors';

import uploadRouter from './routes/upload';
import filesRouter from './routes/files';
import foldersRouter from './routes/folders';
import backupRouter from './routes/backup';

const PORT = parseInt(process.env.PORT || '4040', 10);
const FILES_DIR = process.env.FILES_DIR || path.join(process.env.HOME || '~', 'CRM-Files');

// Parse ALLOWED_ORIGINS as comma-separated list
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, same-machine) and configured origins
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'ngrok-skip-browser-warning'],
}));

app.use(express.json({ limit: '10mb' }));

// ── Health check (no auth — used by Admin Panel "Test Connection" button) ──────
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    serverTime: new Date().toISOString(),
    version: '1.0.0',
    filesDir: FILES_DIR,
  });
});

// ── Routes ──────────────────────────────────────────────────────────────────────
app.use('/upload', uploadRouter);
app.use('/files', filesRouter);
app.use('/folders', foldersRouter);
app.use('/backup', backupRouter);

// ── 404 fallback ────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[CRM Local Server] Listening on http://0.0.0.0:${PORT}`);
  console.log(`[CRM Local Server] Files directory: ${FILES_DIR}`);
  if (allowedOrigins.length > 0) {
    console.log(`[CRM Local Server] Allowed origins: ${allowedOrigins.join(', ')}`);
  } else {
    console.log(`[CRM Local Server] ⚠️  ALLOWED_ORIGINS not set — all origins permitted`);
  }
});
