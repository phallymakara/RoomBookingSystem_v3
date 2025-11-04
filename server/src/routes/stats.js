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

// Current month range in *local* time (uses tz offset), returned as UTC datetimes
function getCurrentMonthRange(tzOffsetMinutes = 0) {
        const nowUtc = new Date();
        // Convert to local
        const nowLocalMs = nowUtc.getTime() + tzOffsetMinutes * 60_000;
        const nowLocal = new Date(nowLocalMs);
        const startLocal = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), 1, 0, 0, 0, 0);
        const endLocal = new Date(nowLocal.getFullYear(), nowLocal.getMonth() + 1, 0, 23, 59, 59, 999); // end of this month
        // Convert back to UTC
        const startUtc = new Date(startLocal.getTime() - tzOffsetMinutes * 60_000);
        const endUtc = new Date(endLocal.getTime() - tzOffsetMinutes * 60_000);
        return { start: startUtc, end: endUtc, daysInMonth: endLocal.getDate(), today: nowLocal.getDate() };
}

// GET /stats/series?days=30
// Daily counts by status over the last N days (by createdAt)
// GET /stats/series?days=30
router.get('/series', async (req, res) => {
        try {
                const tz = Number(req.query.tzOffsetMinutes ?? 0) || 0;
                const monthMode = String(req.query.month || '').trim() === '1';
                let range, labels;
                if (monthMode) {
                        const { start, end, today } = getCurrentMonthRange(tz);
                        range = { start, end };
                        labels = Array.from({ length: today }, (_, i) => i + 1); // 1..today
                } else {
                        const days = Math.min(Math.max(parseInt(req.query.days || '30', 10), 1), 120);
                        const { start, end } = getPastDaysRange(days);
                        range = { start, end };
                        labels = Array.from({ length: days }, (_, i) => i + 1); // Day 1..N
                }

                // ✅ only fields we actually use
                const rows = await prisma.booking.findMany({
                        where: { createdAt: { gte: range.start, lte: range.end } },
                        select: { createdAt: true, status: true },
                });

                const map = {};
                if (monthMode) {
                        // Pre-fill each calendar day of this month up to "today"
                        const { start } = getCurrentMonthRange(tz);
                        for (let i = 0; i < labels.length; i++) {
                                const d = new Date(start.getTime());
                                d.setUTCDate(d.getUTCDate() + i);
                                map[ymd(d)] = { day: i + 1, CONFIRMED: 0, REJECTED: 0, CANCELLED: 0, PENDING: 0 };
                        }
                } else {
                        const { start } = range;
                        for (let i = 0; i < labels.length; i++) {
                                const d = new Date(start.getTime());
                                d.setUTCDate(start.getUTCDate() + i);
                                map[ymd(d)] = { day: i + 1, CONFIRMED: 0, REJECTED: 0, CANCELLED: 0, PENDING: 0 };
                        }
                }
                for (const r of rows) {
                        const d = r.createdAt;
                        const VALID = new Set(['CONFIRMED', 'REJECTED', 'CANCELLED', 'PENDING']);
                        for (const r of rows) {
                                const d = r.createdAt;
                                const key = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
                                        .toISOString().slice(0, 10);

                                const bucket = map[key];
                                if (!bucket) continue; // out of prefilled range (shouldn't happen, but safe)

                                // guard against any legacy/null statuses so it never crashes
                                const status = VALID.has(r.status) ? r.status : 'PENDING';
                                bucket[status] += 1;
                        }
                }
                // Return ordered array with consistent shape {day, ...}
                res.json(labels.map((_, i) => {
                        // find the key for this index (monthMode and rolling mode both filled in order)
                        return Object.values(map)[i] || { day: i + 1, CONFIRMED: 0, REJECTED: 0, CANCELLED: 0, PENDING: 0 };
                }));
        } catch (e) {
                console.error('[stats/series]', e);
                res.status(500).json({ error: 'Failed to load series' });
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
                const VALID = new Set(['CONFIRMED', 'REJECTED', 'CANCELLED', 'PENDING']);
                for (const r of rows) {
                        const d = r.createdAt;
                        const key = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
                                .toISOString().slice(0, 10);
                        const bucket = map[key];
                        if (!bucket) continue;
                        const s = VALID.has(r.status) ? r.status : 'PENDING';
                        bucket[s] += 1;
                }
                res.json(Object.values(agg).sort((a, b) => b.hours - a.hours).slice(0, 12));
        } catch (e) {
                console.error('[stats/series]', e?.message, e);
                res.status(500).json({ error: 'Failed to load series', detail: String(e?.message || e) });
        }
});

// GET /stats/building-share?days=30
// Booking counts grouped by building (by createdAt)
// GET /stats/building-share?days=30
router.get('/building-share', async (req, res) => {
        try {
                const days = Math.min(Math.max(parseInt(req.query.days || '30', 10), 1), 120);
                const { start, end } = getPastDaysRange(days);

                const rows = await prisma.booking.findMany({
                        where: { createdAt: { gte: start, lte: end } },
                        select: {
                                room: { select: { floor: { select: { building: { select: { id: true, name: true } } } } } }
                        },
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
                console.error('[stats/building-share]', e);
                res.status(500).json({ error: 'Failed to load building share' });
        }
});




export default router;
