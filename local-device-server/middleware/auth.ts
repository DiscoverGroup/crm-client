import { Request, Response, NextFunction } from 'express';

const SERVER_TOKEN = process.env.SERVER_TOKEN || '';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing Authorization header' });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!SERVER_TOKEN || token !== SERVER_TOKEN) {
    res.status(401).json({ success: false, error: 'Invalid token' });
    return;
  }

  next();
}
