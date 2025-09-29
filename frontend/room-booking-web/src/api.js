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
        const res = await fetch(`${BASE}/rooms/${roomId}/availability?${qs.toString()}`);
        return handle(res);
}

/* ======================================================================
   BOOKINGS
   ====================================================================== */

/* ---------- student: create booking REQUEST (PENDING) ---------- */
/* backend route from your routes file: POST /bookings/booking-requests */
export async function requestBooking(token, { roomId, startTs, endTs, reason, studentId, courseName }) {
        const res = await fetch(`${BASE}/bookings/booking-requests`, {
                method: 'POST',
                headers: auth(token),
                body: JSON.stringify({ roomId, startTs, endTs, reason, studentId, courseName })
        });
        return handle(res);
}

/* ---------- student: cancel booking ---------- */
/* your backend uses DELETE /bookings/:id (sets status=CANCELLED) */
export async function cancelBooking(token, bookingId /*, reason (ignored by backend) */) {
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
/* GET /bookings/admin/booking-requests?status=PENDING|CONFIRMED|REJECTED */
export async function listBookingRequests(token, status = 'PENDING') {
        const qs = new URLSearchParams({ status });
        const res = await fetch(`${BASE}/bookings/admin/booking-requests?${qs.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
        });
        return handle(res); // array
}

/* ---------- admin: decide booking request ---------- */
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
        const res = await fetch(`${BASE}/rooms/${roomId}/open-hours`, { headers });
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

// Slot notes
export async function getRoomSlotNotes(token, roomId) {
        const res = await fetch(`${BASE}/rooms/${roomId}/slot-notes`, { headers: auth(token) });
        return handle(res); // returns []
}

export async function setRoomSlotNotes(token, roomId, notesArray) {
        const res = await fetch(`${BASE}/rooms/${roomId}/slot-notes`, {
                method: 'PUT',
                headers: auth(token),
                body: JSON.stringify(notesArray),  // IMPORTANT: raw array, not {notes: ...}
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


// Student Booking Request
export function openAdminEvents(token) {
        // Attach token via query (SSE doesn't let us set headers in EventSource).
        const url = new URL(`${BASE}/events/admin`);
        url.searchParams.set('token', token);
        // If your authGuard reads from Authorization header only, adjust the backend
        // to also accept ?token=... (quick tweak in authGuard), or switch to a cookie.
        return new EventSource(url.toString(), { withCredentials: false });
}