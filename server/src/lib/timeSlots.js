// server/src/lib/timeSlots.js
export function toWeekday(date) {
        // Mon..Sun -> 1..7 (adjust if your UI expects 1..6)
        const d = new Date(date);
        const js = d.getDay() || 7; // Sunday => 7
        return js; // adjust if your UI only uses 1..6
}

function hhmm(d) {
        const H = String(d.getHours()).padStart(2, '0');
        const M = String(d.getMinutes()).padStart(2, '0');
        return `${H}:${M}`;
}

export function slotKeys(startTs, endTs) {
        const s = new Date(startTs);
        const e = new Date(endTs);
        return { weekday: toWeekday(s), startHHMM: hhmm(s), endHHMM: hhmm(e) };
}
