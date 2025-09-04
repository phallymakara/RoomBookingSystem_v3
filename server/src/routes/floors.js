import { Router } from 'express';
import { prisma } from '../prisma.js';
import { authGuard } from '../authGuard.js';

const router = Router();

function adminOnly(req, res, next) {
        if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
        next();
}

/**
 * GET /floors?buildingId=...
 * List floors, optionally by building
 */
router.get('/', authGuard, async (req, res) => {
        const { buildingId } = req.query;
        const where = buildingId ? { buildingId } : {};
        const floors = await prisma.floor.findMany({
                where,
                orderBy: [{ name: 'asc' }],
                select: { id: true, name: true, buildingId: true, createdAt: true },
        });
        res.json(floors);
});

/**
 * POST /floors  { buildingId, name }
 * Create floor (admin)
 */
router.post('/', authGuard, adminOnly, async (req, res) => {
        const { buildingId, name } = req.body;
        if (!buildingId) return res.status(400).json({ error: 'buildingId is required' });
        if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

        try {
                const f = await prisma.floor.create({
                        data: { buildingId, name: name.trim() },
                        select: { id: true, name: true, buildingId: true },
                });
                res.status(201).json(f);
        } catch (e) {
                if (e.code === 'P2003') return res.status(400).json({ error: 'Invalid buildingId' });
                if (e.code === 'P2002') return res.status(409).json({ error: 'Floor already exists in this building' });
                console.error(e);
                res.status(500).json({ error: 'Failed to create floor' });
        }
});

/**
 * GET /floors/:id
 * Return floor + its rooms
 */
router.get('/:id', authGuard, async (req, res) => {
        const { id } = req.params;
        const floor = await prisma.floor.findUnique({
                where: { id },
                include: {
                        rooms: {
                                orderBy: { name: 'asc' },
                                select: {
                                        id: true,
                                        name: true,
                                        capacity: true,
                                        equipment: true, // <-- make sure it's included
                                        createdAt: true,
                                        updatedAt: true,
                                }
                        }
                },
        });
        if (!floor) return res.status(404).json({ error: 'Not found' });
        res.json({
                floor: { id: floor.id, name: floor.name, buildingId: floor.buildingId },
                rooms: floor.rooms
        });
});


/**
 * PUT /floors/:id  { name }
 * Rename floor (admin)
 */
router.put('/:id', authGuard, adminOnly, async (req, res) => {
        const { id } = req.params;
        const { name } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

        try {
                const f = await prisma.floor.update({
                        where: { id },
                        data: { name: name.trim() },
                        select: { id: true, name: true, buildingId: true },
                });
                res.json(f);
        } catch (e) {
                if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
                if (e.code === 'P2002') return res.status(409).json({ error: 'Floor already exists in this building' });
                console.error(e);
                res.status(500).json({ error: 'Failed to update floor' });
        }
});

/**
 * DELETE /floors/:id
 * Delete a floor (admin). Rooms are cascaded.
 */
router.delete('/:id', authGuard, adminOnly, async (req, res) => {
        const { id } = req.params;
        try {
                await prisma.floor.delete({ where: { id } });
                res.status(204).end();
        } catch (e) {
                if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
                console.error(e);
                res.status(500).json({ error: 'Failed to delete floor' });
        }
});

/**
 * POST /floors/:floorId/rooms  { name, capacity }
 * Create a room in a floor (admin)
 */
router.post('/:floorId/rooms', authGuard, adminOnly, async (req, res) => {
        const { floorId } = req.params;
        const { name, capacity, equipment } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

        try {
                const data = {
                        floorId,
                        name: name.trim(),
                        capacity: Number(capacity) || 4,
                };
                if (equipment !== undefined) data.equipment = equipment; // ← store projector, etc.

                const room = await prisma.room.create({ data });
                res.status(201).json(room);
        } catch (e) {
                if (e.code === 'P2003') return res.status(400).json({ error: 'Invalid floorId' });
                if (e.code === 'P2002') return res.status(409).json({ error: 'Room name already exists on this floor' });
                console.error(e);
                res.status(500).json({ error: 'Failed to create room' });
        }
});



/**
 * PUT /floors/rooms/:roomId  { name?, capacity? }
 * Update a room (admin)
 */
router.put('/rooms/:roomId', authGuard, adminOnly, async (req, res) => {
        const { roomId } = req.params;
        const { name, capacity, equipment } = req.body;

        try {
                const data = {};
                if (name !== undefined) data.name = name.trim();
                if (capacity !== undefined) data.capacity = Number(capacity);

                // merge equipment so we don't wipe other keys
                if (equipment !== undefined) {
                        const current = await prisma.room.findUnique({
                                where: { id: roomId },
                                select: { equipment: true }
                        });
                        data.equipment = { ...(current?.equipment || {}), ...equipment };
                }

                const room = await prisma.room.update({
                        where: { id: roomId },
                        data,
                });

                res.json(room);
        } catch (e) {
                if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
                if (e.code === 'P2002') return res.status(409).json({ error: 'Room name already exists on this floor' });
                console.error(e);
                res.status(500).json({ error: 'Failed to update room' });
        }
});



/**
 * DELETE /floors/rooms/:roomId
 * Delete a room (admin)
 */
router.delete('/rooms/:roomId', authGuard, adminOnly, async (req, res) => {
        const { roomId } = req.params;
        try {
                await prisma.room.delete({ where: { id: roomId } });
                res.status(204).end();
        } catch (e) {
                if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
                console.error(e);
                res.status(500).json({ error: 'Failed to delete room' });
        }
});

export default router;
