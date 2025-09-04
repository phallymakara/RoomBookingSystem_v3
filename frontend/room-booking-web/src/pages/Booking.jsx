import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getRoom, getAvailability, requestBooking } from '../api';

function toLocal(iso) {
        const d = new Date(iso);
        return d.toLocaleString();
}
function getToken() { return localStorage.getItem('token') || ''; }

export default function Booking() {
        const { id } = useParams(); // roomId
        const [room, setRoom] = useState(null);

        const [date, setDate] = useState(() => {
                const t = new Date(Date.now() + 86400000); // tomorrow
                return t.toISOString().slice(0, 10);
        });
        const [duration, setDuration] = useState(60);
        const [slots, setSlots] = useState([]);
        const [loading, setLoading] = useState(false);
        const [selectSlot, setSelectSlot] = useState(null);
        const [reason, setReason] = useState('');
        const [msg, setMsg] = useState({ type: '', text: '' });

        useEffect(() => {
                (async () => {
                        try {
                                const r = await getRoom(id);
                                setRoom(r);
                        } catch {
                                setMsg({ type: 'danger', text: 'Failed to load room.' });
                        }
                })();
        }, [id]);

        async function load() {
                setMsg({ type: '', text: '' });
                setSlots([]);
                setLoading(true);
                try {
                        const data = await getAvailability(id, { date, duration: Number(duration) });
                        setSlots(data.slots || []);
                        if (!data.slots?.length) setMsg({ type: 'warning', text: 'No free slots for that day with the selected duration.' });
                } catch (e) {
                        setMsg({ type: 'danger', text: e.message || 'Failed to load availability' });
                } finally {
                        setLoading(false);
                }
        }

        async function submitRequest() {
                if (!selectSlot) return;
                if (!reason || reason.trim().length < 5) {
                        setMsg({ type: 'warning', text: 'Please enter a brief reason (min 5 chars).' });
                        return;
                }
                try {
                        const token = getToken();
                        const res = await requestBooking(token, {
                                roomId: id,
                                startTs: selectSlot.startTs,
                                endTs: selectSlot.endTs,
                                reason
                        });
                        setMsg({ type: 'success', text: `Request sent (#${res.id}). Status: ${res.status}.` });
                        setReason('');
                        setSelectSlot(null);
                } catch (e) {
                        setMsg({ type: 'danger', text: e.message || 'Failed to send request' });
                }
        }

        return (
                <>
                        <h2 className="mb-3">
                                <i className="bi bi-calendar-week me-2 text-primary"></i>
                                Book: {room ? `${room.name} · ${room.building}` : 'Loading…'}
                        </h2>

                        {msg.text && (
                                <div className={`alert alert-${msg.type} d-flex align-items-center`}>
                                        <div>{msg.text}</div>
                                </div>
                        )}

                        <div className="row g-3">
                                <div className="col-12 col-lg-4">
                                        <div className="card shadow-sm">
                                                <div className="card-body">
                                                        <h5 className="card-title">Choose day & duration</h5>
                                                        <div className="mb-3">
                                                                <label className="form-label">Date</label>
                                                                <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
                                                        </div>
                                                        <div className="mb-3">
                                                                <label className="form-label">Duration (minutes)</label>
                                                                <select className="form-select" value={duration} onChange={e => setDuration(e.target.value)}>
                                                                        {[30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m}</option>)}
                                                                </select>
                                                        </div>
                                                        <button className="btn btn-primary w-100" onClick={load} disabled={loading}>
                                                                {loading && <span className="spinner-border spinner-border-sm me-2" />}Load availability
                                                        </button>
                                                </div>
                                        </div>
                                </div>

                                <div className="col-12 col-lg-8">
                                        <div className="card shadow-sm h-100">
                                                <div className="card-body">
                                                        <h5 className="card-title mb-3">Available slots</h5>

                                                        {!slots.length ? (
                                                                <div className="text-secondary">No slots yet. Pick a date and click “Load availability”.</div>
                                                        ) : (
                                                                <div className="row g-2">
                                                                        {slots.map((s, idx) => (
                                                                                <div className="col-12 col-md-6" key={idx}>
                                                                                        <div className={`border rounded-3 p-2 d-flex align-items-center justify-content-between ${selectSlot === s ? 'border-primary' : 'border-light'}`}>
                                                                                                <div>
                                                                                                        <div className="fw-semibold">{toLocal(s.startTs)}</div>
                                                                                                        <div className="text-secondary small">→ {toLocal(s.endTs)}</div>
                                                                                                </div>
                                                                                                <button className="btn btn-outline-primary btn-sm" onClick={() => setSelectSlot(s)}>
                                                                                                        Select
                                                                                                </button>
                                                                                        </div>
                                                                                </div>
                                                                        ))}
                                                                </div>
                                                        )}

                                                        <hr className="my-4" />

                                                        <h6 className="mb-2">Reason (required)</h6>
                                                        <textarea className="form-control mb-2" rows={3} value={reason}
                                                                placeholder="e.g., Group study for Algorithms exam"
                                                                onChange={e => setReason(e.target.value)} />
                                                        <div className="d-flex gap-2">
                                                                <button className="btn btn-success" disabled={!selectSlot} onClick={submitRequest}>
                                                                        <i className="bi bi-send me-1"></i> Send booking request
                                                                </button>
                                                                <button className="btn btn-outline-secondary" onClick={() => { setSelectSlot(null); setReason(''); }}>
                                                                        Clear
                                                                </button>
                                                        </div>

                                                </div>
                                        </div>
                                </div>
                        </div>
                </>
        );
}
