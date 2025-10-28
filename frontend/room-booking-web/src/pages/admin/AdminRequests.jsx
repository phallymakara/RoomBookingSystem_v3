import { useEffect, useMemo, useRef, useState } from 'react';
import {
        listBookingRequests,
        approveBookingRequest,
        rejectBookingRequest,
        getRoomSlotNotes,
        setRoomSlotNotes,
        cancelBooking,          // ✅ missing before
        clearRoomSlotNote,      // ✅ missing before
        openAdminEvents,
} from '../../api';

const COLORS = { primary: '#272446', accent: '#c01d2e' };
const POLL_MS = 5000;

export default function AdminRequests() {
        const token = localStorage.getItem('token') || '';

        // ✅ all hooks live INSIDE the component
        const [workingId, setWorkingId] = useState(null);
        const [toast, setToast] = useState('');

        const [status, setStatus] = useState('PENDING'); // PENDING | CONFIRMED | REJECTED
        const [items, setItems] = useState([]);
        const [loading, setLoading] = useState(true);
        const [err, setErr] = useState('');

        const prevPendingIdsRef = useRef(new Set());
        const audioRef = useRef(null);

        useEffect(() => {
                if ('Notification' in window && Notification.permission === 'default') {
                        Notification.requestPermission().catch(() => { });
                }
        }, []);

        useEffect(() => {
                const beep = new Audio(
                        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQgAAAAA'
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

                        if (status === 'PENDING') {
                                const curr = new Set(list.map(b => b.id));
                                const prev = prevPendingIdsRef.current;
                                const hasNew = [...curr].some(id => !prev.has(id));
                                if (hasNew) {
                                        notifyAdminNewRequests(list.filter(b => !prev.has(b.id)));
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

        useEffect(() => {
                load();
                const id = setInterval(() => load(true), POLL_MS);
                return () => clearInterval(id);
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [status]);

        useEffect(() => {
                if (!token) return;
                let es;
                try {
                        es = openAdminEvents(token);
                        es.addEventListener('ping', () => { });
                        es.onmessage = (ev) => {
                                try {
                                        const msg = JSON.parse(ev.data);
                                        if (msg?.type === 'BOOKING_REQUEST_CREATED') {
                                                if (status === 'PENDING') {
                                                        notifyAdminNewRequests([msg.payload]);
                                                        try { audioRef.current?.play().catch(() => { }); } catch { }
                                                        load(true);
                                                }
                                        } else if (msg?.type === 'BOOKING_REQUEST_DECIDED') {
                                                load(true);
                                        }
                                } catch { }
                        };
                } catch { }
                return () => { try { es?.close(); } catch { } };
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [token, status]);

        // ---------- Approve ----------
        async function onApprove(id) {
                if (workingId) return;
                setWorkingId(id);
                try {
                        // optimistic row update
                        setItems(prev => prev.map(b => b.id === id ? { ...b, status: 'CONFIRMED' } : b));

                        const b = items.find(x => x.id === id);
                        if (!b) throw new Error('Booking not in current view; refresh and try again.');

                        // 1) backend approve
                        await approveBookingRequest(token, id, ''); // POST /bookings/admin/booking-requests/:id/approve
                        // (this throws with the backend's message if not OK)

                        // 2) write/merge the slot-note (your current code already does this)
                        const k = noteKeyParts(b.startTs, b.endTs);
                        const who = (b.user?.name || b.user?.email || 'Student').trim();
                        const line2 = (b.courseName && b.reason) ? `${b.courseName} — ${b.reason}` : (b.courseName || b.reason || '');
                        const existing = await getRoomSlotNotes(token, b.roomId);
                        const filtered = existing.filter(n => !sameKey(n, k));
                        filtered.push({
                                ...k,
                                professor: who,
                                course: b.courseName || '',
                                reason: b.reason || ''
                        });
                        await setRoomSlotNotes(token, b.roomId, filtered); // PUT /rooms/:id/slot-notes (array)

                        await load(true);
                } catch (e) {
                        setToast(e.message || 'Approve failed');
                        // revert optimistic change
                        setItems(prev => prev.map(b => b.id === id ? { ...b, status: 'PENDING' } : b));
                } finally {
                        setWorkingId(null);
                }
        }

        // ---------- Reject ----------
        async function onReject(id) {
                try {
                        setItems(prev => prev.map(b => (b.id === id ? { ...b, status: 'REJECTED' } : b)));

                        const b = items.find(x => x.id === id);
                        if (!b) throw new Error('Booking not in current view; refresh and try again.');

                        // 1) Reject backend
                        await rejectBookingRequest(token, id, '');

                        // 2) Remove the slot note so students see "Free"
                        const key = noteKeyParts(b.startTs, b.endTs);
                        const existing = await getRoomSlotNotes(token, b.roomId);
                        const filtered = existing.filter(n => !sameKey(n, key));
                        await setRoomSlotNotes(token, b.roomId, filtered);

                        await load(true);
                } catch (e) {
                        alert(e.message || 'Reject failed');
                        await load(true);
                }
        }

        async function onCancel(id) {
                try {
                        setItems(prev => prev.map(b => b.id === id ? { ...b, status: 'CANCELLED' } : b));
                        const b = items.find(x => x.id === id);
                        if (!b) throw new Error('Booking not in current view; refresh and try again.');

                        // 1) cancel booking
                        await cancelBooking(token, id);

                        // 2) clear the matching slot note
                        const { weekday, startHHMM, endHHMM } = noteKeyParts(b.startTs, b.endTs);
                        await clearRoomSlotNote(token, b.roomId, { weekday, startHHMM, endHHMM });

                        await load(true);
                } catch (e) {
                        alert(e.message || 'Cancel failed');
                        setItems(prev => prev.map(b => b.id === id ? { ...b, status: 'CONFIRMED' } : b));
                }
        }

        // Map to weekday/start/end using LOCAL time (matches student)
        function noteKeyParts(startTs, endTs) {
                const s = new Date(startTs);
                const e = new Date(endTs);
                const js = s.getDay();                 // 0..6 (Sun..Sat) LOCAL
                const weekday = js === 0 ? 6 : js;     // 1..6 Mon..Sat (map Sun->6)
                const hhmm = (d) => d.toTimeString().slice(0, 5);
                return { weekday, startHHMM: hhmm(s), endHHMM: hhmm(e) };
        }
        function sameKey(a, b) {
                return a.weekday === b.weekday && a.startHHMM === b.startHHMM && a.endHHMM === b.endHHMM;
        }

        return (
                <div>
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                <h2 className="h4 mb-0">Requests</h2>
                                <div className="d-flex align-items-center gap-2">
                                        <div className="btn-group" role="group">
                                                <button
                                                        className={`btn btn-sm ${status === 'PENDING' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                        onClick={() => setStatus('PENDING')}
                                                        style={status === 'PENDING' ? brandBtn(COLORS.primary) : {}}
                                                >Pending</button>
                                                <button
                                                        className={`btn btn-sm ${status === 'CONFIRMED' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                        onClick={() => setStatus('CONFIRMED')}
                                                        style={status === 'CONFIRMED' ? brandBtn(COLORS.primary) : {}}
                                                >Approved</button>
                                                <button
                                                        className={`btn btn-sm ${status === 'REJECTED' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                        onClick={() => setStatus('REJECTED')}
                                                        style={status === 'REJECTED' ? brandBtn(COLORS.primary) : {}}
                                                >Rejected</button>
                                        </div>
                                        <button className="btn btn-sm btn-outline-secondary" onClick={() => load()}>
                                                <i className="bi bi-arrow-clockwise me-1"></i> Refresh
                                        </button>
                                </div>
                        </div>

                        <p className="text-secondary mt-2 mb-3">Review and act on student booking requests.</p>

                        {toast && <div className="alert alert-warning">{toast}</div>}
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
                                                <thead className="table-dark" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                                        <tr>
                                                                {['Student', 'Room', 'Start', 'End', 'Course', 'Reason', 'Status'].map((h) => (
                                                                        <th key={h}>{h}</th>
                                                                ))}
                                                        </tr>
                                                </thead>

                                                <tbody>
                                                        {items.map((b) => (
                                                                <tr key={b.id}>
                                                                        <td>
                                                                                <div className="fw-semibold">{b.name?.trim() || b.user?.name || '—'}</div>
                                                                                <div className="text-secondary small">
                                                                                        {b.studentId ? `ID: ${b.studentId}` : (b.user?.email || '')}
                                                                                </div>
                                                                                {b.status === 'PENDING' && (
                                                                                        <div className="mt-2 d-flex flex-wrap gap-2">
                                                                                                <button
                                                                                                        type="button"
                                                                                                        className="btn btn-sm btn-success"
                                                                                                        disabled={workingId === b.id}
                                                                                                        onClick={() => onApprove(b.id)}
                                                                                                >
                                                                                                        {workingId === b.id ? 'Approving…' : (<><i className="bi bi-check-lg me-1"></i>Approve</>)}
                                                                                                </button>

                                                                                                <button
                                                                                                        type="button"
                                                                                                        className="btn btn-sm btn-outline-danger"
                                                                                                        onClick={() => onReject(b.id)}
                                                                                                        style={{
                                                                                                                '--bs-btn-hover-bg': COLORS.accent,
                                                                                                                '--bs-btn-hover-border-color': COLORS.accent,
                                                                                                        }}
                                                                                                >
                                                                                                        <i className="bi bi-x-lg me-1"></i>Reject
                                                                                                </button>
                                                                                        </div>
                                                                                )}
                                                                        </td>

                                                                        <td>{b.room?.name}</td>
                                                                        <td>{fmt(b.startTs)}</td>
                                                                        <td>{fmt(b.endTs)}</td>
                                                                        <td>{b.courseName || '—'}</td>
                                                                        <td>{b.reason || '—'}</td>
                                                                        <td>
                                                                                <span className={`badge ${b.status === 'PENDING'
                                                                                        ? 'bg-warning text-dark'
                                                                                        : b.status === 'CONFIRMED'
                                                                                                ? 'bg-success'
                                                                                                : 'bg-danger'
                                                                                        }`}>
                                                                                        {label(b.status)}
                                                                                </span>
                                                                        </td>
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
        const title = newOnes.length === 1 ? 'New room booking request' : `${newOnes.length} new room booking requests`;
        const body = newOnes.length === 1 ? summarize(newOnes[0]) : 'Open the Requests page to review.';
        if (Notification.permission === 'granted') {
                try { new Notification(title, { body }); } catch { }
        }
}
function summarize(b) {
        const who = b.user?.name || b.user?.email || 'Student';
        const room = b.room?.name || 'a room';
        return `${who} requested ${room}`;
}
function fmt(ts) {
        try { return new Date(ts).toLocaleString(); } catch { return ts; }
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
