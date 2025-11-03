// server/src/routes/events.js
import { Router } from 'express';
import { authGuard } from '../authGuard.js';
import { bus } from '../lib/events.js';

import jwt from 'jsonwebtoken';

const router = Router();

function sseAuth(req, res, next) {
        const hdr = req.get('authorization');
        if (hdr?.startsWith('Bearer ')) {
                return authGuard(req, res, next);
        }
        const qToken = req.query?.token;
        if (qToken) {
                try {
                        const payload = jwt.verify(qToken, process.env.JWT_SECRET);
                        req.user = payload;
                        return next();
                } catch (e) {
                        // fall-through
                }
        }
        return res.status(401).json({ error: 'Unauthorized (SSE)' });
}

/**
 * SSE stream for admins.
 * Clients connect with EventSource('/events/admin').
 */
router.get('/admin', sseAuth, (req, res) => {
        // only admins should consume this; add a light check:
        if (req.user?.role !== 'ADMIN') return res.status(403).end();

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');

        // Immediate ping so the connection is considered "open"
        res.write(`event: ping\ndata: ${Date.now()}\n\n`);

        const onMsg = (data) => {
                res.write(`data: ${data}\n\n`);
        };

        bus.on('admin', onMsg);

        req.on('close', () => {
                bus.off('admin', onMsg);
        });
});

export default router;
