import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth';

const router = Router();

const FILES_DIR = process.env.FILES_DIR || path.join(process.env.HOME || '~', 'CRM-Files');

// GET /folders — list all folders and their file counts (auth required)
router.get('/', requireAuth, (_req: Request, res: Response) => {
  if (!fs.existsSync(FILES_DIR)) {
    res.json({ success: true, folders: [] });
    return;
  }

  const entries = fs.readdirSync(FILES_DIR, { withFileTypes: true });
  const folders = entries
    .filter(e => e.isDirectory() && e.name !== 'backups')
    .map(e => {
      const folderPath = path.join(FILES_DIR, e.name);
      let fileCount = 0;
      try {
        fileCount = fs.readdirSync(folderPath).length;
      } catch {}
      return { name: e.name, fileCount };
    });

  res.json({ success: true, folders });
});

export default router;
