// src/routes/bookings.js
import { Router } from 'express';
import { prisma } from '../prisma.js';
import { z } from 'zod';
import { authGuard, requireAdmin } from '../authGuard.js';
import { emitAdmin } from '../lib/events.js';

const router = Router();

/* ---------- simple policy (tweak as you like) ---------- */
const MAX_MINUTES_PER_BOOKING = 120;   // 2 hours
const MAX_HOURS_AHEAD = 14 * 24;       // 14 days ahead

const createOrUpdateSchema = z.object({
        roomId: z.string().cuid(),
        startTs: z.coerce.date(),
        endTs: z.coerce.date()
}).refine((data) => data.endTs > data.startTs, {
        message: 'endTs must be after startTs', path: ['endTs']
});

// for booking-requests
const requestCreateSchema = z.object({
        roomId: z.string().cuid(),
        startTs: z.coerce.date(),
        endTs: z.coerce.date(),
        reason: z.string().max(500).optional(),
        studentId: z.string().max(64).optional(),
        courseName: z.string().max(120).optional(),
}).refine((d) => d.endTs > d.startTs, {
        message: 'endTs must be after startTs', path: ['endTs']
});

/* ---------- overlap helpers ---------- */
// Normal creation considers only CONFIRMED as blockers
async function hasOverlap({ roomId, startTs, endTs, excludeId }) {
        const count = await prisma.booking.count({
                where: {
                        id: excludeId ? { not: excludeId } : undefined,
                        roomId,
                        status: 'CONFIRMED',
                        startTs: { lt: endTs },
                        endTs: { gt: startTs },
                },
        });
        return count > 0;
}

// Approval considers both PENDING  CONFIRMED (except the request itself)
async function hasOverlapForApproval({ roomId, startTs, endTs, excludeId }) {
        const count = await prisma.booking.count({
                where: {
                        id: excludeId ? { not: excludeId } : undefined,
                        roomId,
                        status: { in: ['CONFIRMED', 'PENDING'] },
                        startTs: { lt: endTs },
                        endTs: { gt: startTs },
                },
        });
        return count > 0;
}

/* ---------- policy helper ---------- */
function checkPolicies({ startTs, endTs }) {
        const minutes = Math.floor((endTs - startTs) / 60000);
        if (minutes > MAX_MINUTES_PER_BOOKING) {
                return `Booking too long. Max is ${MAX_MINUTES_PER_BOOKING} minutes.`;
        }
        const now = new Date();
        const hoursAhead = Math.floor((startTs - now) / 3600000);
        if (hoursAhead > MAX_HOURS_AHEAD) {
                return `Too far in advance. Max is ${MAX_HOURS_AHEAD / 24} days ahead.`;
        }
        if (minutes <= 0) {
                return `Duration must be positive.`;
        }
        return null;
}

/* ========================================================
   NEW: POST /bookings/booking-requests (student)
   body: { roomId, startTs, endTs, reason?, studentId? }
   Creates a PENDING booking request
   ======================================================== */
router.post('/booking-requests', authGuard, async (req, res) => {
        const parse = requestCreateSchema.safeParse(req.body);
        if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

        const { roomId, startTs, endTs, reason, studentId, courseName } = parse.data;

        const policyErr = checkPolicies({ startTs, endTs });
        if (policyErr) return res.status(400).json({ error: policyErr });

        const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });
        if (!room) return res.status(404).json({ error: 'Room not found' });

        // allow multiple PENDINGs if you prefer; here we only block against CONFIRMED
        if (await hasOverlap({ roomId, startTs, endTs })) {
                return res.status(409).json({ error: 'Time slot overlaps a confirmed booking' });
        }

        const booking = await prisma.booking.create({
                data: {
                        roomId,
                        userId: req.user.id,
                        startTs,
                        endTs,
                        status: 'PENDING',
                        reason: reason || null,
                        studentId: studentId || null,
                        courseName: courseName || null,
                },
                include: { room: true, user: true },
        });

        // Persist (optional) and notify admins in real time
        try {
                // Optional persistence for unread counts
                // await prisma.adminNotification.create({ data: { type: 'BOOKING_REQUEST', bookingId: booking.id } });
                await emitAdmin({
                        type: 'BOOKING_REQUEST_CREATED',
                        payload: {
                                id: booking.id,
                                roomId: booking.roomId,
                                roomName: booking.room?.name ?? 'Unknown Room',
                                userName: booking.user?.name ?? 'Unknown User',
                                startTs: booking.startTs,
                                endTs: booking.endTs,
                        }
                });
        } catch (error) {
                // Log non-fatal error
                console.error('Failed to notify admins:', error);
        }



        return res.status(201).json(booking);
});

/* ========================================================
   NEW: GET /bookings/admin/booking-requests (admin)
   query: status=PENDING|CONFIRMED|REJECTED (default PENDING)
   ======================================================== */
router.get('/admin/booking-requests', authGuard, requireAdmin, async (req, res) => {
        const raw = String(req.query.status || 'PENDING').toUpperCase();
        const status = ['PENDING', 'CONFIRMED', 'REJECTED'].includes(raw) ? raw : 'PENDING';

        const items = await prisma.booking.findMany({
                where: { status },
                orderBy: { createdAt: 'desc' },
                include: {
                        user: { select: { id: true, name: true, email: true } },
                        room: { select: { id: true, name: true } },
                },
        });

        res.json(items);
});

/* ========================================================
   NEW: POST /bookings/admin/booking-requests/:id/approve (admin)
   body: { note? }
   ======================================================== */
router.post('/admin/booking-requests/:id/approve', authGuard, requireAdmin, async (req, res) => {
        const id = req.params.id;
        const note = (req.body?.note || '').toString();

        const existing = await prisma.booking.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });
        if (existing.status !== 'PENDING') return res.status(400).json({ error: 'Request is not pending' });

        if (await hasOverlapForApproval({
                roomId: existing.roomId,
                startTs: existing.startTs,
                endTs: existing.endTs,
                excludeId: id
        })) {
                return res.status(409).json({ error: 'Slot is no longer available; cannot approve' });
        }

        const updated = await prisma.booking.update({
                where: { id },
                data: {
                        status: 'CONFIRMED',
                        decidedById: req.user.id,
                        reason: note
                                ? `${existing.reason ?? ''}${existing.reason ? ' — ' : ''}[APPROVE] ${note}`
                                : existing.reason,
                },
                include: {
                        user: { select: { id: true, name: true, email: true } },
                        room: { select: { id: true, name: true } },
                },
        });

        try {
                await emitAdmin({
                        type: 'BOOKING_REQUEST_DECIDED',
                        payload: {
                                id: updated.id,
                                status: updated.status, // 'CONFIRMED'
                                roomId: updated.roomId,
                                startTs: updated.startTs,
                                endTs: updated.endTs,
                        }
                });
        } catch (error) {
                // Log non-fatal error
                console.error('Failed to notify admins:', error);
        }

        try {
                emitAdmin({
                        type: 'BOOKING_REQUEST_DECIDED',
                        payload: {
                                id: updated.id,
                                status: updated.status, // 'CONFIRMED'
                        }
                });
        } catch { }
        res.json(updated);
});

/* ========================================================
   NEW: POST /bookings/admin/booking-requests/:id/reject (admin)
   body: { note? }
   ======================================================== */
router.post('/admin/booking-requests/:id/reject', authGuard, requireAdmin, async (req, res) => {
        const id = req.params.id;
        const note = (req.body?.note || '').toString();

        const existing = await prisma.booking.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Request not found' });
        if (existing.status !== 'PENDING') return res.status(400).json({ error: 'Request is not pending' });

        const updated = await prisma.booking.update({
                where: { id },
                data: {
                        status: 'REJECTED',
                        decidedById: req.user.id,
                        reason: note
                                ? `${existing.reason ?? ''}${existing.reason ? ' — ' : ''}[REJECT] ${note}`
                                : existing.reason,
                },
                include: {
                        user: { select: { id: true, name: true, email: true } },
                        room: { select: { id: true, name: true } },
                },
        });

        res.json(updated);
});

/* ========================================================
   EXISTING: POST /bookings  (immediate CONFIRMED)
   body: { roomId, startTs, endTs }
   ======================================================== */
router.post('/', authGuard, async (req, res) => {
        const parse = createOrUpdateSchema.safeParse(req.body);
        if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

        const { roomId, startTs, endTs } = parse.data;

        const policyErr = checkPolicies({ startTs, endTs });
        if (policyErr) return res.status(400).json({ error: policyErr });

        const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });
        if (!room) return res.status(404).json({ error: 'Room not found' });


        if (await hasOverlap({ roomId, startTs, endTs })) {
                return res.status(409).json({ error: 'Time slot overlaps an existing booking' });
        }

        const booking = await prisma.$transaction(async (tx) => {
                return tx.booking.create({
                        data: {
                                roomId,
                                userId: req.user.id,
                                startTs,
                                endTs,
                                status: 'CONFIRMED', // immediate
                        },
                        select: {
                                id: true, roomId: true, userId: true, startTs: true, endTs: true, status: true, createdAt: true
                        }
                });
        });

        res.status(201).json(booking);
});

/* ========================================================
   EXISTING: PATCH /bookings/:id  (edit times)
   ======================================================== */
router.patch('/:id', authGuard, async (req, res) => {
        const bookingId = req.params.id;

        const existing = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!existing) return res.status(404).json({ error: 'Booking not found' });

        if (req.user.role !== 'ADMIN' && existing.userId !== req.user.id) {
                return res.status(403).json({ error: 'Forbidden' });
        }

        const parse = createOrUpdateSchema.safeParse(req.body);
        if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
        const { roomId, startTs, endTs } = parse.data;

        const policyErr = checkPolicies({ startTs, endTs });
        if (policyErr) return res.status(400).json({ error: policyErr });

        const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });
        if (!room) return res.status(404).json({ error: 'Room not found' });

        if (await hasOverlap({ roomId, startTs, endTs, excludeId: bookingId })) {
                return res.status(409).json({ error: 'Time slot overlaps an existing booking' });
        }

        const updated = await prisma.booking.update({
                where: { id: bookingId },
                data: { roomId, startTs, endTs },
                select: {
                        id: true, roomId: true, userId: true, startTs: true, endTs: true, status: true, createdAt: true
                }
        });

        res.json(updated);
});

/* ========================================================
   EXISTING: DELETE /bookings/:id  (cancel)
   ======================================================== */
router.delete('/:id', authGuard, async (req, res) => {
        const bookingId = req.params.id;

        const existing = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!existing) return res.status(404).json({ error: 'Booking not found' });

        if (req.user.role !== 'ADMIN' && existing.userId !== req.user.id) {
                return res.status(403).json({ error: 'Forbidden' });
        }

        await prisma.booking.update({
                where: { id: bookingId },
                data: { status: 'CANCELLED' }
        });

        res.status(204).send();
});

/* ========================================================
   EXISTING: GET /bookings/my/list  (current user’s bookings)
   ======================================================== */
router.get('/my/list', authGuard, async (req, res) => {
        const items = await prisma.booking.findMany({
                where: { userId: req.user.id },
                orderBy: [{ startTs: 'asc' }],
                select: {
                        id: true, startTs: true, endTs: true, status: true,
                        room: { select: { id: true, name: true /* add building if you have a relation here */ } }
                }
        });
        res.json({ items });
});

/* ========================================================
   EXISTING: GET /bookings/admin/list  (admin, optional filters)
   ======================================================== */
const adminListSchema = z.object({
        roomId: z.string().cuid().optional(),
        userId: z.string().cuid().optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        status: z.enum(['CONFIRMED', 'CANCELLED']).optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/admin/list', authGuard, requireAdmin, async (req, res) => {
        const parse = adminListSchema.safeParse(req.query);
        if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
        const { roomId, userId, from, to, status, page, pageSize } = parse.data;

        const where = {
                ...(roomId ? { roomId } : {}),
                ...(userId ? { userId } : {}),
                ...(status ? { status } : {}),
                ...(from || to
                        ? {
                                AND: [
                                        from ? { endTs: { gte: from } } : {},
                                        to ? { startTs: { lte: to } } : {},
                                ],
                        }
                        : {}),
        };

        const [items, total] = await Promise.all([
                prisma.booking.findMany({
                        where,
                        orderBy: [{ startTs: 'asc' }],
                        skip: (page - 1) * pageSize,
                        take: pageSize,
                        select: {
                                id: true, startTs: true, endTs: true, status: true,
                                user: { select: { id: true, name: true, email: true } },
                                room: { select: { id: true, name: true /*, building: true*/ } },
                        }
                }),
                prisma.booking.count({ where }),
        ]);

        res.json({ items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 });
});


export default router;

