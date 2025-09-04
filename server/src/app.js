// src/app.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import floorsRouter from './routes/floors.js';
import { prisma } from './lib/prisma.js';
import authRouter from './routes/auth.js';
import roomsRouter from './routes/rooms.js';
import bookingsRouter from './routes/bookings.js'; // <-- add this
import buildingsRouter from './routes/buildings.js';
import { authGuard } from './authGuard.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/floors', floorsRouter);
app.use('/rooms', roomsRouter);
app.use('/buildings', buildingsRouter);
app.use('/bookings', bookingsRouter); // <-- add this

// Example protected route
app.get('/me', authGuard, async (req, res) => {
        const me = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { id: true, name: true, email: true, role: true }
        });
        res.json(me);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
