// server/src/routes/events.js
import { Router } from 'express';
import { authGuard } from '../authGuard.js';
import { bus } from '../lib/events.js';

const router = Router();

/**
 * SSE stream for admins.
 * Clients connect with EventSource('/events/admin').
 */
router.get('/admin', authGuard, (req, res) => {
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
