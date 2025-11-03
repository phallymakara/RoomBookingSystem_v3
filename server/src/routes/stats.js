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

// ---- helpers ----
function getPastDaysRange(days = 30) {
        const end = new Date();
        const start = new Date();
        start.setUTCDate(end.getUTCDate() - (Number(days) - 1));
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCHours(23, 59, 59, 999);
        return { start, end };
}
function ymd(d) { return d.toISOString().slice(0, 10); }

// GET /stats/series?days=30
// Daily counts by status over the last N days (by createdAt)
router.get('/series', async (req, res) => {
        try {
                const days = Math.min(Math.max(parseInt(req.query.days || '30', 10), 1), 120);
                const { start, end } = getPastDaysRange(days);

                const rows = await prisma.booking.findMany({
                        where: { createdAt: { gte: start, lte: end } },
                        select: {
                                id: true,
                                room: { select: { floor: { select: { building: { select: { id: true, name: true } } } } } }
                        },
                });

                const map = {};
                for (let i = 0; i < days; i++) {
                        const d = new Date(start.getTime());
                        d.setUTCDate(start.getUTCDate() + i);
                        map[ymd(d)] = { date: ymd(d), CONFIRMED: 0, REJECTED: 0, CANCELLED: 0, PENDING: 0 };
                }
                for (const r of rows) {
                        const d = r.createdAt;
                        const key = ymd(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
                        if (map[key] && map[key][r.status] !== undefined) map[key][r.status] += 1;
                }
                res.json(Object.values(map));
        } catch (e) {
                res.status(500).json({ error: 'Failed to load series', detail: String(e?.message || e) });
        }
});

// GET /stats/room-utilization?days=30
// Total booked HOURS per room (CONFIRMED) within range
router.get('/room-utilization', async (req, res) => {
        try {
                const days = Math.min(Math.max(parseInt(req.query.days || '30', 10), 1), 120);
                const { start, end } = getPastDaysRange(days);
                const rows = await prisma.booking.findMany({
                        where: { status: 'CONFIRMED', startTs: { gte: start }, endTs: { lte: end } },
                        select: { roomId: true, startTs: true, endTs: true, room: { select: { name: true } } },
                });
                const agg = {};
                for (const r of rows) {
                        const hours = Math.max(0, (r.endTs - r.startTs) / 36e5);
                        if (!agg[r.roomId]) agg[r.roomId] = { roomId: r.roomId, roomName: r.room?.name || '—', hours: 0 };
                        agg[r.roomId].hours += hours;
                }
                res.json(Object.values(agg).sort((a, b) => b.hours - a.hours).slice(0, 12));
        } catch (e) {
                res.status(500).json({ error: 'Failed to load room utilization', detail: String(e?.message || e) });
        }
});

// GET /stats/building-share?days=30
// Booking counts grouped by building (by createdAt)
router.get('/building-share', async (req, res) => {
        try {
                const days = Math.min(Math.max(parseInt(req.query.days || '30', 10), 1), 120);
                const { start, end } = getPastDaysRange(days);
                const rows = await prisma.booking.findMany({
                        where: { createdAt: { gte: start, lte: end } },
                        select: { room: { select: { building: { select: { id: true, name: true } } } } },
                });
                const agg = {};
                for (const r of rows) {
                        const b = r.room?.floor?.building;
                        const id = b?.id ?? 'unknown';
                        const name = b?.name ?? 'Unassigned';
                        if (!agg[id]) agg[id] = { buildingId: id, buildingName: name, count: 0 };
                        agg[id].count += 1;
                }
                res.json(Object.values(agg).sort((a, b) => b.count - a.count));
        } catch (e) {
                res.status(500).json({ error: 'Failed to load building share', detail: String(e?.message || e) });
        }
});




export default router;
