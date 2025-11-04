import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authGuard, requireAdmin } from '../authGuard.js';
import { z } from 'zod';

const router = Router();

// Keys for Policy K/V
const K = {
        campusName: 'settings:campusName',
        openStart: 'settings:defaultOpenStart',
        openEnd: 'settings:defaultOpenEnd',
        telegram: 'settings:telegramLink',
        autoEnabled: 'settings:autoCancelEnabled',
        autoMinutes: 'settings:autoCancelGraceMinutes',
};

// Small helpers
async function getStr(key, dflt = '') {
        const row = await prisma.policy.findUnique({ where: { key } });
        return row?.value ?? dflt;
}
async function getBool(key, dflt = false) {
        return (await getStr(key, dflt ? 'true' : 'false')) === 'true';
}
async function getInt(key, dflt = 0) {
        const v = parseInt(await getStr(key, String(dflt)), 10);
        return Number.isFinite(v) ? v : dflt;
}
function setStr(key, val) {
        return prisma.policy.upsert({
                where: { key },
                create: { key, value: String(val ?? '') },
                update: { value: String(val ?? '') },
        });
}
async function readSettings() {
        return {
                campusName: await getStr(K.campusName, ''),
                defaultOpenStart: await getStr(K.openStart, '08:00'),
                defaultOpenEnd: await getStr(K.openEnd, '22:00'),
                telegramLink: await getStr(K.telegram, ''),
                autoCancelEnabled: await getBool(K.autoEnabled, false),
                autoCancelGraceMinutes: await getInt(K.autoMinutes, 15),
        };
}

// Public read (students)
router.get('/settings', async (_req, res) => {
        try { res.json(await readSettings()); }
        catch { res.status(500).json({ error: 'Failed to load settings' }); }
});

// Admin read
router.get('/admin/settings', authGuard, requireAdmin, async (_req, res) => {
        try { res.json(await readSettings()); }
        catch { res.status(500).json({ error: 'Failed to load settings' }); }
});

// Admin write
const putSchema = z.object({
        campusName: z.string().min(1).max(100),
        defaultOpenStart: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM (e.g., 08:00)'),
        defaultOpenEnd: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM (e.g., 18:00)'),
        telegramLink: z.union([
                z.literal(''),
                z.string().url().refine(v => v.startsWith('https://t.me/'), { message: 'Telegram link must start with https://t.me/' })
        ]).nullable(),
        autoCancelEnabled: z.boolean(),
        autoCancelGraceMinutes: z.coerce.number().int().min(0).max(600),
});

router.put('/admin/settings', authGuard, requireAdmin, async (req, res) => {
        try {
                const {
                        campusName, defaultOpenStart, defaultOpenEnd,
                        telegramLink, autoCancelEnabled, autoCancelGraceMinutes
                } = putSchema.parse(req.body || {});
                await Promise.all([
                        setStr(K.campusName, campusName.trim()),
                        setStr(K.openStart, defaultOpenStart),
                        setStr(K.openEnd, defaultOpenEnd),
                        setStr(K.telegram, telegramLink || ''),
                        setStr(K.autoEnabled, autoCancelEnabled ? 'true' : 'false'),
                        setStr(K.autoMinutes, autoCancelGraceMinutes),
                ]);
                res.status(200).json({ ok: true });
        } catch (e) {
                if (e?.issues?.[0]?.message) return res.status(400).json({ error: e.issues[0].message });
                res.status(500).json({ error: 'Failed to save settings' });
        }
});

export default router;
