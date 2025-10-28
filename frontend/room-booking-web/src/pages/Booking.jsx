// frontend/room-booking-web/src/pages/admin/Bookings.jsx
import { useEffect, useState } from 'react';

export default function AdminBookings() {
        const token = localStorage.getItem('token') || '';
        const [items, setItems] = useState([]);
        const [status, setStatus] = useState('CONFIRMED'); // or 'CANCELLED'
        const [loading, setLoading] = useState(true);
        const [err, setErr] = useState('');

        useEffect(() => {
                (async () => {
                        try {
                                setErr(''); setLoading(true);
                                // Call: GET /bookings/admin/list?status=CONFIRMED
                                const qs = new URLSearchParams({ status }).toString();
                                const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/bookings/admin/list?${qs}`, {
                                        headers: { Authorization: `Bearer ${token}` }
                                });
                                const data = await res.json();
                                setItems(Array.isArray(data?.items) ? data.items : []);
                        } catch (e) {
                                setErr(e.message || 'Failed to load bookings');
                        } finally {
                                setLoading(false);
                        }
                })();
        }, [token, status]);

        return (
                <div>
                        <h2 className="h4 mb-3">Bookings</h2>
                        <div className="btn-group mb-3">
                                <button className={`btn btn-sm ${status === 'CONFIRMED' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setStatus('CONFIRMED')}>Confirmed</button>
                                <button className={`btn btn-sm ${status === 'CANCELLED' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setStatus('CANCELLED')}>Cancelled</button>
                        </div>

                        {err && <div className="alert alert-danger">{err}</div>}
                        {loading ? 'Loading…' : (
                                <div className="table-responsive">
                                        <table className="table table-hover align-middle">
                                                <thead className="table-dark">
                                                        <tr><th>Student</th><th>Room</th><th>Start</th><th>End</th><th>Status</th></tr>
                                                </thead>
                                                <tbody>
                                                        {items.map(b => (
                                                                <tr key={b.id}>
                                                                        <td>{b.user?.name || b.user?.email || '—'}</td>
                                                                        <td>{b.room?.name || '—'}</td>
                                                                        <td>{new Date(b.startTs).toLocaleString()}</td>
                                                                        <td>{new Date(b.endTs).toLocaleString()}</td>
                                                                        <td><span className={`badge ${b.status === 'CONFIRMED' ? 'bg-success' : 'bg-secondary'}`}>{b.status}</span></td>
                                                                </tr>
                                                        ))}
                                                </tbody>
                                        </table>
                                </div>
                        )}
                </div>
        );
}
