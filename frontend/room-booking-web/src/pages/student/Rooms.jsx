// frontend/src/pages/Rooms.jsx
import { useEffect, useMemo, useState } from 'react';
import {
        listBuildings,
        listFloors,
        getFloorRooms,
        getAvailability,
        requestBooking,
        getRoomOpenHours,
        getRoomSlotNotes,
} from '../../api';

const BRAND = '#272446';  // admin green
const IN_USE = '#bd1e30'; // admin red

// Fixed time slots (same as admin)
const TIME_SLOTS = [
        { key: 's7_9', label: '7–9', startHHMM: '07:00', endHHMM: '09:00' },
        { key: 's9_11', label: '9–11', startHHMM: '09:00', endHHMM: '11:00' },
        { key: 's13_15', label: '1–3', startHHMM: '13:00', endHHMM: '15:00' },
        { key: 's15_17', label: '3–5', startHHMM: '15:00', endHHMM: '17:00' },
];

const WEEKDAYS = [
        { val: 1, label: 'Monday' },
        { val: 2, label: 'Tuesday' },
        { val: 3, label: 'Wednesday' },
        { val: 4, label: 'Thursday' },
        { val: 5, label: 'Friday' },
        { val: 6, label: 'Saturday' },
];

// Helpers
function hhmmToDate(baseISODate, hhmm) {
        const [h, m] = hhmm.split(':').map(Number);
        const d = new Date(baseISODate + 'T00:00:00.000Z');
        d.setUTCHours(h, m, 0, 0);
        return d.toISOString();
}
function nextDateForWeekday(weekday /*1..6*/) {
        const now = new Date();
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const jsDay = today.getUTCDay(); // 0..6
        const targetJs = weekday % 7;    // 1..6 (we don't use Sunday)
        let ahead = targetJs - jsDay;
        if (ahead < 0) ahead += 7;
        const target = new Date(today.getTime() + ahead * 24 * 60 * 60 * 1000);
        const yyyy = target.getUTCFullYear();
        const mm = String(target.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(target.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
}

// Derive schedule-open slots exactly like admin:
function computeOpenSetForWeekday(rows, weekday) {
        const dayRows = (rows || []).filter(h => h.weekday === weekday);
        const hasSentinel = dayRows.some(h => h.startHHMM === '00:00' && h.endHHMM === '00:01');
        if (hasSentinel) return new Set(); // explicit closed

        if (dayRows.length === 0) {
                // default mode => everything open
                return new Set(TIME_SLOTS.map(s => `${s.startHHMM}-${s.endHHMM}`));
        }

        // explicit rows => only listed ranges
        return new Set(dayRows.map(h => `${h.startHHMM}-${h.endHHMM}`));
}

export default function RoomsStudent() {
        const token = localStorage.getItem('token') || '';

        // Filters
        const [weekday, setWeekday] = useState(1); // Mon
        const [buildings, setBuildings] = useState([]);
        const [selBuildingId, setSelBuildingId] = useState('');
        const [floors, setFloors] = useState([]);
        const [selFloorId, setSelFloorId] = useState('');

        // Data
        const [rooms, setRooms] = useState([]);

        const [statusMap, setStatusMap] = useState({});

        // Mirrors admin data sources
        // hoursMap: { [roomId]: Array<{weekday,startHHMM,endHHMM}> }
        const [hoursMap, setHoursMap] = useState({});
        // notesMap: { [roomId]: { [weekday]: { [slotKey]: { professor, course } } } }
        const [notesMap, setNotesMap] = useState({});

        const [loading, setLoading] = useState(true);
        const [err, setErr] = useState('');

        // Booking modal
        const [booking, setBooking] = useState(null);
        // booking = { roomId, roomName, dateISO, startTs, endTs, name, reason }

        const buildingName = useMemo(
                () => buildings.find(b => b.id === selBuildingId)?.name || '',
                [buildings, selBuildingId]
        );
        const floorName = useMemo(
                () => floors.find(f => f.id === selFloorId)?.name || '',
                [floors, selFloorId]
        );

        // Load buildings
        useEffect(() => {
                (async () => {
                        try {
                                setErr('');
                                setLoading(true);
                                const b = await listBuildings(token);
                                const list = Array.isArray(b) ? b : [];
                                setBuildings(list);
                                if (list.length) setSelBuildingId(list[0].id);
                        } catch (e) {
                                setErr(e.message || 'Failed to load buildings');
                        } finally {
                                setLoading(false);
                        }
                })();
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // Load floors for building
        useEffect(() => {
                (async () => {
                        if (!selBuildingId) { setFloors([]); setSelFloorId(''); setRooms([]); return; }
                        try {
                                setErr(''); setLoading(true);
                                const fs = await listFloors(token, selBuildingId);
                                const fl = Array.isArray(fs) ? fs : [];
                                setFloors(fl);
                                setSelFloorId(fl[0]?.id || '');
                        } catch (e) {
                                setErr(e.message || 'Failed to load floors');
                        } finally {
                                setLoading(false);
                        }
                })();
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [selBuildingId]);

        // Load rooms + admin data for floor
        useEffect(() => {
                (async () => {
                        if (!selFloorId) {
                                setRooms([]);
                                setStatusMap({});
                                setHoursMap({});
                                setNotesMap({});
                                return;
                        }
                        try {
                                setErr('');
                                setLoading(true);

                                const { rooms } = await getFloorRooms(token, selFloorId);
                                const list = Array.isArray(rooms) ? rooms : [];
                                setRooms(list);

                                // Weekly open hours per room
                                const hourEntries = await Promise.all(
                                        list.map(async (r) => {
                                                const hrs = await getRoomOpenHours(token, r.id).catch(() => []);
                                                return [r.id, Array.isArray(hrs) ? hrs : []];
                                        })
                                );
                                setHoursMap(Object.fromEntries(hourEntries));

                                // Slot notes per room
                                const noteEntries = await Promise.all(
                                        list.map(async (r) => {
                                                const ns = await getRoomSlotNotes(token, r.id).catch(() => []);
                                                return [r.id, Array.isArray(ns) ? ns : []];
                                        })
                                );
                                const nMap = {};
                                for (const [rid, arr] of noteEntries) {
                                        for (const n of arr) {
                                                const slot = TIME_SLOTS.find(s => s.startHHMM === n.startHHMM && s.endHHMM === n.endHHMM);
                                                if (!slot) continue;
                                                nMap[rid] = nMap[rid] || {};
                                                nMap[rid][n.weekday] = nMap[rid][n.weekday] || {};
                                                nMap[rid][n.weekday][slot.key] = {
                                                        professor: n.professor || '',
                                                        course: n.course || '',
                                                        reason: n.reason || '',
                                                };
                                        }
                                }
                                setNotesMap(nMap);


                        } catch (e) {
                                setErr(e.message || 'Failed to load rooms');
                        } finally {
                                setLoading(false);
                        }
                })();
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [selFloorId]);

        // Compute student-facing status from (default/explicit schedule + sentinel + notes + bookings)
        useEffect(() => {
                if (!rooms.length) { setStatusMap({}); return; }

                (async () => {
                        const dateStr = nextDateForWeekday(weekday);
                        const params = { date: dateStr, duration: 120, step: 120, openStart: '07:00', openEnd: '17:00' };

                        const entries = await Promise.all(
                                rooms.map(async (r) => {
                                        const hrs = hoursMap[r.id] || [];

                                        // Open set derived exactly like admin (handles default, explicit, sentinel)
                                        const openSet = computeOpenSetForWeekday(hrs, weekday);

                                        // Start from schedule: open => tentatively available; closed => in use
                                        const combined = {};
                                        TIME_SLOTS.forEach(s => {
                                                const isOpenBySchedule = openSet.has(`${s.startHHMM}-${s.endHHMM}`);
                                                combined[s.key] = { available: isOpenBySchedule };
                                        });

                                        // Apply admin notes: always in use w/ text
                                        const dayNotes = notesMap[r.id]?.[weekday] || {};
                                        Object.entries(dayNotes).forEach(([slotKey, info]) => {
                                                combined[slotKey] = { available: false, note: info };
                                        });

                                        // Apply bookings: if booked, mark unavailable (but keep note if already set)
                                        try {
                                                const av = await getAvailability(r.id, params);
                                                const starts = new Set(av.slots.map(s => s.startTs));
                                                TIME_SLOTS.forEach(s => {
                                                        if (combined[s.key].available) {
                                                                const startTs = hhmmToDate(dateStr, s.startHHMM);
                                                                combined[s.key].available = starts.has(startTs);
                                                        }
                                                });
                                        } catch {
                                                // leave as schedule+notes
                                        }

                                        return [r.id, combined];
                                })
                        );

                        setStatusMap(Object.fromEntries(entries));
                })();
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [rooms, weekday, hoursMap, notesMap]);

        // Auto-refresh (1s): pull latest hours/notes and recompute status + availability
        useEffect(() => {
                if (!selFloorId || rooms.length === 0) return;

                let alive = true;

                const refresh = async () => {
                        try {
                                // refresh weekly open hours for each room
                                const hourEntries = await Promise.all(
                                        rooms.map(async (r) => {
                                                const hrs = await getRoomOpenHours(token, r.id).catch(() => []);
                                                return [r.id, Array.isArray(hrs) ? hrs : []];
                                        })
                                );
                                if (!alive) return;
                                setHoursMap(Object.fromEntries(hourEntries));

                                // refresh slot notes for each room
                                const noteEntries = await Promise.all(
                                        rooms.map(async (r) => {
                                                const ns = await getRoomSlotNotes(token, r.id).catch(() => []);
                                                return [r.id, Array.isArray(ns) ? ns : []];
                                        })
                                );
                                if (!alive) return;

                                const nMap = {};
                                for (const [rid, arr] of noteEntries) {
                                        for (const n of arr) {
                                                const slot = TIME_SLOTS.find(s => s.startHHMM === n.startHHMM && s.endHHMM === n.endHHMM);
                                                if (!slot) continue;
                                                nMap[rid] = nMap[rid] || {};
                                                nMap[rid][n.weekday] = nMap[rid][n.weekday] || {};
                                                nMap[rid][n.weekday][slot.key] = { professor: n.professor || '', course: n.course || '' };
                                        }
                                }
                                setNotesMap(nMap);

                                // statusMap will recompute via the existing effect that depends on hoursMap/notesMap/weekday/rooms
                        } catch {
                                // ignore transient errors
                        }
                };

                refresh(); // immediate
                const id = setInterval(refresh, 5000);
                return () => { alive = false; clearInterval(id); };
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [selFloorId, rooms, token]);


        // Booking
        function handleClickSlot(room, slotKey) {
                const dateStr = nextDateForWeekday(weekday);
                const slot = TIME_SLOTS.find(s => s.key === slotKey);
                if (!slot) return;

                const startTs = hhmmToDate(dateStr, slot.startHHMM);
                const endTs = hhmmToDate(dateStr, slot.endHHMM);

                setBooking({
                        roomId: room.id,
                        roomName: room.name,
                        dateISO: dateStr,
                        startTs,
                        endTs,
                        studentId: '',
                        name: '',
                        reason: '',
                        courseName: '',
                });
        }

        async function submitBooking() {
                if (!booking) return;
                try {
                        if (!token) {
                                alert('Please sign in to request a booking.');
                                return;
                        }
                        if (!booking.studentId?.trim()) {
                                alert('Please enter your Student ID.');
                                return;
                        }

                        const { roomId, startTs, endTs, studentId, name, reason, courseName } = booking;

                        // Send separate fields (cleaner for admin UI / backend)
                        await requestBooking(token, {
                                roomId,
                                startTs,
                                endTs,
                                studentId: studentId?.trim(),
                                name: name?.trim() || undefined,
                                reason: reason?.trim() || undefined,
                                courseName: courseName?.trim() || undefined,
                        });

                        setBooking(null);
                        alert('Booking request sent!');
                } catch (e) {
                        alert(e.message || 'Failed to submit booking request');
                }
        }


        // UI helpers
        const lineEllipsis = {
                display: 'block',
                width: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
        };
        const SLOT_BTN_HEIGHT = 40;
        const SLOT_TEXT_PX = 10;
        const SLOT_LINE_HEIGHT = 1.15;

        // Detect monitor from equipment JSON (true if equipment.monitor OR equipment.tv)
        function hasMonitor(equipment) {
                if (!equipment) return false;
                let eq = equipment;
                if (typeof eq === 'string') {
                        try { eq = JSON.parse(eq); } catch { /* ignore */ }
                }
                if (!eq || typeof eq !== 'object') return false;
                return !!(eq.monitor || eq.tv);
        }

        return (
                <>
                        <div className="d-flex flex-wrap gap-3 align-items-end justify-content-center mb-3">
                                <div style={{ minWidth: "240px" }}>
                                        <label className="form-label mb-1">Building</label>
                                        <select
                                                className="form-select"
                                                style={{ width: "100%" }}
                                                value={selBuildingId}
                                                onChange={(e) => setSelBuildingId(e.target.value)}
                                        >
                                                {buildings.length === 0 ? (
                                                        <option value="">No buildings</option>
                                                ) : (
                                                        buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)
                                                )}
                                        </select>
                                </div>
                                <div style={{ minWidth: "240px" }}>
                                        <label className="form-label mb-1">Floor</label>
                                        <select
                                                className="form-select"
                                                style={{ width: "100%" }}
                                                value={selFloorId}
                                                onChange={(e) => setSelFloorId(e.target.value)}
                                                disabled={!floors.length}
                                        >
                                                {floors.length === 0 ? (
                                                        <option value="">No floors</option>
                                                ) : (
                                                        floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)
                                                )}
                                        </select>
                                </div>
                                <div style={{ minWidth: "240px" }}>
                                        <label className="form-label mb-1">Weekday</label>
                                        <select
                                                className="form-select"
                                                style={{ width: "100%" }}
                                                value={weekday}
                                                onChange={(e) => setWeekday(Number(e.target.value))}
                                        >
                                                {WEEKDAYS.map(d => <option key={d.val} value={d.val}>{d.label}</option>)}
                                        </select>
                                </div>
                        </div>


                        {err && <div className="alert alert-danger">{err}</div>}

                        {rooms.length === 0 ? (
                                <div className="alert alert-secondary">No rooms found.</div>
                        ) : (
                                <div className="card border-0 shadow-sm">
                                        <div className="card-body">
                                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                                                        <div>
                                                                <h2 className="h6 mb-0">{floorName || 'Select a floor'}</h2>
                                                                <div className="text-secondary small">{buildingName}</div>
                                                        </div>
                                                        <div className="text-secondary small">Day: {WEEKDAYS.find(d => d.val === weekday)?.label}</div>
                                                </div>

                                                <div className="table-responsive">
                                                        <table className="table table-striped table-hover align-middle" style={{ tableLayout: 'fixed', width: '100%' }}>
                                                                <thead>
                                                                        <tr>
                                                                                <th style={{ width: 200 }}>Room</th>
                                                                                {TIME_SLOTS.map(s => <th key={s.key} className="text-center">{s.label}</th>)}
                                                                                <th />
                                                                        </tr>
                                                                </thead>
                                                                <tbody>
                                                                        {rooms.map(r => {
                                                                                const slots = statusMap[r.id] || {};
                                                                                const monitor = hasMonitor(r.equipment);

                                                                                return (
                                                                                        <tr key={r.id}>
                                                                                                <td style={{ padding: '6px' }}>
                                                                                                        <div className="fw-semibold">{r.name}</div>
                                                                                                        <div className="text-secondary small">cap {r.capacity}</div>
                                                                                                        {monitor && <span className="badge text-bg-light mt-1">Monitor</span>}
                                                                                                </td>

                                                                                                {TIME_SLOTS.map(s => {
                                                                                                        const cell = slots[s.key] || { available: false };
                                                                                                        const available = !!cell.available;
                                                                                                        const note = cell.note; // { professor, course } if present
                                                                                                        const title = available
                                                                                                                ? 'Available (click to book)'
                                                                                                                : note
                                                                                                                        ? `${note.professor || 'In use'}${note.course ? '\n' + note.course : ''}${note.reason ? '\n' + note.reason : ''}`
                                                                                                                        : 'In use';

                                                                                                        return (
                                                                                                                <td key={s.key} className="text-center" style={{ padding: '6px' }}>
                                                                                                                        <button
                                                                                                                                type="button"
                                                                                                                                className="btn btn-sm text-white"
                                                                                                                                disabled={!available}
                                                                                                                                onClick={() => available && handleClickSlot(r, s.key)}
                                                                                                                                title={title}
                                                                                                                                style={{
                                                                                                                                        width: '100%',
                                                                                                                                        height: SLOT_BTN_HEIGHT,
                                                                                                                                        backgroundColor: available ? BRAND : IN_USE,
                                                                                                                                        borderColor: available ? BRAND : IN_USE,
                                                                                                                                        display: 'flex',
                                                                                                                                        flexDirection: 'column',
                                                                                                                                        alignItems: 'center',
                                                                                                                                        justifyContent: 'center',
                                                                                                                                        paddingTop: 3,
                                                                                                                                        paddingBottom: 3,
                                                                                                                                        textAlign: 'center',
                                                                                                                                        overflow: 'hidden',
                                                                                                                                }}
                                                                                                                        >
                                                                                                                                {available ? (
                                                                                                                                        <span
                                                                                                                                                style={{
                                                                                                                                                        ...lineEllipsis,
                                                                                                                                                        fontWeight: 600,
                                                                                                                                                        lineHeight: SLOT_LINE_HEIGHT,
                                                                                                                                                        width: '100%',
                                                                                                                                                }}
                                                                                                                                        >
                                                                                                                                                {s.label}
                                                                                                                                        </span>
                                                                                                                                ) : (
                                                                                                                                        <span className="d-block w-100">
                                                                                                                                                <span
                                                                                                                                                        style={{
                                                                                                                                                                ...lineEllipsis,
                                                                                                                                                                fontSize: SLOT_TEXT_PX,
                                                                                                                                                                lineHeight: SLOT_LINE_HEIGHT,
                                                                                                                                                                fontWeight: 600,
                                                                                                                                                                textAlign: 'center',
                                                                                                                                                        }}
                                                                                                                                                >
                                                                                                                                                        {note?.professor?.trim() || 'In use'}
                                                                                                                                                </span>
                                                                                                                                                <span
                                                                                                                                                        style={{
                                                                                                                                                                ...lineEllipsis,
                                                                                                                                                                fontSize: SLOT_TEXT_PX,
                                                                                                                                                                lineHeight: SLOT_LINE_HEIGHT,
                                                                                                                                                                textAlign: 'center',
                                                                                                                                                        }}
                                                                                                                                                >
                                                                                                                                                        {note?.course?.trim() || ''}
                                                                                                                                                </span>
                                                                                                                                                {note?.reason?.trim() && (
                                                                                                                                                        <span
                                                                                                                                                                style={{
                                                                                                                                                                        ...lineEllipsis,
                                                                                                                                                                        fontSize: SLOT_TEXT_PX,
                                                                                                                                                                        lineHeight: SLOT_LINE_HEIGHT,
                                                                                                                                                                        textAlign: 'center',
                                                                                                                                                                }}
                                                                                                                                                        >
                                                                                                                                                                {note.reason.trim()}
                                                                                                                                                        </span>
                                                                                                                                                )}
                                                                                                                                        </span>

                                                                                                                                )}
                                                                                                                        </button>
                                                                                                                </td>
                                                                                                        );
                                                                                                })}

                                                                                                <td />
                                                                                        </tr>
                                                                                );
                                                                        })}
                                                                </tbody>
                                                        </table>
                                                </div>

                                        </div>
                                </div>
                        )}

                        {/* Booking Modal */}
                        {booking && (
                                <div
                                        className="position-fixed top-0 start-0 w-100 h-100"
                                        style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
                                        onClick={(e) => { if (e.target === e.currentTarget) setBooking(null); }}
                                >
                                        <div className="position-absolute top-50 start-50 translate-middle card shadow" style={{ width: 460, maxWidth: '92vw' }}>
                                                <div className="card-body">
                                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                                                <div className="fw-semibold">Book this room?</div>
                                                                <button className="btn btn-sm btn-light" onClick={() => setBooking(null)}>✕</button>
                                                        </div>
                                                        <div className="small text-secondary mb-3">
                                                                {booking.roomName} · {booking.dateISO}
                                                        </div>

                                                        <div className="mb-2">
                                                                <label className="form-label small mb-1">Your name</label>
                                                                <input
                                                                        className="form-control form-control-sm"
                                                                        value={booking.name}
                                                                        onChange={(e) => setBooking(b => ({ ...b, name: e.target.value }))}
                                                                        placeholder="e.g., Phally Makara"
                                                                />
                                                        </div>
                                                        <div className="mb-2">
                                                                <label className="form-label small mb-1">Student ID</label>
                                                                <input
                                                                        className="form-control form-control-sm"
                                                                        value={booking.studentId}
                                                                        onChange={(e) => setBooking(b => ({ ...b, studentId: e.target.value }))}
                                                                        placeholder="e.g., e2021...."
                                                                />
                                                        </div>
                                                        +<div className="mb-2">
                                                                <label className="form-label small mb-1">Course name</label>
                                                                <input
                                                                        className="form-control form-control-sm"
                                                                        value={booking.courseName}
                                                                        onChange={(e) => setBooking(b => ({ ...b, courseName: e.target.value }))}
                                                                        placeholder="e.g., Data Structures"
                                                                />
                                                        </div>
                                                        <div className="mb-3">
                                                                <label className="form-label small mb-1">Reason</label>
                                                                <input
                                                                        className="form-control form-control-sm"
                                                                        value={booking.reason}
                                                                        onChange={(e) => setBooking(b => ({ ...b, reason: e.target.value }))}
                                                                        placeholder="e.g., Study group / Project meeting"
                                                                />
                                                        </div>
                                                        <div className="d-flex justify-content-end gap-2">
                                                                <button className="btn btn-sm btn-light" onClick={() => setBooking(null)}>Cancel</button>
                                                                <button className="btn btn-sm btn-primary" onClick={submitBooking} >
                                                                        Confirm booking request
                                                                </button>
                                                        </div>

                                                </div>
                                        </div>
                                </div>
                        )}
                </>
        );
}
