// src/api.js
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/* ---------- helpers ---------- */
async function handle(res) {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || res.statusText);
        return data;
}
function auth(token) {
        return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/* ---------- auth ---------- */
export async function login(email, password) {
        const res = await fetch(`${BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
        });
        return handle(res); // { token, user }
}

export async function register(name, email, password) {
        const res = await fetch(`${BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        return data;
}

/* ---------- rooms (public) ---------- */
export async function getRooms(query = {}) {
        const qs = new URLSearchParams(query).toString();
        const res = await fetch(`${BASE}/rooms${qs ? `?${qs}` : ''}`);
        return handle(res);
}

export async function getRoom(id) {
        const res = await fetch(`${BASE}/rooms/${id}`);
        return handle(res);
}

export async function getAvailability(
        roomId,
        { date, duration = 60, step = 30, openStart = '08:00', openEnd = '22:00' }
) {
        const qs = new URLSearchParams({ date, duration, step, openStart, openEnd });
        const res = await fetch(`${BASE}/rooms/${roomId}/availability?${qs.toString()}`, { cache: 'no-store' });
        return handle(res);
}

/* ======================================================================
   BOOKINGS
   ====================================================================== */

/* ---------- student: create booking REQUEST (PENDING) ---------- */
// POST /bookings/booking-requests
export async function requestBooking(token, { roomId, startTs, endTs, reason, studentId, courseName, name }) {
        const res = await fetch(`${BASE}/bookings/booking-requests`, {
                method: 'POST',
                headers: auth(token),
                body: JSON.stringify({ roomId, startTs, endTs, reason, studentId, courseName, name })
        });
        return handle(res);
}

/* ---------- student: cancel booking ---------- */
// DELETE /bookings/:id (status=CANCELLED)
export async function cancelBooking(token, bookingId) {
        const res = await fetch(`${BASE}/bookings/${bookingId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 204) return true;
        return handle(res);
}

/* ---------- student: my bookings ---------- */
export async function getMyBookings(token) {
        const res = await fetch(`${BASE}/bookings/my/list`, {
                headers: { Authorization: `Bearer ${token}` }
        });
        return handle(res);
}

/* ---------- admin: immediate confirmed booking (optional) ---------- */
export async function createBooking(token, { roomId, startTs, endTs }) {
        const res = await fetch(`${BASE}/bookings`, {
                method: 'POST',
                headers: auth(token),
                body: JSON.stringify({ roomId, startTs, endTs })
        });
        return handle(res);
}

/* ---------- admin: list booking REQUESTS by status ---------- */
// GET /bookings/admin/booking-requests?status=PENDING|CONFIRMED|REJECTED
export async function listBookingRequests(token, status = 'PENDING') {
        const qs = new URLSearchParams({ status });
        const res = await fetch(`${BASE}/bookings/admin/booking-requests?${qs.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
        });
        return handle(res); // array
}

/* ---------- admin: decide booking request ---------- */
// NOTE: if your backend routes are /booking-requests/:id/approve (non-admin prefix),
// adjust these to match. The code below matches your earlier ADMIN endpoints.
export async function approveBookingRequest(token, id, note) {
        const res = await fetch(`${BASE}/bookings/admin/booking-requests/${id}/approve`, {
                method: 'POST',
                headers: auth(token),
                body: JSON.stringify(note ? { note } : {})
        });
        return handle(res);
}
export async function rejectBookingRequest(token, id, note) {
        const res = await fetch(`${BASE}/bookings/admin/booking-requests/${id}/reject`, {
                method: 'POST',
                headers: auth(token),
                body: JSON.stringify(note ? { note } : {})
        });
        return handle(res);
}

/* ======================================================================
   ROOM SCHEDULE / NOTES / CLOSURES (admin)
   ====================================================================== */
export async function setRoomOpenHours(token, roomId, hours /* [{weekday,startHHMM,endHHMM}] */) {
        const res = await fetch(`${BASE}/rooms/${roomId}/open-hours`, {
                method: 'PUT',
                headers: auth(token),
                body: JSON.stringify(hours)
        });
        if (!res.ok && res.status !== 204) return handle(res);
        return true;
}

// getRoomOpenHours: (token, roomId) OR (roomId)
export async function getRoomOpenHours(tokenOrRoomId, maybeRoomId) {
        const roomId = maybeRoomId || tokenOrRoomId;
        const headers = maybeRoomId ? { Authorization: `Bearer ${tokenOrRoomId}` } : undefined;
        const res = await fetch(`${BASE}/rooms/${roomId}/open-hours`, { headers, cache: 'no-store' });
        return handle(res);
}

export async function addRoomClosure(token, roomId, { startDate, endDate, reason }) {
        const res = await fetch(`${BASE}/rooms/${roomId}/closures`, {
                method: 'POST',
                headers: auth(token),
                body: JSON.stringify({ startDate, endDate, reason })
        });
        return handle(res);
}

export async function getRoomClosures(token, roomId, { from, to } = {}) {
        const qs = new URLSearchParams();
        if (from) qs.set('from', from);
        if (to) qs.set('to', to);
        const res = await fetch(`${BASE}/rooms/${roomId}/closures${qs.toString() ? `?${qs}` : ''}`, {
                headers: { Authorization: `Bearer ${token}` }
        });
        return handle(res);
}

/* ----- Slot notes (admin) ----- */
// POST add single
export async function addRoomSlotNote(token, roomId, { weekday, startHHMM, endHHMM, professor, course, reason }) {
        const res = await fetch(`${BASE}/rooms/${roomId}/slot-notes`, {
                method: 'POST',
                headers: auth(token),
                body: JSON.stringify({ weekday, startHHMM, endHHMM, professor, course, reason })
        });
        return handle(res); // { ok: true }
}

// GET all
export async function getRoomSlotNotes(token, roomId) {
        const res = await fetch(`${BASE}/rooms/${roomId}/slot-notes`, {
                headers: auth(token),
                cache: 'no-store'
        });
        return handle(res); // array
}

// IMPORTANT: PUT body is a RAW ARRAY ([]) — NOT { notes: [...] }
export async function setRoomSlotNotes(token, roomId, notesArray) {
        const res = await fetch(`${BASE}/rooms/${roomId}/slot-notes`, {
                method: 'PUT',
                headers: auth(token),
                body: JSON.stringify(notesArray),
        });
        if (res.status === 204) return true;
        return handle(res);
}

export async function clearRoomSlotNote(token, roomId, { weekday, startHHMM, endHHMM }) {
        const res = await fetch(`${BASE}/rooms/${roomId}/slot-notes`, {
                method: 'DELETE',
                headers: auth(token),
                body: JSON.stringify({ weekday, startHHMM, endHHMM }),
        });
        if (res.status === 204) return true;
        return handle(res);
}

/* ======================================================================
   BUILDINGS + FLOORS + ROOMS (scoped)
   ====================================================================== */
export async function listBuildings(token) {
        const res = await fetch(`${BASE}/buildings`, {
                headers: { Authorization: `Bearer ${token}` }
        });
        return handle(res);
}
export async function createBuilding(token, { name }) {
        const res = await fetch(`${BASE}/buildings`, {
                method: 'POST',
                headers: auth(token),
                body: JSON.stringify({ name })
        });
        return handle(res);
}
export async function updateBuilding(token, id, { name }) {
        const res = await fetch(`${BASE}/buildings/${id}`, {
                method: 'PUT',
                headers: auth(token),
                body: JSON.stringify({ name })
        });
        return handle(res);
}
export async function deleteBuilding(token, id) {
        const res = await fetch(`${BASE}/buildings/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 204) return true;
        return handle(res);
}

// FLOORS
export async function listFloors(token, buildingId) {
        const qs = buildingId ? `?buildingId=${encodeURIComponent(buildingId)}` : '';
        const res = await fetch(`${BASE}/floors${qs}`, {
                headers: { Authorization: `Bearer ${token}` }
        });
        return handle(res);
}
export async function createFloor(token, { buildingId, name }) {
        const res = await fetch(`${BASE}/floors`, {
                method: 'POST',
                headers: auth(token),
                body: JSON.stringify({ buildingId, name })
        });
        return handle(res);
}
export async function updateFloor(token, id, { name }) {
        const res = await fetch(`${BASE}/floors/${id}`, {
                method: 'PUT',
                headers: auth(token),
                body: JSON.stringify({ name })
        });
        return handle(res);
}
export async function deleteFloor(token, id) {
        const res = await fetch(`${BASE}/floors/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 204) return true;
        return handle(res);
}

// ROOMS (under a floor)
export async function getFloorRooms(token, floorId) {
        const res = await fetch(`${BASE}/floors/${floorId}`, {
                headers: { Authorization: `Bearer ${token}` }
        });
        return handle(res); // { floor, rooms: [...] }
}
export async function createRoomInFloor(token, floorId, { name, capacity, equipment }) {
        const res = await fetch(`${BASE}/floors/${floorId}/rooms`, {
                method: 'POST',
                headers: auth(token),
                body: JSON.stringify({ name, capacity, equipment })
        });
        return handle(res);
}
export async function updateRoom(token, roomId, data) {
        const res = await fetch(`${BASE}/floors/rooms/${roomId}`, {
                method: 'PUT',
                headers: auth(token),
                body: JSON.stringify(data)
        });
        return handle(res);
}
export async function deleteRoom(token, roomId) {
        const res = await fetch(`${BASE}/floors/rooms/${roomId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 204) return true;
        return handle(res);
}

/* ======================================================================
   Admin SSE (optional)
   ====================================================================== */
export function openAdminEvents(token) {
        const url = new URL(`${BASE}/events/admin`);
        url.searchParams.set('token', token);
        return new EventSource(url.toString(), { withCredentials: false });
}

/* ======================================================================
   Stats / History helpers (optional)
   ====================================================================== */
export async function getAdminStats(token, { tzOffsetMinutes } = {}) {
        const qs = new URLSearchParams();
        if (typeof tzOffsetMinutes === 'number') qs.set('tzOffsetMinutes', String(tzOffsetMinutes));
        const res = await fetch(`${BASE}/stats${qs.toString() ? `?${qs}` : ''}`, {
                headers: { Authorization: `Bearer ${token}` }
        });
        return handle(res);
}

// Charts
// existing
export async function getStatsSeries(token, opts = {}) {
        const qs = new URLSearchParams();
        if (opts.days) qs.set('days', String(opts.days));
        if (typeof opts.tzOffsetMinutes === 'number') qs.set('tzOffsetMinutes', String(opts.tzOffsetMinutes));
        if (opts.month) qs.set('month', '1');
        const res = await fetch(`${BASE}/stats/series?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
        return handle(res);
}


export async function getRoomUtilization(token, { days = 30 } = {}) {
        const qs = new URLSearchParams({ days: String(days) });
        const res = await fetch(`${BASE}/stats/room-utilization?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
        return handle(res); // [{roomId,roomName,hours}]
}
export async function getBuildingShare(token, { days = 30 } = {}) {
        const qs = new URLSearchParams({ days: String(days) });
        const res = await fetch(`${BASE}/stats/building-share?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
        return handle(res); // [{buildingId,buildingName,count}]
}


export async function getBookingHistory(
        token,
        { statuses = [], page = 1, pageSize = 20, q = '', sort = 'createdAt', order = 'desc' } = {}
) {
        const qs = new URLSearchParams();
        if (statuses.length) qs.set('status', statuses.join(','));
        if (page) qs.set('page', String(page));
        if (pageSize) qs.set('pageSize', String(pageSize));
        if (q) qs.set('q', q);
        if (sort) qs.set('sort', sort);
        if (order) qs.set('order', order);
        const res = await fetch(`${BASE}/history${qs.toString() ? `?${qs}` : ''}`, {
                headers: { Authorization: `Bearer ${token}` }
        });
        return handle(res);
}

/* ---- tiny URL builder that won't throw ---- */
export function buildApiUrl(path, qsObj) {
        const p = path.startsWith('/') ? path : `/${path}`;
        const raw = (import.meta?.env?.VITE_API_BASE_URL ?? '').toString().trim();

        let base = '';
        if (!raw) {
                base = ''; // same origin
        } else if (/^https?:\/\//i.test(raw)) {
                base = raw.replace(/\/+$/, '');
        } else if (raw.startsWith('/')) {
                base = raw.replace(/\/+$/, '');
        } else {
                base = `http://${raw.replace(/\/+$/, '')}`;
        }

        let url = `${base}${p}`;

        if (qsObj && typeof qsObj === 'object') {
                const qs = new URLSearchParams();
                for (const [k, v] of Object.entries(qsObj)) {
                        if (v === undefined || v === null || v === '') continue;
                        if (Array.isArray(v) && v.length === 0) continue;
                        qs.set(k, Array.isArray(v) ? v.join(',') : String(v));
                }
                const s = qs.toString();
                if (s) url += `?${s}`;
        }
        return url;
}
