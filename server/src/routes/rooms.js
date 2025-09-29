// src/routes/rooms.js
import express from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

/* ---------------------- helpers ---------------------- */
const floorLabelKey = (building) => `floor_labels:${building.toLowerCase()}`;

async function getFloorLabels(building) {
        const p = await prisma.policy.findUnique({ where: { key: floorLabelKey(building) } });
        if (!p) return {};
        try { return JSON.parse(p.value || '{}'); } catch { return {}; }
}

async function setFloorLabels(building, labelsObj) {
        const value = JSON.stringify(labelsObj || {});
        await prisma.policy.upsert({
                where: { key: floorLabelKey(building) },
                create: { key: floorLabelKey(building), value },
                update: { value },
        });
}

// default label if none configured
function ordinal(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function defaultFloorLabel(n) {
        // 1 -> "First Floor", 2 -> "Second Floor"...
        const names = { 1: 'First', 2: 'Second', 3: 'Third', 4: 'Fourth', 5: 'Fifth' };
        return `${names[n] || `${ordinal(n)}th`} Floor`.replace('thth', 'th'); // safe fallback
}

/* ---------------------- existing endpoints ---------------------- */

// GET /rooms
router.get('/', async (req, res) => {
        try {
                const where = { isActive: true };
                if (req.query.building) where['building'] = req.query.building;
                const rooms = await prisma.room.findMany({
                        where,
                        orderBy: [{ building: 'asc' }, { floor: 'asc' }, { name: 'asc' }],
                        select: { id: true, name: true, building: true, floor: true, capacity: true, equipment: true, photoUrl: true, isActive: true },
                });
                res.json(rooms);
        } catch {
                res.status(500).json({ error: 'Failed to load rooms' });
        }
});

// GET /rooms/:id
router.get('/:id', async (req, res) => {
        try {
                const room = await prisma.room.findUnique({ where: { id: req.params.id } });
                if (!room) return res.status(404).json({ error: 'Room not found' });
                res.json(room);
        } catch {
                res.status(500).json({ error: 'Failed to load room' });
        }
});

// GET /rooms/:id/availability  (unchanged)
const availSchema = z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),         // YYYY-MM-DD
        duration: z.coerce.number().int().min(15).max(8 * 60).default(60),
        step: z.coerce.number().int().min(5).max(120).default(30),
        openStart: z.string().regex(/^\d{2}:\d{2}$/).default('08:00'),
        openEnd: z.string().regex(/^\d{2}:\d{2}$/).default('22:00'),
});

router.get('/:id/availability', async (req, res) => {
        try {
                const { date, duration, step, openStart, openEnd } = availSchema.parse(req.query);
                const roomId = req.params.id;

                const toMinutes = (hhmm) => {
                        const [h, m] = hhmm.split(':').map(Number);
                        return h * 60 + m;
                };
                const startMin = toMinutes(openStart);
                const endMin = toMinutes(openEnd);
                if (endMin <= startMin) return res.status(400).json({ error: 'openEnd must be after openStart' });

                const dayStart = new Date(`${date}T00:00:00.000Z`);
                const dayEnd = new Date(`${date}T23:59:59.999Z`);

                const existing = await prisma.booking.findMany({
                        where: {
                                roomId,
                                status: { in: ['CONFIRMED', 'PENDING'] },
                                OR: [
                                        { startTs: { gte: dayStart, lte: dayEnd } },
                                        { endTs: { gte: dayStart, lte: dayEnd } },
                                        { startTs: { lte: dayStart }, endTs: { gte: dayEnd } },
                                ],
                        },
                        select: { startTs: true, endTs: true },
                        orderBy: { startTs: 'asc' },
                });

                const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

                const base = new Date(`${date}T00:00:00.000Z`).getTime();
                const minutesToDate = (mins) => new Date(base + mins * 60 * 1000);

                const slots = [];
                for (let t = startMin; t + duration <= endMin; t += step) {
                        const s = minutesToDate(t);
                        const e = minutesToDate(t + duration);
                        const conflict = existing.some(b => overlaps(s, e, b.startTs, b.endTs));
                        if (!conflict) slots.push({ startTs: s.toISOString(), endTs: e.toISOString() });
                }

                res.json({ roomId, date, duration, step, openStart, openEnd, slots });
        } catch (e) {
                res.status(400).json({ error: e?.errors?.[0]?.message || 'Bad request' });
        }
});

/* ---------------------- NEW: admin CRUD rooms ---------------------- */

// POST /rooms  (admin create room)
const createRoomSchema = z.object({
        name: z.string().min(2),
        building: z.string().min(1),
        floor: z.coerce.number().int().min(-5).max(500),
        capacity: z.coerce.number().int().min(1).max(999),
        equipment: z.any().optional().default({}), // e.g. { whiteboard:true, tv:true }
        photoUrl: z.string().url().optional(),
        isActive: z.boolean().optional().default(true),
});

router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
        try {
                const body = createRoomSchema.parse(req.body);
                const created = await prisma.room.create({ data: body });
                res.status(201).json(created);
        } catch (e) {
                // handle unique name conflicts nicely
                if (e?.code === 'P2002') return res.status(409).json({ error: 'Room name already exists' });
                if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
                res.status(500).json({ error: 'Failed to create room' });
        }
});

// DELETE /rooms/:id  (admin "remove" room -> soft delete: set isActive=false)
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
        try {
                const id = req.params.id;

                const room = await prisma.room.findUnique({ where: { id } });
                if (!room) return res.status(404).json({ error: 'Room not found' });

                await prisma.room.update({ where: { id }, data: { isActive: false } });
                res.status(204).end();
        } catch {
                res.status(500).json({ error: 'Failed to remove room' });
        }
});

// (optional) hard delete if there are NO bookings at all
router.delete('/:id/hard', requireAuth, requireRole('ADMIN'), async (req, res) => {
        try {
                const id = req.params.id;
                const cnt = await prisma.booking.count({ where: { roomId: id } });
                if (cnt > 0) return res.status(409).json({ error: 'Room has bookings; cannot hard-delete' });

                await prisma.room.delete({ where: { id } });
                res.status(204).end();
        } catch {
                res.status(500).json({ error: 'Failed to hard-delete room' });
        }
});

/* ---------------------- NEW: floor labels & grouping ---------------------- */

// PUT /rooms/floor-labels   (admin)  body: { building, labels: [{level, label}, ...] }
const floorLabelsSchema = z.object({
        building: z.string().min(1),
        labels: z.array(z.object({
                level: z.coerce.number().int(),
                label: z.string().min(1),
        })).min(1),
});

router.put('/floor-labels', requireAuth, requireRole('ADMIN'), async (req, res) => {
        try {
                const { building, labels } = floorLabelsSchema.parse(req.body);
                const obj = Object.fromEntries(labels.map(({ level, label }) => [String(level), label]));
                await setFloorLabels(building, obj);
                res.status(204).end();
        } catch (e) {
                if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0].message });
                res.status(500).json({ error: 'Failed to save floor labels' });
        }
});

// GET /rooms/floor-labels?building=Main
router.get('/floor-labels', async (req, res) => {
        try {
                const building = (req.query.building || '').toString();
                if (!building) return res.status(400).json({ error: 'building is required' });
                const labels = await getFloorLabels(building);
                res.json(labels); // { "1": "First Floor", "2": "Second Floor", ... }
        } catch {
                res.status(500).json({ error: 'Failed to load floor labels' });
        }
});

// GET /rooms/grouped?building=Main
router.get('/grouped', async (req, res) => {
        try {
                const building = req.query.building?.toString();
                const where = { isActive: true };
                if (building) where['building'] = building;

                const rooms = await prisma.room.findMany({
                        where,
                        orderBy: [{ floor: 'asc' }, { name: 'asc' }],
                        select: { id: true, name: true, building: true, floor: true, capacity: true, equipment: true, photoUrl: true },
                });

                // labels map per building (if building is unspecified, we’ll compute per room)
                const labelsCache = {};
                const groupsMap = new Map();
                for (const r of rooms) {
                        if (!labelsCache[r.building]) labelsCache[r.building] = await getFloorLabels(r.building);

                        const label = labelsCache[r.building][String(r.floor)] || defaultFloorLabel(r.floor);
                        const key = `${r.building}#${r.floor}`;
                        if (!groupsMap.has(key)) groupsMap.set(key, { building: r.building, floor: r.floor, label, rooms: [] });
                        groupsMap.get(key).rooms.push(r);
                }

                // sort by building then floor
                const groups = Array.from(groupsMap.values())
                        .sort((a, b) => a.building.localeCompare(b.building) || a.floor - b.floor);

                res.json(groups);
        } catch {
                res.status(500).json({ error: 'Failed to load grouped rooms' });
        }
});

/* ---------------------- NEW: weekly slot notes ---------------------- */
/**
 * Model used below: prisma.roomSlotNote with fields:
 * - roomId (FK to room.id), weekday (1-6), startHHMM, endHHMM, professor?, course?
 */

// GET /rooms/:roomId/slot-notes
router.get('/:roomId/slot-notes', requireAuth, async (req, res) => {
        try {
                const { roomId } = req.params;
                const notes = await prisma.roomSlotNote.findMany({
                        where: { roomId },
                        orderBy: [{ weekday: 'asc' }, { startHHMM: 'asc' }],
                });
                res.json(notes);
        } catch (e) {
                res.status(500).json({ error: 'Failed to load slot notes' });
        }
});

// PUT /rooms/:roomId/slot-notes   [ {weekday,startHHMM,endHHMM,professor?,course?}, ... ]
const slotNoteSchema = z.array(z.object({
        weekday: z.coerce.number().int().min(1).max(6),
        startHHMM: z.string().regex(/^\d{2}:\d{2}$/),
        endHHMM: z.string().regex(/^\d{2}:\d{2}$/),
        professor: z.string().optional().default(''),
        course: z.string().optional().default(''),
})).default([]);

router.put('/:roomId/slot-notes', requireAuth, requireRole('ADMIN'), async (req, res) => {
        const { roomId } = req.params;

        try {
                const parsed = slotNoteSchema.parse(Array.isArray(req.body) ? req.body : []);
                // normalize/trim text fields
                const valid = parsed.map(n => ({
                        weekday: n.weekday,
                        startHHMM: n.startHHMM,
                        endHHMM: n.endHHMM,
                        professor: (n.professor || '').trim(),
                        course: (n.course || '').trim(),
                }));

                await prisma.$transaction([
                        prisma.roomSlotNote.deleteMany({ where: { roomId } }),
                        ...(valid.length
                                ? [prisma.roomSlotNote.createMany({
                                        data: valid.map(n => ({ roomId, ...n })),
                                        skipDuplicates: true,
                                })]
                                : []),
                ]);

                res.status(204).end();
        } catch (e) {
                if (e instanceof z.ZodError) {
                        return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' });
                }
                if (e?.code === 'P2003') {
                        return res.status(400).json({ error: 'Invalid roomId' });
                }
                console.error(e);
                res.status(500).json({ error: 'Failed to save slot notes' });
        }
});

/* ---- NEW single-slot add/update (for Approve) ---- */
// POST /rooms/:roomId/slot-notes  { weekday,startHHMM,endHHMM,professor?,course? }
const slotNoteOneSchema = z.object({
        weekday: z.coerce.number().int().min(1).max(6),
        startHHMM: z.string().regex(/^\d{2}:\d{2}$/),
        endHHMM: z.string().regex(/^\d{2}:\d{2}$/),
        professor: z.string().optional().default(''),
        course: z.string().optional().default(''),
});

router.post('/:roomId/slot-notes', requireAuth, requireRole('ADMIN'), async (req, res) => {
        const { roomId } = req.params;
        try {
                const n = slotNoteOneSchema.parse(req.body || {});
                const payload = {
                        roomId,
                        weekday: n.weekday,
                        startHHMM: n.startHHMM,
                        endHHMM: n.endHHMM,
                        professor: (n.professor || '').trim(),
                        course: (n.course || '').trim(),
                };

                // safe upsert without requiring a composite unique: delete exact then create
                await prisma.$transaction([
                        prisma.roomSlotNote.deleteMany({
                                where: {
                                        roomId,
                                        weekday: payload.weekday,
                                        startHHMM: payload.startHHMM,
                                        endHHMM: payload.endHHMM,
                                }
                        }),
                        prisma.roomSlotNote.create({ data: payload }),
                ]);

                res.status(201).json({ ok: true });
        } catch (e) {
                if (e instanceof z.ZodError) {
                        return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' });
                }
                if (e?.code === 'P2003') {
                        return res.status(400).json({ error: 'Invalid roomId' });
                }
                res.status(500).json({ error: 'Failed to save slot note' });
        }
});

/* ---- NEW single-slot delete (for Reject/Cancel) ---- */
// DELETE /rooms/:roomId/slot-notes  { weekday,startHHMM,endHHMM }
const slotNoteKeySchema = z.object({
        weekday: z.coerce.number().int().min(1).max(6),
        startHHMM: z.string().regex(/^\d{2}:\d{2}$/),
        endHHMM: z.string().regex(/^\d{2}:\d{2}$/),
});

router.delete('/:roomId/slot-notes', requireAuth, requireRole('ADMIN'), async (req, res) => {
        const { roomId } = req.params;
        try {
                const k = slotNoteKeySchema.parse(req.body || {});
                await prisma.roomSlotNote.deleteMany({
                        where: {
                                roomId,
                                weekday: k.weekday,
                                startHHMM: k.startHHMM,
                                endHHMM: k.endHHMM,
                        },
                });
                res.status(204).end();
        } catch (e) {
                if (e instanceof z.ZodError) {
                        return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' });
                }
                res.status(500).json({ error: 'Failed to delete slot note' });
        }
});

// --- OPEN HOURS ---
// GET /rooms/:roomId/open-hours  (public read)
router.get('/:roomId/open-hours', async (req, res) => {
        try {
                const { roomId } = req.params;
                const rows = await prisma.roomOpenHour.findMany({
                        where: { roomId },
                        orderBy: [{ weekday: 'asc' }, { startHHMM: 'asc' }],
                        select: { weekday: true, startHHMM: true, endHHMM: true },
                });
                res.json(rows);
        } catch (e) {
                res.status(500).json({ error: 'Failed to load open hours' });
        }
});

const openHourSchema = z.array(z.object({
        weekday: z.coerce.number().int().min(1).max(6), // Mon..Sat to match your UI
        startHHMM: z.string().regex(/^\d{2}:\d{2}$/),
        endHHMM: z.string().regex(/^\d{2}:\d{2}$/),
})).default([]);

// PUT /rooms/:roomId/open-hours  (admin write)
router.put('/:roomId/open-hours', requireAuth, requireRole('ADMIN'), async (req, res) => {
        const { roomId } = req.params;
        try {
                const parsed = openHourSchema.parse(Array.isArray(req.body) ? req.body : []);
                const valid = parsed.map(h => ({
                        weekday: h.weekday,    // 1..6 = Mon..Sat (consistent with UI & RoomSlotNote)
                        startHHMM: h.startHHMM,
                        endHHMM: h.endHHMM,
                }));

                await prisma.$transaction([
                        prisma.roomOpenHour.deleteMany({ where: { roomId } }),
                        ...(valid.length
                                ? [prisma.roomOpenHour.createMany({
                                        data: valid.map(h => ({ roomId, ...h })),
                                        skipDuplicates: true,
                                })]
                                : []),
                ]);

                res.status(204).end();
        } catch (e) {
                if (e instanceof z.ZodError) {
                        return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' });
                }
                res.status(500).json({ error: 'Failed to save open hours' });
        }
});

export default router;
