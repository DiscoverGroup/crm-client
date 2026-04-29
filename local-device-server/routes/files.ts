import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth';

const router = Router();

const FILES_DIR = process.env.FILES_DIR || path.join(process.env.HOME || '~', 'CRM-Files');

function resolveSafePath(folder: string, filename: string): string | null {
  if (/[^a-zA-Z0-9_\-]/.test(folder)) return null;
  if (/[^a-zA-Z0-9._\-]/.test(filename)) return null;
  const resolved = path.resolve(FILES_DIR, folder, filename);
  // Ensure path stays within FILES_DIR
  if (!resolved.startsWith(path.resolve(FILES_DIR))) return null;
  return resolved;
}

// GET /files/:folder/:filename — serve a file (no auth required so employee browsers can display inline)
router.get('/:folder/:filename', (req: Request, res: Response) => {
  const filePath = resolveSafePath(req.params.folder, req.params.filename);
  if (!filePath) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.sendFile(filePath);
});

// DELETE /files/:folder/:filename — delete a file (auth required)
router.delete('/:folder/:filename', requireAuth, (req: Request, res: Response) => {
  const filePath = resolveSafePath(req.params.folder, req.params.filename);
  if (!filePath) {
    res.status(400).json({ success: false, error: 'Invalid path' });
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, error: 'File not found' });
    return;
  }
  fs.unlinkSync(filePath);
  res.json({ success: true });
});

export default router;
