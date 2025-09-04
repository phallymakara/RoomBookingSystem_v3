// frontend/src/pages/admin/AdminRequests.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
        listBookingRequests,
        approveBookingRequest,
        rejectBookingRequest,
} from '../../api';

const COLORS = { primary: '#272446', accent: '#c01d2e' };
const POLL_MS = 5000;

export default function AdminRequests() {
        const token = localStorage.getItem('token') || '';
        const [status, setStatus] = useState('PENDING'); // PENDING | CONFIRMED | REJECTED
        const [items, setItems] = useState([]);
        const [loading, setLoading] = useState(true);
        const [err, setErr] = useState('');

        // Track previous pending IDs to detect "new arrivals"
        const prevPendingIdsRef = useRef(new Set());
        const audioRef = useRef(null);

        // Request notification permission on mount
        useEffect(() => {
                if ('Notification' in window && Notification.permission === 'default') {
                        Notification.requestPermission().catch(() => { });
                }
        }, []);

        // Optional tiny beep (data URI so you don’t ship an asset)
        useEffect(() => {
                const beep = new Audio(
                        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQgAAAAA' // ultra-short silent-safe beep
                );
                beep.volume = 0.6;
                audioRef.current = beep;
        }, []);

        const labelText = useMemo(() => label(status), [status]);

        async function load(silent = false) {
                if (!silent) { setErr(''); setLoading(true); }
                try {
                        const data = await listBookingRequests(token, status);
                        const list = Array.isArray(data) ? data : data.items || [];
                        setItems(list);

                        // If we are looking at PENDING, detect new items
                        if (status === 'PENDING') {
                                const curr = new Set(list.map(b => b.id));
                                const prev = prevPendingIdsRef.current;

                                // New = in curr but not in prev
                                const hasNew = [...curr].some(id => !prev.has(id));

                                if (hasNew) {
                                        notifyAdminNewRequests(list.filter(b => !prev.has(b.id)));
                                        // play beep (optional)
                                        try { audioRef.current?.play().catch(() => { }); } catch { }
                                }
                                prevPendingIdsRef.current = curr;
                        }
                } catch (e) {
                        setErr(e.message || 'Failed to load requests');
                } finally {
                        if (!silent) setLoading(false);
                }
        }

        // Initial load + polling
        useEffect(() => {
                load();
                const id = setInterval(() => load(true), POLL_MS);
                return () => clearInterval(id);
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [status]);

        async function onApprove(id) {
                const note = window.prompt('Optional note for approval:') || '';
                try {
                        await approveBookingRequest(token, id, note);
                        await load();
                } catch (e) {
                        alert(e.message || 'Approve failed');
                }
        }

        async function onReject(id) {
                const note = window.prompt('Optional reason for rejection:') || '';
                try {
                        await rejectBookingRequest(token, id, note);
                        await load();
                } catch (e) {
                        alert(e.message || 'Reject failed');
                }
        }

        return (
                <div>
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                <h2 className="h4 mb-0">Requests</h2>
                                <div className="d-flex align-items-center gap-2">
                                        <div className="btn-group" role="group" aria-label="Filter">
                                                <button
                                                        className={`btn btn-sm ${status === 'PENDING' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                        onClick={() => setStatus('PENDING')}
                                                        style={status === 'PENDING' ? brandBtn(COLORS.primary) : {}}
                                                >
                                                        Pending
                                                </button>
                                                <button
                                                        className={`btn btn-sm ${status === 'CONFIRMED' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                        onClick={() => setStatus('CONFIRMED')}
                                                        style={status === 'CONFIRMED' ? brandBtn(COLORS.primary) : {}}
                                                >
                                                        Approved
                                                </button>
                                                <button
                                                        className={`btn btn-sm ${status === 'REJECTED' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                        onClick={() => setStatus('REJECTED')}
                                                        style={status === 'REJECTED' ? brandBtn(COLORS.primary) : {}}
                                                >
                                                        Rejected
                                                </button>
                                        </div>
                                        <button className="btn btn-sm btn-outline-secondary" onClick={() => load()}>
                                                <i className="bi bi-arrow-clockwise me-1"></i> Refresh
                                        </button>
                                </div>
                        </div>

                        <p className="text-secondary mt-2 mb-3">Review and act on student booking requests.</p>

                        {err && <div className="alert alert-danger">{err}</div>}
                        {loading ? (
                                <div className="d-flex align-items-center gap-2">
                                        <div className="spinner-border spinner-border-sm" role="status" />
                                        <span>Loading…</span>
                                </div>
                        ) : items.length === 0 ? (
                                <div className="alert alert-light border d-flex align-items-center">
                                        <i className="bi bi-inbox me-2"></i>
                                        <div>No {labelText.toLowerCase()} requests.</div>
                                </div>
                        ) : (
                                <div className="table-responsive">
                                        <table className="table table-hover align-middle">
                                                <thead className="table-dark">
                                                        <tr>
                                                                <th>Student</th>
                                                                <th>Room</th>
                                                                <th>Start</th>
                                                                <th>End</th>
                                                                <th>Reason</th>
                                                                <th>Status</th>
                                                                {status === 'PENDING' && <th style={{ width: 180 }}>Actions</th>}
                                                        </tr>
                                                </thead>
                                                <tbody>
                                                        {items.map((b) => (
                                                                <tr key={b.id}>
                                                                        <td>
                                                                                {b.user?.name || '—'}
                                                                                <span className="text-secondary small d-block">{b.user?.email || ''}</span>
                                                                        </td>
                                                                        <td>{b.room?.name}</td>
                                                                        <td>{fmt(b.startTs)}</td>
                                                                        <td>{fmt(b.endTs)}</td>
                                                                        <td>{b.reason || '—'}</td>
                                                                        <td>
                                                                                <span
                                                                                        className={`badge ${b.status === 'PENDING'
                                                                                                ? 'bg-warning text-dark'
                                                                                                : b.status === 'CONFIRMED'
                                                                                                        ? 'bg-success'
                                                                                                        : 'bg-danger'
                                                                                                }`}
                                                                                >
                                                                                        {label(b.status)}
                                                                                </span>
                                                                        </td>
                                                                        {status === 'PENDING' && (
                                                                                <td className="d-flex gap-2">
                                                                                        <button className="btn btn-sm btn-success" onClick={() => onApprove(b.id)}>
                                                                                                <i className="bi bi-check-lg me-1"></i> Approve
                                                                                        </button>
                                                                                        <button
                                                                                                className="btn btn-sm btn-outline-danger"
                                                                                                onClick={() => onReject(b.id)}
                                                                                                style={{
                                                                                                        '--bs-btn-hover-bg': COLORS.accent,
                                                                                                        '--bs-btn-hover-border-color': COLORS.accent,
                                                                                                }}
                                                                                        >
                                                                                                <i className="bi bi-x-lg me-1"></i> Reject
                                                                                        </button>
                                                                                </td>
                                                                        )}
                                                                </tr>
                                                        ))}
                                                </tbody>
                                        </table>
                                </div>
                        )}
                </div>
        );
}

function notifyAdminNewRequests(newOnes) {
        if (!('Notification' in window)) return;

        const title =
                newOnes.length === 1
                        ? 'New room booking request'
                        : `${newOnes.length} new room booking requests`;

        const body =
                newOnes.length === 1
                        ? summarize(newOnes[0])
                        : 'Open the Requests page to review.';

        if (Notification.permission === 'granted') {
                // Simple page-based notification (works without a service worker)
                try { new Notification(title, { body }); } catch { }
        }
}

// Helper to make a short body text
function summarize(b) {
        const who = b.user?.name || b.user?.email || 'Student';
        const room = b.room?.name || 'a room';
        return `${who} requested ${room}`;
}

function fmt(ts) {
        try {
                return new Date(ts).toLocaleString();
        } catch {
                return ts;
        }
}
function label(s) {
        if (s === 'CONFIRMED') return 'Approved';
        if (s === 'REJECTED') return 'Rejected';
        return 'Pending';
}
function brandBtn(color) {
        return {
                '--bs-btn-bg': color,
                '--bs-btn-border-color': color,
                '--bs-btn-hover-bg': '#1f1d37',
                '--bs-btn-hover-border-color': '#1f1d37',
                '--bs-btn-color': '#fff',
        };
}
