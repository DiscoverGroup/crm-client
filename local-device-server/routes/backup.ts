import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth';

const router = Router();

const FILES_DIR = process.env.FILES_DIR || path.join(process.env.HOME || '~', 'CRM-Files');
const BACKUP_DIR = path.join(FILES_DIR, 'backups');

function ensureBackupDir(): void {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// POST /backup — save a JSON backup body to disk (auth required)
router.post('/', requireAuth, (req: Request, res: Response) => {
  ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}-backup.json`;
  const filePath = path.join(BACKUP_DIR, filename);

  try {
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf-8');
    res.json({ success: true, filename, path: filePath });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /backup — list all backup files (auth required)
router.get('/', requireAuth, (_req: Request, res: Response) => {
  ensureBackupDir();
  let files: { filename: string; sizeBytes: number; createdAt: string }[] = [];
  try {
    files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, sizeBytes: stat.size, createdAt: stat.birthtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {}
  res.json({ success: true, files });
});

// GET /backup/:filename — download a specific backup file (auth required)
router.get('/:filename', requireAuth, (req: Request, res: Response) => {
  // Only allow plain filenames — no slashes or dots in path segments except the .json extension
  const { filename } = req.params;
  if (!/^[\w\-]+-backup\.json$/.test(filename)) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }
  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Backup not found' });
    return;
  }
  res.sendFile(filePath);
});

export default router;
