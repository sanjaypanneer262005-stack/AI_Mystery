import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken'; import { env } from '../config/env.js';
declare global { namespace Express { interface Request { userId?: string } } }
export function auth(req: Request, res: Response, next: NextFunction) { const token = req.cookies?.session; if (!token) return res.status(401).json({ error: { code: 'unauthorized', message: 'Please sign in.' } }); try { req.userId = (jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload).sub; next(); } catch { res.status(401).json({ error: { code: 'unauthorized', message: 'Please sign in again.' } }); } }
