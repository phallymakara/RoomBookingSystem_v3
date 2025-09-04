// ESM
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authGuard } from '../authGuard.js';

const router = Router();

// Small helper: admin-only after authGuard
function adminOnly(req, res, next) {
        if (req.user?.role !== 'ADMIN') {
                return res.status(403).json({ error: 'Admin only' });
        }
        next();
}

/**
 * GET /buildings
 * List all buildings
 */
router.get('/', authGuard, async (_req, res) => {
        const buildings = await prisma.building.findMany({
                orderBy: { name: 'asc' },
        });
        res.json(buildings);
});

/**
 * POST /buildings  { name }
 * Create a building (admin)
 */
router.post('/', authGuard, adminOnly, async (req, res) => {
        const { name } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

        try {
                const b = await prisma.building.create({ data: { name: name.trim() } });
                res.status(201).json(b);
        } catch (e) {
                if (e.code === 'P2002') return res.status(409).json({ error: 'Building already exists' });
                console.error(e);
                res.status(500).json({ error: 'Failed to create building' });
        }
});

/**
 * PUT /buildings/:id  { name }
 * Rename a building (admin)
 */
router.put('/:id', authGuard, adminOnly, async (req, res) => {
        const { id } = req.params;
        const { name } = req.body;
        if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

        try {
                const b = await prisma.building.update({ where: { id }, data: { name: name.trim() } });
                res.json(b);
        } catch (e) {
                if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
                if (e.code === 'P2002') return res.status(409).json({ error: 'Building already exists' });
                console.error(e);
                res.status(500).json({ error: 'Failed to update building' });
        }
});

/**
 * DELETE /buildings/:id
 * Delete a building (admin). Floors/rooms are cascaded by schema.
 */
router.delete('/:id', authGuard, adminOnly, async (req, res) => {
        const { id } = req.params;
        try {
                await prisma.building.delete({ where: { id } });
                res.status(204).end();
        } catch (e) {
                if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' });
                console.error(e);
                res.status(500).json({ error: 'Failed to delete building' });
        }
});

export default router;
