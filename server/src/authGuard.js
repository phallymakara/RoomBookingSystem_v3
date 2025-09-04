import jwt from 'jsonwebtoken';

export function authGuard(req, res, next) {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Missing token' });
        try {
                const payload = jwt.verify(token, process.env.JWT_SECRET);
                req.user = { id: payload.sub, role: payload.role };
                next();
        } catch {
                return res.status(401).json({ error: 'Invalid token' });
        }
}

export function requireAdmin(req, res, next) {
        if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
        next();
}
