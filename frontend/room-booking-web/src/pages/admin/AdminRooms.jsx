// frontend/src/pages/admin/AdminRooms.jsx

import { useEffect, useMemo, useState } from 'react';
import {
        listBuildings,
        listFloors,
        getFloorRooms,
        getRoomOpenHours,
        setRoomOpenHours,
        getRoomSlotNotes,
        setRoomSlotNotes,
} from '../../api';

const BRAND = '#272446';
const IN_USE = '#bd1e30';

// Fixed time slots
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
        { val: 4, label: 'Thurday' },
        { val: 5, label: 'Friday' },
        { val: 6, label: 'Saturday' },
];

// ===== Sizing & typography for slot buttons =====
const SLOT_BTN_HEIGHT = 40;
const SLOT_TEXT_PX = 10;
const SLOT_LINE_HEIGHT = 1.15;

export default function AdminRooms() {
        const token = localStorage.getItem('token') || '';

        // Selections
        const [buildings, setBuildings] = useState([]);
        const [selBuildingId, setSelBuildingId] = useState('');
        const [floors, setFloors] = useState([]);
        const [selFloorId, setSelFloorId] = useState('');
        const [rooms, setRooms] = useState([]);

        // Weekday
        const [weekday, setWeekday] = useState(1); // Mon

        // UI
        const [loading, setLoading] = useState(true);
        const [err, setErr] = useState('');
        const [savingRowId, setSavingRowId] = useState(null);
        const [savedRowId, setSavedRowId] = useState(null);

        // ===== State for hours =====
        // { [roomId]: Array<{weekday,startHHMM,endHHMM}> }
        const [explicitHours, setExplicitHours] = useState({});
        // { [roomId]: { [weekday]: 'default' | 'explicit' } }
        const [dayMode, setDayMode] = useState({});
        // { [roomId]: { [weekday]: Set<slotKey> } }
        const [closedSlots, setClosedSlots] = useState({});

        // In-use info: { [roomId]: { [weekday]: { [slotKey]: { professor, course } } } }
        const [inUseText, setInUseText] = useState({});

        // Inline editor state
        const [editing, setEditing] = useState(null);

        // Confirm cancel modal
        const [confirmCancel, setConfirmCancel] = useState(null);

        // Load buildings
        useEffect(() => {
                (async () => {
                        try {
                                setErr('');
                                const b = await listBuildings(token);
                                const list = Array.isArray(b) ? b : [];
                                setBuildings(list);
                                if (list.length) setSelBuildingId(list[0].id);
                        } catch (e) {
                                setErr(e.message || 'Failed to load buildings');
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

        // Load rooms & hours for floor
        useEffect(() => {
                (async () => {
                        if (!selFloorId) {
                                setRooms([]);
                                setExplicitHours({});
                                setDayMode({});
                                setClosedSlots({});
                                setInUseText({});
                                setEditing(null);
                                return;
                        }
                        try {
                                setErr(''); setLoading(true);
                                const { rooms } = await getFloorRooms(token, selFloorId);
                                const list = Array.isArray(rooms) ? rooms : [];
                                setRooms(list);

                                // OPEN HOURS
                                const hourEntries = await Promise.all(
                                        list.map(async (r) => {
                                                const hrs = await getRoomOpenHours(token, r.id).catch(() => []);
                                                return [r.id, Array.isArray(hrs) ? hrs : []];
                                        })
                                );
                                setExplicitHours(Object.fromEntries(hourEntries));

                                // SLOT NOTES
                                const noteEntries = await Promise.all(
                                        list.map(async (r) => {
                                                const ns = await getRoomSlotNotes(token, r.id).catch(() => []);
                                                return [r.id, Array.isArray(ns) ? ns : []];
                                        })
                                );

                                // Convert notes → inUseText shape
                                const notesMap = {};
                                for (const [rId, arr] of noteEntries) {
                                        for (const n of arr) {
                                                const slot = TIME_SLOTS.find(
                                                        s => s.startHHMM === n.startHHMM && s.endHHMM === n.endHHMM
                                                );
                                                if (!slot) continue;
                                                notesMap[rId] = notesMap[rId] || {};
                                                notesMap[rId][n.weekday] = notesMap[rId][n.weekday] || {};
                                                notesMap[rId][n.weekday][slot.key] = {
                                                        professor: n.professor || '',
                                                        course: n.course || ''
                                                };
                                        }
                                }
                                setInUseText(notesMap);

                                // Day mode per room/day
                                const nextMode = {};
                                for (const [rid, hrs] of hourEntries) {
                                        nextMode[rid] = nextMode[rid] || {};
                                        for (let d = 1; d <= 6; d++) {
                                                nextMode[rid][d] = hrs.some(h => h.weekday === d) ? 'explicit' : 'default';
                                        }
                                }
                                setDayMode(nextMode);

                                // Reset transient toggles
                                setClosedSlots({});
                                setEditing(null);
                        } catch (e) {
                                setErr(e.message || 'Failed to load rooms');
                        } finally {
                                setLoading(false);
                        }
                })();
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [selFloorId]);

        // Auto-refresh hours & notes every 1s so admin & student stay in sync
        useEffect(() => {
                if (!selFloorId || rooms.length === 0) return;

                let alive = true;
                const tick = async () => {
                        try {
                                // refresh open hours
                                const hourEntries = await Promise.all(
                                        rooms.map(async (r) => {
                                                const hrs = await getRoomOpenHours(token, r.id).catch(() => []);
                                                return [r.id, Array.isArray(hrs) ? hrs : []];
                                        })
                                );
                                if (!alive) return;

                                setExplicitHours(prev => {
                                        const next = Object.fromEntries(hourEntries);
                                        return next;
                                });

                                // recompute dayMode based on fresh hours
                                setDayMode(prev => {
                                        const nm = { ...prev };
                                        for (const [rid, hrs] of hourEntries) {
                                                nm[rid] = nm[rid] || {};
                                                for (let d = 1; d <= 6; d++) {
                                                        nm[rid][d] = hrs.some(h => h.weekday === d) ? 'explicit' : 'default';
                                                }
                                        }
                                        return nm;
                                });

                                // refresh notes
                                const noteEntries = await Promise.all(
                                        rooms.map(async (r) => {
                                                const ns = await getRoomSlotNotes(token, r.id).catch(() => []);
                                                return [r.id, Array.isArray(ns) ? ns : []];
                                        })
                                );
                                if (!alive) return;

                                // Convert to inUseText shape
                                const notesMap = {};
                                for (const [rId, arr] of noteEntries) {
                                        for (const n of arr) {
                                                const slot = TIME_SLOTS.find(
                                                        s => s.startHHMM === n.startHHMM && s.endHHMM === n.endHHMM
                                                );
                                                if (!slot) continue;
                                                notesMap[rId] = notesMap[rId] || {};
                                                notesMap[rId][n.weekday] = notesMap[rId][n.weekday] || {};
                                                notesMap[rId][n.weekday][slot.key] = {
                                                        professor: n.professor || '',
                                                        course: n.course || ''
                                                };
                                        }
                                }
                                setInUseText(notesMap);

                                // do NOT touch closedSlots or editing here (those are local/transient)
                        } catch {
                                // swallow; keep UI steady if a tick fails
                        }
                };

                // first tick quickly, then every 1s
                tick();
                const id = setInterval(tick, 5000);
                return () => { alive = false; clearInterval(id); };
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [selFloorId, rooms, token]);


        const buildingName = useMemo(
                () => buildings.find(b => b.id === selBuildingId)?.name || '',
                [buildings, selBuildingId]
        );
        const floorName = useMemo(
                () => floors.find(f => f.id === selFloorId)?.name || '',
                [floors, selFloorId]
        );

        // ===== helpers =====
        const isExplicit = (roomId, wday) => dayMode[roomId]?.[wday] === 'explicit';

        function hasSlot(roomId, wday, slot) {
                if (isExplicit(roomId, wday)) {
                        const hrs = explicitHours[roomId] || [];
                        return hrs.some(
                                h => h.weekday === wday && h.startHHMM === slot.startHHMM && h.endHHMM === slot.endHHMM
                        );
                }
                // default mode = green unless explicitly closed
                const slotSet = closedSlots[roomId]?.[wday];
                return !(slotSet && slotSet.has(slot.key));
        }

        function setSlotInfo(roomId, wday, slotKey, value /* {professor, course} | null */) {
                setInUseText(prev => {
                        const room = { ...(prev[roomId] || {}) };
                        const day = { ...(room[wday] || {}) };
                        if (!value || (!value.professor?.trim() && !value.course?.trim())) {
                                delete day[slotKey];
                        } else {
                                day[slotKey] = {
                                        professor: value.professor?.trim() || '',
                                        course: value.course?.trim() || '',
                                };
                        }
                        if (Object.keys(day).length === 0) delete room[wday];
                        else room[wday] = day;
                        return { ...prev, [roomId]: room };
                });
        }

        function getSlotInfo(roomId, wday, slotKey) {
                return inUseText[roomId]?.[wday]?.[slotKey] || null;
        }

        function addExplicitSlot(roomId, wday, slot) {
                setExplicitHours(prev => {
                        const curr = prev[roomId] ? [...prev[roomId]] : [];
                        const exists = curr.some(h => h.weekday === wday && h.startHHMM === slot.startHHMM && h.endHHMM === slot.endHHMM);
                        if (!exists) curr.push({ weekday: wday, startHHMM: slot.startHHMM, endHHMM: slot.endHHMM });
                        return { ...prev, [roomId]: curr };
                });
        }

        function removeExplicitSlot(roomId, wday, slot) {
                setExplicitHours(prev => {
                        const curr = prev[roomId] ? [...prev[roomId]] : [];
                        const idx = curr.findIndex(h => h.weekday === wday && h.startHHMM === slot.startHHMM && h.endHHMM === slot.endHHMM);
                        if (idx >= 0) curr.splice(idx, 1);
                        return { ...prev, [roomId]: curr };
                });
        }

        function addClosed(roomId, wday, slotKey) {
                setClosedSlots(prev => {
                        const roomMap = { ...(prev[roomId] || {}) };
                        const slotSet = new Set(roomMap[wday] || []);
                        slotSet.add(slotKey);
                        roomMap[wday] = slotSet;
                        return { ...prev, [roomId]: roomMap };
                });
        }

        function removeClosed(roomId, wday, slotKey) {
                setClosedSlots(prev => {
                        const roomMap = { ...(prev[roomId] || {}) };
                        const slotSet = new Set(roomMap[wday] || []);
                        slotSet.delete(slotKey);
                        if (slotSet.size === 0) delete roomMap[wday];
                        else roomMap[wday] = slotSet;
                        return { ...prev, [roomId]: roomMap };
                });
        }

        function handleClickSlot(roomId, wday, slot, available) {
                if (available) {
                        const existing = getSlotInfo(roomId, wday, slot.key) || { professor: '', course: '' };
                        setEditing({
                                roomId,
                                wday,
                                slotKey: slot.key,
                                slot,
                                professor: existing.professor,
                                course: existing.course,
                        });
                } else {
                        const info = getSlotInfo(roomId, wday, slot.key);
                        setConfirmCancel({ roomId, wday, slot, slotKey: slot.key, info });
                }
        }

        function cancelEditing() {
                setEditing(null);
        }

        function saveEditing() {
                if (!editing) return;
                const { roomId, wday, slot, slotKey, professor, course } = editing;

                // ----- Apply local UI update immediately -----
                // 1) Set / update the in-use note
                setSlotInfo(roomId, wday, slotKey, { professor, course });

                // 2) Flip availability for that slot (explicit -> remove slot; default -> add closed)
                if (isExplicit(roomId, wday)) {
                        removeExplicitSlot(roomId, wday, slot);
                } else {
                        addClosed(roomId, wday, slotKey);
                }
                setEditing(null);

                // ----- Build NEXT state synchronously (to persist exactly what we just applied) -----

                // explicitHours
                const nextExplicit = {
                        ...explicitHours,
                        [roomId]: [...(explicitHours[roomId] || [])],
                };
                if (isExplicit(roomId, wday)) {
                        // remove if exists
                        const idx = nextExplicit[roomId].findIndex(
                                h =>
                                        h.weekday === wday &&
                                        h.startHHMM === slot.startHHMM &&
                                        h.endHHMM === slot.endHHMM
                        );
                        if (idx >= 0) nextExplicit[roomId].splice(idx, 1);
                }

                // closedSlots
                const nextClosed = {
                        ...closedSlots,
                        [roomId]: { ...(closedSlots[roomId] || {}) },
                };
                if (!isExplicit(roomId, wday)) {
                        const set = new Set(nextClosed[roomId][wday] || []);
                        set.add(slotKey);
                        nextClosed[roomId][wday] = set;
                }

                // inUseText (ensure the note is present with latest values)
                const nextInUse = {
                        ...inUseText,
                        [roomId]: { ...(inUseText[roomId] || {}) },
                };
                const dayMap = { ...(nextInUse[roomId][wday] || {}) };
                dayMap[slotKey] = {
                        professor: professor?.trim() || '',
                        course: course?.trim() || '',
                };
                nextInUse[roomId] = { ...nextInUse[roomId], [wday]: dayMap };

                // ----- Commit local UI right away -----
                setExplicitHours(nextExplicit);
                setClosedSlots(nextClosed);
                setInUseText(nextInUse);

                // ----- Persist using the exact draft we just applied -----
                // This triggers your existing savingRowId / savedRowId UI
                saveRoomHours(roomId, {
                        explicitHours: nextExplicit,
                        closedSlots: nextClosed,
                        inUseText: nextInUse,
                }).catch((e) => {
                        console.error(e);
                        alert(e.message || 'Failed to save slot');
                });
        }


        function confirmCancelNo() {
                setConfirmCancel(null);
        }

        async function confirmCancelYes() {
                if (!confirmCancel) return;
                const { roomId, wday, slot, slotKey } = confirmCancel;

                if (isExplicit(roomId, wday)) {
                        addExplicitSlot(roomId, wday, slot);
                } else {
                        removeClosed(roomId, wday, slotKey);
                }
                setSlotInfo(roomId, wday, slotKey, null);

                setConfirmCancel(null);

                // Persist immediately so student page sees it as FREE right away
                try {
                        await saveRoomHours(roomId);

                } catch (e) {
                        // surface a gentle message, but we've already flipped local UI
                        console.error(e);
                        alert(e.message || 'Failed to save after cancel');
                }

                // ----- Build NEXT state synchronously -----
                // explicitHours
                const nextExplicit = {
                        ...explicitHours,
                        [roomId]: [...(explicitHours[roomId] || [])],
                };
                if (isExplicit(roomId, wday)) {
                        const exists = nextExplicit[roomId].some(
                                h => h.weekday === wday &&
                                        h.startHHMM === slot.startHHMM &&
                                        h.endHHMM === slot.endHHMM
                        );
                        if (!exists) {
                                nextExplicit[roomId].push({ weekday: wday, startHHMM: slot.startHHMM, endHHMM: slot.endHHMM });
                        }
                }

                // closedSlots
                const nextClosed = {
                        ...closedSlots,
                        [roomId]: { ...(closedSlots[roomId] || {}) }
                };
                if (!isExplicit(roomId, wday)) {
                        const set = new Set(nextClosed[roomId][wday] || []);
                        set.delete(slotKey); // removing the "closed" marker makes it free in default mode
                        if (set.size === 0) delete nextClosed[roomId][wday];
                        else nextClosed[roomId][wday] = set;
                }

                // inUseText (clear the note)
                const nextInUse = {
                        ...inUseText,
                        [roomId]: { ...(inUseText[roomId] || {}) }
                };
                if (nextInUse[roomId][wday]) {
                        const dayMap = { ...nextInUse[roomId][wday] };
                        delete dayMap[slotKey];
                        if (Object.keys(dayMap).length === 0) {
                                const copy = { ...nextInUse[roomId] };
                                delete copy[wday];
                                nextInUse[roomId] = copy;
                        } else {
                                nextInUse[roomId] = { ...nextInUse[roomId], [wday]: dayMap };
                        }
                }

                // ----- Commit local UI immediately -----
                setExplicitHours(nextExplicit);
                setClosedSlots(nextClosed);
                setInUseText(nextInUse);
                setConfirmCancel(null);

                // ----- Persist using the exact draft we just applied -----
                try {
                        await saveRoomHours(roomId, {
                                explicitHours: nextExplicit,
                                closedSlots: nextClosed,
                                inUseText: nextInUse,
                        });
                } catch (e) {
                        console.error(e);
                        alert(e.message || 'Failed to save after cancel');
                }

        }

        async function saveRoomHours(roomId, draft = {}) {
                try {
                        setSavingRowId(roomId);
                        setSavedRowId(null);

                        // Build final open-hours payload
                        const explicitSrc = draft.explicitHours ?? explicitHours;
                        const closedSrc = draft.closedSlots ?? closedSlots;
                        const notesSrc = draft.inUseText ?? inUseText;

                        const base = explicitSrc[roomId] || [];
                        const out = [...base];

                        const roomClosed = closedSrc[roomId] || {};
                        const SENT_START = '00:00';
                        const SENT_END = '00:01';

                        for (let d = 1; d <= 6; d++) {
                                if (dayMode[roomId]?.[d] === 'explicit') {
                                        // If the day is explicit but has no slots left, add a sentinel to keep it explicit.
                                        const hasAny = base.some(h => h.weekday === d);
                                        if (!hasAny) {
                                                out.push({ weekday: d, startHHMM: SENT_START, endHHMM: SENT_END });
                                        }
                                } else {
                                        // default mode: encode "closed" with either explicit allowed slots or a sentinel if all closed
                                        const closedSet = roomClosed[d];
                                        if (closedSet && closedSet.size > 0) {
                                                if (closedSet.size === TIME_SLOTS.length) {
                                                        out.push({ weekday: d, startHHMM: SENT_START, endHHMM: SENT_END });
                                                } else {
                                                        TIME_SLOTS.forEach(s => {
                                                                if (!closedSet.has(s.key)) {
                                                                        out.push({ weekday: d, startHHMM: s.startHHMM, endHHMM: s.endHHMM });
                                                                }
                                                        });
                                                }
                                        }
                                }
                        }

                        // Deduplicate just in case
                        const uniq = [];
                        const seen = new Set();
                        for (const h of out) {
                                const k = `${h.weekday}-${h.startHHMM}-${h.endHHMM}`;
                                if (!seen.has(k)) { seen.add(k); uniq.push(h); }
                        }

                        // Build notes payload
                        const notesOut = [];
                        const roomNotes = notesSrc[roomId] || {};
                        for (const [wdStr, slots] of Object.entries(roomNotes)) {
                                const wday = Number(wdStr);
                                for (const [slotKey, info] of Object.entries(slots)) {
                                        const s = TIME_SLOTS.find(x => x.key === slotKey);
                                        if (!s) continue;
                                        notesOut.push({
                                                weekday: wday,
                                                startHHMM: s.startHHMM,
                                                endHHMM: s.endHHMM,
                                                professor: info.professor || '',
                                                course: info.course || ''
                                        });
                                }
                        }

                        await Promise.all([
                                setRoomOpenHours(token, roomId, uniq),
                                setRoomSlotNotes(token, roomId, notesOut),
                        ]);

                        // Reload to sync local state
                        const fresh = await getRoomOpenHours(token, roomId).catch(() => []);
                        setExplicitHours(prev => ({ ...prev, [roomId]: fresh }));

                        setDayMode(prev => {
                                const nm = { ...(prev[roomId] || {}) };
                                for (let d = 1; d <= 6; d++) {
                                        nm[d] = fresh.some(h => h.weekday === d) ? 'explicit' : 'default';
                                }
                                return { ...prev, [roomId]: nm };
                        });

                        const freshNotes = await getRoomSlotNotes(token, roomId).catch(() => []);
                        setInUseText(prev => {
                                const copy = { ...prev };
                                const roomMap = {};
                                for (const n of freshNotes) {
                                        const slot = TIME_SLOTS.find(s => s.startHHMM === n.startHHMM && s.endHHMM === n.endHHMM);
                                        if (!slot) continue;
                                        roomMap[n.weekday] = roomMap[n.weekday] || {};
                                        roomMap[n.weekday][slot.key] = { professor: n.professor || '', course: n.course || '' };
                                }
                                copy[roomId] = roomMap;
                                return copy;
                        });

                        // Clear transient toggles for this room
                        setClosedSlots(prev => {
                                const copy = { ...prev };
                                delete copy[roomId];
                                return copy;
                        });

                        setSavedRowId(roomId);
                        setTimeout(() => setSavedRowId(null), 1200);
                } catch (e) {
                        alert(e.message || 'Failed to save hours');
                } finally {
                        setSavingRowId(null);
                }
        }


        const lineEllipsis = {
                display: 'block',
                width: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
        };

        return (
                <>
                        <div className="row g-3">
                                {/* LEFT */}
                                <aside className="col-12 col-md-4 col-lg-3">
                                        <div className="card border-0 shadow-sm">
                                                <div className="card-body">
                                                        <div className="d-flex align-items-end justify-content-between mb-3">
                                                                <div style={{ minWidth: 220 }}>
                                                                        <label className="form-label me-2 mb-0 small">Building</label>
                                                                        <select
                                                                                className="form-select form-select-sm"
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
                                                        </div>

                                                        <div className="list-group">
                                                                {loading ? (
                                                                        <div className="d-flex align-items-center gap-2 px-3 py-2">
                                                                                <span className="spinner-border spinner-border-sm" />
                                                                                <span>Loading…</span>
                                                                        </div>
                                                                ) : floors.length === 0 ? (
                                                                        <div className="text-secondary small px-3 py-2">No floors found.</div>
                                                                ) : (
                                                                        floors.map(f => (
                                                                                <button
                                                                                        key={f.id}
                                                                                        className={`list-group-item list-group-item-action ${selFloorId === f.id ? 'active' : ''}`}
                                                                                        onClick={() => setSelFloorId(f.id)}
                                                                                        style={selFloorId === f.id ? { backgroundColor: BRAND, borderColor: BRAND } : undefined}
                                                                                >
                                                                                        {f.name}
                                                                                </button>
                                                                        ))
                                                                )}
                                                        </div>

                                                        {err && <div className="alert alert-danger mt-3">{err}</div>}
                                                </div>
                                        </div>
                                </aside>

                                {/* RIGHT */}
                                <main className="col-12 col-md-8 col-lg-9">
                                        <div className="card border-0 shadow-sm">
                                                <div className="card-body">
                                                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                                                                <div>
                                                                        <h2 className="h5 mb-0">{floorName || 'No floor selected'}</h2>
                                                                        <div className="text-secondary small">{buildingName}</div>
                                                                </div>

                                                                {/* weekday selector */}
                                                                <div className="d-flex align-items-center gap-2">
                                                                        <label className="form-label mb-0 small">Weekday</label>
                                                                        <select
                                                                                className="form-select form-select-sm"
                                                                                value={weekday}
                                                                                onChange={(e) => setWeekday(Number(e.target.value))}
                                                                        >
                                                                                {WEEKDAYS.map(d => (
                                                                                        <option value={d.val} key={d.val}>{d.label}</option>
                                                                                ))}
                                                                        </select>
                                                                </div>
                                                        </div>

                                                        {/* table */}
                                                        <div className="table-responsive">
                                                                <table
                                                                        className="table table-striped table-hover align-middle"
                                                                        style={{ tableLayout: 'fixed', width: '100%' }}
                                                                >
                                                                        <tbody>
                                                                                {rooms.length === 0 ? (
                                                                                        <tr>
                                                                                                <td colSpan={TIME_SLOTS.length + 2} className="text-secondary">
                                                                                                        No rooms on this floor.
                                                                                                </td>
                                                                                        </tr>
                                                                                ) : (
                                                                                        rooms.map(r => (
                                                                                                <tr key={r.id}>
                                                                                                        <td style={{ padding: '5px' }}>{r.name}</td>

                                                                                                        {TIME_SLOTS.map(s => {
                                                                                                                const available = hasSlot(r.id, weekday, s);
                                                                                                                const info = getSlotInfo(r.id, weekday, s.key);
                                                                                                                const profText = info?.professor?.trim() || 'In use';
                                                                                                                const courseText = info?.course?.trim() || '';
                                                                                                                const titleWhenInUse = courseText
                                                                                                                        ? `${profText}\n${courseText}`
                                                                                                                        : `${profText}\n(click to set Available)`;
                                                                                                                return (
                                                                                                                        <td key={s.key} className="text-center" style={{ padding: '5px' }}>
                                                                                                                                <button
                                                                                                                                        type="button"
                                                                                                                                        className="btn btn-sm text-white"
                                                                                                                                        onClick={() => handleClickSlot(r.id, weekday, s, available)}
                                                                                                                                        title={available ? 'Available (click to set In use)' : titleWhenInUse}
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
                                                                                                                                                                {profText}
                                                                                                                                                        </span>
                                                                                                                                                        <span
                                                                                                                                                                style={{
                                                                                                                                                                        ...lineEllipsis,
                                                                                                                                                                        fontSize: SLOT_TEXT_PX,
                                                                                                                                                                        lineHeight: SLOT_LINE_HEIGHT,
                                                                                                                                                                        textAlign: 'center',
                                                                                                                                                                }}
                                                                                                                                                        >
                                                                                                                                                                {courseText}
                                                                                                                                                        </span>
                                                                                                                                                </span>
                                                                                                                                        )}
                                                                                                                                </button>
                                                                                                                        </td>
                                                                                                                );
                                                                                                        })}

                                                                                                        <td className="text-end" style={{ padding: '5px' }}>
                                                                                                                <div className="btn-group btn-group-sm">
                                                                                                                        <button
                                                                                                                                className="btn btn-outline-secondary"
                                                                                                                                disabled={savingRowId === r.id}
                                                                                                                                onClick={() => saveRoomHours(r.id)}
                                                                                                                        >
                                                                                                                                {savingRowId === r.id ? 'Saving…' : (savedRowId === r.id ? 'Saved' : 'Save')}
                                                                                                                        </button>
                                                                                                                </div>
                                                                                                        </td>
                                                                                                </tr>
                                                                                        ))
                                                                                )}
                                                                        </tbody>
                                                                </table>
                                                        </div>
                                                </div>
                                        </div>
                                </main>
                        </div>

                        {/* ===== Inline 2-field editor ===== */}
                        {editing && (
                                <div
                                        className="position-fixed top-0 start-0 w-100 h-100"
                                        style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
                                        onClick={(e) => { if (e.target === e.currentTarget) cancelEditing(); }}
                                >
                                        <div
                                                className="position-absolute top-50 start-50 translate-middle card shadow"
                                                style={{ width: 380, maxWidth: '90vw' }}
                                        >
                                                <div className="card-body">
                                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                                                <div className="fw-semibold">Set slot as In Use</div>
                                                                <button className="btn btn-sm btn-light" onClick={cancelEditing}>✕</button>
                                                        </div>
                                                        <div className="text-secondary small mb-3">
                                                                {editing.slot?.startHHMM}–{editing.slot?.endHHMM}
                                                        </div>
                                                        <div className="mb-2">
                                                                <label className="form-label small mb-1">Professor name</label>
                                                                <input
                                                                        autoFocus
                                                                        className="form-control form-control-sm"
                                                                        value={editing.professor}
                                                                        onChange={(e) => setEditing(ed => ({ ...ed, professor: e.target.value }))}
                                                                        placeholder="e.g., Dr. Sokhey"
                                                                />
                                                        </div>
                                                        <div className="mb-3">
                                                                <label className="form-label small mb-1">Course name</label>
                                                                <input
                                                                        className="form-control form-control-sm"
                                                                        value={editing.course}
                                                                        onChange={(e) => setEditing(ed => ({ ...ed, course: e.target.value }))}
                                                                        placeholder="e.g., CS101 – Intro to CS"
                                                                />
                                                        </div>
                                                        <div className="d-flex justify-content-end gap-2">
                                                                <button className="btn btn-sm btn-light" onClick={cancelEditing}>Cancel</button>
                                                                <button
                                                                        className="btn btn-sm text-white"
                                                                        style={{ backgroundColor: IN_USE, borderColor: IN_USE }}
                                                                        onClick={saveEditing}
                                                                >
                                                                        Save
                                                                </button>
                                                        </div>
                                                </div>
                                        </div>
                                </div>
                        )}

                        {/* ===== Confirm-cancel modal ===== */}
                        {confirmCancel && (
                                <div
                                        className="position-fixed top-0 start-0 w-100 h-100"
                                        style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
                                        onClick={(e) => { if (e.target === e.currentTarget) confirmCancelNo(); }}
                                >
                                        <div
                                                className="position-absolute top-50 start-50 translate-middle card shadow"
                                                style={{ width: 420, maxWidth: '92vw' }}
                                        >
                                                <div className="card-body">
                                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                                                <div className="fw-semibold">Cancel this class?</div>
                                                                <button className="btn btn-sm btn-light" onClick={confirmCancelNo}>✕</button>
                                                        </div>
                                                        <div className="text-secondary small mb-3">
                                                                {confirmCancel.slot?.startHHMM}–{confirmCancel.slot?.endHHMM}
                                                        </div>
                                                        <div className="small mb-3">
                                                                <div><strong>Professor:</strong> {confirmCancel.info?.professor || '—'}</div>
                                                                <div><strong>Course:</strong> {confirmCancel.info?.course || '—'}</div>
                                                        </div>
                                                        <div className="d-flex justify-content-end gap-2">
                                                                <button className="btn btn-sm btn-light" onClick={confirmCancelNo}>No, keep</button>
                                                                <button
                                                                        className="btn btn-sm text-white"
                                                                        style={{ backgroundColor: IN_USE, borderColor: IN_USE }}
                                                                        onClick={confirmCancelYes}
                                                                >
                                                                        Yes, cancel
                                                                </button>
                                                        </div>
                                                </div>
                                        </div>
                                </div>
                        )}
                </>
        );
}
