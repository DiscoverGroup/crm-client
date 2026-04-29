import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth';

const router = Router();

const FILES_DIR = process.env.FILES_DIR || path.join(process.env.HOME || '~', 'CRM-Files');

function getSafeFolderPath(folder: string): string | null {
  // Block path traversal
  if (!folder || /[^a-zA-Z0-9_\-]/.test(folder)) return null;
  return path.join(FILES_DIR, folder);
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const folder = req.params.folder;
    const folderPath = getSafeFolderPath(folder);
    if (!folderPath) {
      cb(new Error('Invalid folder name'), '');
      return;
    }
    fs.mkdirSync(folderPath, { recursive: true });
    cb(null, folderPath);
  },
  filename: (_req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._\-]/g, '_');
    cb(null, `${Date.now()}-${sanitized}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// POST /upload/:folder
router.post('/:folder', requireAuth, upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file provided' });
    return;
  }

  const folder = req.params.folder;
  const filename = req.file.filename;
  const url = `http://${req.hostname}:${process.env.PORT || 4040}/files/${folder}/${filename}`;

  res.json({
    success: true,
    filename,
    path: `${folder}/${filename}`,
    url,
    size: req.file.size,
    originalName: req.file.originalname,
  });
});

export default router;
