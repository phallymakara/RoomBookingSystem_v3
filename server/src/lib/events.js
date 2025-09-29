// server/src/lib/events.js
import { EventEmitter } from 'events';

export const bus = new EventEmitter();
// keep listeners alive
bus.setMaxListeners(100);

// Helper: broadcast to all admin listeners
export function emitAdmin(evt) {
        // evt: { type: 'BOOKING_REQUEST_CREATED'|'BOOKING_REQUEST_DECIDED', payload: {...} }
        bus.emit('admin', JSON.stringify({ ...evt, ts: Date.now() }));
}
