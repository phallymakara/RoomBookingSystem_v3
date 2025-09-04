import { Router } from 'express';
import { prisma } from '../prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8)
});

router.post('/register', async (req, res) => {
        const parse = registerSchema.safeParse(req.body);
        if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

        const { name, email, password } = parse.data;
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(409).json({ error: 'Email already registered' });

        const hashed = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
                data: { name, email, password: hashed, role: 'STUDENT' },
                select: { id: true, name: true, email: true, role: true }
        });

        res.status(201).json(user);
});

const loginSchema = z.object({
        email: z.string().email(),
        password: z.string().min(8)
});

router.post('/login', async (req, res) => {
        const parse = loginSchema.safeParse(req.body);
        if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });

        const { email, password } = parse.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

export default router;
