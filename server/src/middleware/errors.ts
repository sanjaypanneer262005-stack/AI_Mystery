import type { Request, Response, NextFunction } from 'express';
export function errors(err: any, _req: Request, res: Response, _next: NextFunction) { const status = err.status || 500; res.status(status).json({ error: { code: err.code || 'server_error', message: status === 500 ? 'Something went wrong. Please try again.' : err.message } }); }
