// server/src/middleware/auth.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/**
 * Require a valid Bearer token.
 * Sets req.user = { id, role } on success.
 */
export function requireAuth(req, res, next) {
        const auth = req.headers.authorization || '';
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Missing token' });

        try {
                const payload = jwt.verify(token, JWT_SECRET);
                req.user = { id: payload.id, role: payload.role };
                next();
        } catch {
                return res.status(401).json({ error: 'Invalid token' });
        }
}

/**
 * Require a specific role (e.g., 'ADMIN').
 */
export function requireRole(requiredRole) {
        return (req, res, next) => {
                if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
                if (req.user.role !== requiredRole) {
                        return res.status(403).json({ error: 'Forbidden: insufficient role' });
                }
                next();
        };
}
