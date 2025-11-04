// server/src/routes/settings.js
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authGuard, requireAdmin } from '../authGuard.js';
import { z } from 'zod';

const router = Router();

// ---- helpers to read/write Policy K/V ----
const KEYS = {
        campusName: 'settings:campusName',
        openStart: 'settings:defaultOpenStart',
        openEnd: 'settings:defaultOpenEnd',
        telegram: 'settings:telegramLink',
        autoEnabled: 'settings:autoCancelEnabled',
        autoMinutes: 'settings:autoCancelGraceMinutes',
};

async function getStr(key, dflt = '') {
        const row = await prisma.policy.findUnique({ where: { key } });
        return row?.value ?? dflt;
}
async function getBool(key, dflt = false) {
        const v = await getStr(key, dflt ? 'true' : 'false');
        return v === 'true';
}
async function getInt(key, dflt = 0) {
        const v = parseInt(await getStr(key, String(dflt)), 10);
        return Number.isFinite(v) ? v : dflt;
}
async function setStr(key, val) {
        await prisma.policy.upsert({
                where: { key },
                create: { key, value: String(val ?? '') },
                update: { value: String(val ?? '') },
        });
}

async function readSettings() {
        return {
                campusName: await getStr(KEYS.campusName, ''),
                defaultOpenStart: await getStr(KEYS.openStart, '08:00'),
                defaultOpenEnd: await getStr(KEYS.openEnd, '22:00'),
                telegramLink: await getStr(KEYS.telegram, ''),
                autoCancelEnabled: await getBool(KEYS.autoEnabled, false),
                autoCancelGraceMinutes: await getInt(KEYS.autoMinutes, 15),
        };
}

// ---- Public read (students) ----
router.get('/settings', async (_req, res) => {
        try {
                res.json(await readSettings());
        } catch {
                res.status(500).json({ error: 'Failed to load settings' });
        }
});

// ---- Admin read/write ----
const putSchema = z.object({
        campusName: z.string().min(1).max(100),
        defaultOpenStart: z.string().regex(/^\d{2}:\d{2}$/),
        defaultOpenEnd: z.string().regex(/^\d{2}:\d{2}$/),
        telegramLink: z.string().url().startsWith('https://t.me/').or(z.literal('')).nullable(),
        autoCancelEnabled: z.boolean(),
        autoCancelGraceMinutes: z.coerce.number().int().min(0).max(600),
});

router.get('/admin/settings', authGuard, requireAdmin, async (_req, res) => {
        try { res.json(await readSettings()); }
        catch { res.status(500).json({ error: 'Failed to load settings' }); }
});

router.put('/admin/settings', authGuard, requireAdmin, async (req, res) => {
        try {
                const {
                        campusName, defaultOpenStart, defaultOpenEnd,
                        telegramLink, autoCancelEnabled, autoCancelGraceMinutes
                } = putSchema.parse(req.body || {});
                await Promise.all([
                        setStr(KEYS.campusName, campusName.trim()),
                        setStr(KEYS.openStart, defaultOpenStart),
                        setStr(KEYS.openEnd, defaultOpenEnd),
                        setStr(KEYS.telegram, telegramLink || ''),
                        setStr(KEYS.autoEnabled, autoCancelEnabled ? 'true' : 'false'),
                        setStr(KEYS.autoMinutes, autoCancelGraceMinutes),
                ]);
                res.status(204).end();
        } catch (e) {
                if (e?.issues?.[0]?.message) return res.status(400).json({ error: e.issues[0].message });
                res.status(500).json({ error: 'Failed to save settings' });
        }
});

export default router;
