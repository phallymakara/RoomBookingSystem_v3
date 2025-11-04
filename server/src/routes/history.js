// server/src/routes/history.js
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /history
 * Query params:
 *   status: comma-separated list (e.g., "CONFIRMED,APPROVED,ACCEPTED,REJECTED,CANCELLED")
 *   page: 1-based page index (default 1)
 *   pageSize: number per page (default 20, max 100)
 *   q: search term (matches room name, building name, or user email/name)
 *   sort: field to sort by (createdAt | startTs | endTs | status) default createdAt
 *   order: asc | desc (default desc)
 */
router.get('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
        try {
                const {
                        status = '',
                        page = '1',
                        pageSize = '20',
                        q = '',
                        sort = 'createdAt',
                        order = 'desc',
                } = req.query;

                const pageNum = Math.max(parseInt(page, 10) || 1, 1);
                const size = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100);

                // Accept various status names; map “approved/accepted” to common DB statuses
                const rawStatuses = status
                        ? status.split(',').map(s => s.trim()).filter(Boolean)
                        : []; // if empty, return ALL

                // Build Prisma filters
                const where = {};

                if (rawStatuses.length) {
                        where.status = { in: rawStatuses };
                }

                if (q) {
                        // Search by room / building (via floor) / user
                        where.OR = [
                                { room: { name: { contains: q, mode: 'insensitive' } } },
                                { room: { floor: { building: { name: { contains: q, mode: 'insensitive' } } } } },
                                { user: { name: { contains: q, mode: 'insensitive' } } },
                                { user: { email: { contains: q, mode: 'insensitive' } } },
                        ];
                }

                // Validate sort/order
                const allowedSort = new Set(['createdAt', 'startTs', 'endTs', 'status']);
                const sortField = allowedSort.has(String(sort)) ? String(sort) : 'createdAt';
                const sortOrder = String(order).toLowerCase() === 'asc' ? 'asc' : 'desc';

                const [total, items] = await Promise.all([
                        prisma.booking.count({ where }),
                        prisma.booking.findMany({
                                where,
                                include: {
                                        room: { include: { floor: { include: { building: true } } } },
                                        user: { select: { id: true, name: true, email: true } },
                                },
                                orderBy: { [sortField]: sortOrder },
                                skip: (pageNum - 1) * size,
                                take: size,
                        }),
                ]);

                // Normalize cancellation reason (supports cancelReason or cancellationReason)
                const normalized = items.map(b => ({
                        id: b.id,
                        status: b.status,
                        startTs: b.startTs,
                        endTs: b.endTs,
                        createdAt: b.createdAt,
                        room: b.room ? { id: b.room.id, name: b.room.name } : null,
                        building: b.room?.floor?.building
                                ? { id: b.room.floor.building.id, name: b.room.floor.building.name }
                                : null,
                        user: b.user ? { id: b.user.id, name: b.user.name, email: b.user.email } : null,
                        cancelReason: b.cancelReason ?? b.cancellationReason ?? null,
                        courseName: b.courseName ?? null,
                        reason: b.reason ?? null,
                        studentId: b.studentId ?? null,

                }));

                res.json({
                        page: pageNum,
                        pageSize: size,
                        total,
                        items: normalized,
                });
        } catch (e) {
                console.error(e);
                res.status(500).json({ error: 'Failed to load history' });
        }
});

export default router;
