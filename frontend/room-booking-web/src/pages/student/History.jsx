// frontend/room-booking-web/src/pages/student/History.jsx
import { useEffect, useState } from 'react';
import { getMyBookings, cancelBooking } from '../../api';

export default function History() {
        const token = localStorage.getItem('token') || '';
        const [items, setItems] = useState([]);
        const [loading, setLoading] = useState(true);
        const [err, setErr] = useState('');
        const [working, setWorking] = useState(null);

        useEffect(() => {
                (async () => {
                        try {
                                setErr('');
                                setLoading(true);
                                const data = await getMyBookings(token);          // calls GET /bookings/my/list
                                const list = Array.isArray(data?.items) ? data.items : [];
                                setItems(list);
                        } catch (e) {
                                setErr(e.message || 'Failed to load your bookings');
                        } finally {
                                setLoading(false);
                        }
                })();
        }, [token]);

        async function onCancel(id) {
                if (!id || working) return;
                try {
                        setWorking(id);
                        await cancelBooking(token, id);                     // DELETE /bookings/:id (sets CANCELLED)
                        setItems(prev => prev.map(b => b.id === id ? { ...b, status: 'CANCELLED' } : b));
                } catch (e) {
                        alert(e.message || 'Cancel failed');
                } finally {
                        setWorking(null);
                }
        }

        const fmtDate = (ts) => { try { return new Date(ts).toLocaleString(); } catch { return ts; } };
        const badge = (s) =>
                s === 'CONFIRMED' ? 'success' :
                        s === 'PENDING' ? 'warning text-dark' :
                                s === 'REJECTED' ? 'danger' : 'secondary';

        return (
                <div className="container-fluid p-3">
                        <h2 className="h4 mb-3">My bookings</h2>
                        {err && <div className="alert alert-danger">{err}</div>}
                        {loading ? (
                                <div className="d-flex align-items-center gap-2">
                                        <div className="spinner-border spinner-border-sm" role="status" />
                                        <span>Loading…</span>
                                </div>
                        ) : items.length === 0 ? (
                                <div className="alert alert-light border d-flex align-items-center">
                                        <i className="bi bi-inbox me-2"></i>
                                        <div>No bookings yet.</div>
                                </div>
                        ) : (
                                <div className="table-responsive" style={{ maxHeight: 480, overflowY: 'auto' }}>
                                        <table className="table table-hover align-middle table-sticky">
                                                <thead className="table-dark">
                                                        <tr>
                                                                <th>Room</th>
                                                                <th>Start</th>
                                                                <th>End</th>
                                                                <th>Course</th>
                                                                <th>Reason</th>
                                                                <th>Status</th>
                                                                <th />
                                                        </tr>
                                                </thead>
                                                <tbody>
                                                        {items.map(b => (
                                                                <tr key={b.id}>
                                                                        <td>{b.room?.name || '—'}</td>
                                                                        <td>{fmtDate(b.startTs)}</td>
                                                                        <td>{fmtDate(b.endTs)}</td>
                                                                        <td>{b.courseName || '—'}</td>
                                                                        <td>{b.reason || '—'}</td>
                                                                        <td><span className={`badge bg-${badge(b.status)}`}>{b.status}</span></td>
                                                                        <td className="text-end">
                                                                                {b.status === 'CONFIRMED' && (
                                                                                        <button
                                                                                                className="btn btn-sm btn-outline-danger"
                                                                                                disabled={working === b.id}
                                                                                                onClick={() => onCancel(b.id)}
                                                                                        >
                                                                                                {working === b.id ? 'Cancelling…' : 'Cancel'}
                                                                                        </button>
                                                                                )}
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
