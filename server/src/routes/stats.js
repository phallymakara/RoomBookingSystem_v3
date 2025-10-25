import express from 'express';
import { prisma } from '../lib/prisma.js';

const router = express.Router();

// Compute "today" in caller's local timezone via offset minutes
function getTodayRange(tzOffsetMinutes = 0) {
        const now = new Date();
        const shifted = new Date(now.getTime() + tzOffsetMinutes * 60 * 1000);
        const y = shifted.getUTCFullYear();
        const m = shifted.getUTCMonth();
        const d = shifted.getUTCDate();
        const startLocal = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
        const endLocal = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
        return {
                start: new Date(startLocal.getTime() - tzOffsetMinutes * 60 * 1000),
                end: new Date(endLocal.getTime() - tzOffsetMinutes * 60 * 1000),
        };
}

router.get('/', async (req, res) => {
        try {
                const tzOffsetMinutes = Number(req.query.tzOffsetMinutes || 0);
                const { start, end } = getTodayRange(isNaN(tzOffsetMinutes) ? 0 : tzOffsetMinutes);

                // Your enum values (as per the error payload)
                const STATUS_APPROVED = 'CONFIRMED';
                const STATUS_CANCELLED = 'CANCELLED';
                const STATUS_REJECTED = 'REJECTED';

                const [
                        totalBuildings,
                        totalRooms,
                        approvedToday,
                        cancelledToday,
                        rejectedToday
                ] = await Promise.all([
                        prisma.building.count(),
                        prisma.room.count(),
                        prisma.booking.count({
                                where: { status: STATUS_APPROVED, createdAt: { gte: start, lte: end } },
                        }),
                        prisma.booking.count({
                                where: { status: STATUS_CANCELLED, createdAt: { gte: start, lte: end } },
                        }),
                        prisma.booking.count({
                                where: { status: STATUS_REJECTED, createdAt: { gte: start, lte: end } },
                        }),
                ]);

                res.json({ totalBuildings, totalRooms, approvedToday, cancelledToday, rejectedToday });
        } catch (e) {
                console.error('[/stats] error:', e);
                res.status(500).json({ error: 'Failed to load stats', detail: String(e?.message || e) });
        }
});

export default router;
