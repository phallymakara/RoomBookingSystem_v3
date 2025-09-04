// src/pages/admin/AdminFloors.jsx
// -------------------------------------------------------------
// Admin: Manage Buildings → Floors → Rooms
// - Sticky controls at top
// - Scrollable floor list (left) and rooms table (right)
// - Floor has only "name" (no level)
// - Uses brand colors (#272446 primary, #c01d2e accent)
// -------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import {
        // Buildings
        listBuildings,
        createBuilding,
        updateBuilding,
        deleteBuilding,
        // Floors
        listFloors,
        createFloor,
        updateFloor,
        deleteFloor,
        getFloorRooms,
        // Rooms
        createRoomInFloor,
        updateRoom,
        deleteRoom,
} from '../../api';

const BRAND = '#272446';

export default function AdminFloors() {
        const token = localStorage.getItem('token') || '';

        // -----------------------------------------------------------
        // State: Buildings
        // -----------------------------------------------------------
        const [buildings, setBuildings] = useState([]);
        const [selBuildingId, setSelBuildingId] = useState('');
        const [newBuildingName, setNewBuildingName] = useState('');

        // -----------------------------------------------------------
        // State: Floors (for selected building)
        // -----------------------------------------------------------
        const [floors, setFloors] = useState([]);
        const sortedFloors = useMemo(
                () => [...floors].sort((a, b) => a.name.localeCompare(b.name)),
                [floors]
        );

        // Current floor selection
        const [selFloorId, setSelFloorId] = useState('');
        const selectedFloor = useMemo(
                () => floors.find(f => f.id === selFloorId) || null,
                [floors, selFloorId]
        );

        // -----------------------------------------------------------
        // State: Rooms (for selected floor)
        // -----------------------------------------------------------
        const [rooms, setRooms] = useState([]);
        const [loadingFloors, setLoadingFloors] = useState(false);
        const [err, setErr] = useState('');

        // Create Floor form
        const [fName, setFName] = useState('');

        // Create Room form
        const [rName, setRName] = useState('');
        const [rCap, setRCap] = useState('');

        // Edit Room Form
        const [editRoomId, setEditRoomId] = useState(null);
        const [editName, setEditName] = useState('');
        const [editCap, setEditCap] = useState('');

        const [editNameId, setEditNameId] = useState(null);
        const [editNameVal, setEditNameVal] = useState('');
        const [editCapId, setEditCapId] = useState(null);
        const [editCapVal, setEditCapVal] = useState('');

        // ADD — projector create-state
        const [rProj, setRProj] = useState('none'); // 'have' | 'none'
        // ADD — inline edit state for projector
        const [editProjId, setEditProjId] = useState(null);
        const [editProjVal, setEditProjVal] = useState('none');


        // -----------------------------------------------------------
        // Data loaders
        // -----------------------------------------------------------

        // start editing a row  ← ADD
        function startEditRoom(r) {
                setEditRoomId(r.id);
                setEditName(r.name);
                setEditCap(String(r.capacity));
        }

        // cancel editing  ← ADD
        function cancelEditRoom() {
                setEditRoomId(null);
                setEditName('');
                setEditCap('');
        }

        // save changes (name & capacity)  ← ADD
        async function saveEditRoom(e) {
                e?.preventDefault?.();
                if (!editRoomId) return;
                try {
                        await updateRoom(token, editRoomId, {
                                name: editName.trim(),
                                capacity: Number(editCap),
                        });
                        cancelEditRoom();
                        await loadRoomsForFloor(selectedFloor.id);
                } catch (err) {
                        alert(err.message || 'Save failed');
                }
        }

        // delete while editing  ← ADD
        async function deleteEditingRoom() {
                if (!editRoomId) return;
                const r = rooms.find(x => x.id === editRoomId);
                if (!window.confirm(`Delete room "${r?.name || ''}"?`)) return;
                try {
                        await deleteRoom(token, editRoomId);
                        cancelEditRoom();
                        await loadRoomsForFloor(selectedFloor.id);
                } catch (err) {
                        alert(err.message || 'Delete failed');
                }
        }

        // Start editing NAME only  ← ADD
        function startEditName(r) {
                setEditCapId(null);
                setEditNameId(r.id);
                setEditNameVal(r.name);
        }

        // Start editing CAPACITY only  ← ADD
        function startEditCap(r) {
                setEditNameId(null);
                setEditCapId(r.id);
                setEditCapVal(String(r.capacity));
        }

        function cancelInlineEdit() {
                setEditNameId(null);
                setEditCapId(null);
                setEditProjId(null);
                setEditNameVal('');
                setEditCapVal('');
                setEditProjVal('none');
        }

        function startEditProjector(r) {
                setEditNameId(null);
                setEditCapId(null);
                setEditProjId(r.id);
                setEditProjVal(r?.equipment?.projector ? 'have' : 'none');
        }

        async function saveProjInline(e) {
                e?.preventDefault?.();
                if (!editProjId) return;
                try {
                        const currentEq = rooms.find(r => r.id === editProjId)?.equipment || {};
                        const nextEq = { ...currentEq, projector: editProjVal === 'have' };
                        await updateRoom(token, editProjId, { equipment: nextEq });
                        cancelInlineEdit();
                        await loadRoomsForFloor(selectedFloor.id);
                } catch (err) {
                        alert(err.message || 'Save failed');
                }
        }


        // Save edited name  ← ADD
        async function saveNameInline(e) {
                e?.preventDefault?.();
                if (!editNameId) return;
                try {
                        await updateRoom(token, editNameId, { name: editNameVal.trim() });
                        cancelInlineEdit();
                        await loadRoomsForFloor(selectedFloor.id);
                } catch (err) {
                        alert(err.message || 'Save failed');
                }
        }

        // Save edited capacity  ← ADD
        async function saveCapInline(e) {
                e?.preventDefault?.();
                if (!editCapId) return;
                try {
                        await updateRoom(token, editCapId, { capacity: Number(editCapVal) });
                        cancelInlineEdit();
                        await loadRoomsForFloor(selectedFloor.id);
                } catch (err) {
                        alert(err.message || 'Save failed');
                }
        }

        // Delete room while editing (works for either name/capacity edit)  ← ADD
        async function deleteInlineRoom() {
                const targetId = editNameId || editCapId;
                if (!targetId) return;
                const r = rooms.find(x => x.id === targetId);
                if (!window.confirm(`Delete room "${r?.name || ''}"?`)) return;
                try {
                        await deleteRoom(token, targetId);
                        cancelInlineEdit();
                        await loadRoomsForFloor(selectedFloor.id);
                } catch (err) {
                        alert(err.message || 'Delete failed');
                }
        }




        async function loadBuildings() {
                try {
                        setErr('');
                        const data = await listBuildings(token);
                        const list = Array.isArray(data) ? data : [];
                        setBuildings(list);

                        // Keep/choose selection
                        if (!selBuildingId && list.length) {
                                setSelBuildingId(list[0].id);
                        } else if (selBuildingId && !list.find(b => b.id === selBuildingId)) {
                                setSelBuildingId(list[0]?.id || '');
                        }
                } catch (e) {
                        setErr(e.message || 'Failed to load buildings');
                }
        }

        async function loadFloorsForBuilding(bId) {
                if (!bId) {
                        setFloors([]);
                        setSelFloorId('');
                        setRooms([]);
                        return;
                }
                try {
                        setLoadingFloors(true);
                        setErr('');
                        const data = await listFloors(token, bId); // listFloors(token, buildingId)
                        const list = Array.isArray(data) ? data : [];
                        setFloors(list);

                        // Keep/choose floor
                        if (!selFloorId && list.length) {
                                setSelFloorId(list[0].id);
                        } else if (selFloorId && !list.find(f => f.id === selFloorId)) {
                                setSelFloorId(list[0]?.id || '');
                        }
                } catch (e) {
                        setErr(e.message || 'Failed to load floors');
                } finally {
                        setLoadingFloors(false);
                }
        }

        async function loadRoomsForFloor(id) {
                if (!id) {
                        setRooms([]);
                        return;
                }
                try {
                        const { rooms } = await getFloorRooms(token, id);
                        setRooms(rooms || []);
                } catch (e) {
                        setErr(e.message || 'Failed to load rooms');
                }
        }

        // -----------------------------------------------------------
        // Effects
        // -----------------------------------------------------------
        useEffect(() => {
                loadBuildings();
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        useEffect(() => {
                loadFloorsForBuilding(selBuildingId);
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [selBuildingId]);

        useEffect(() => {
                loadRoomsForFloor(selFloorId);
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [selFloorId]);

        // -----------------------------------------------------------
        // Actions: Buildings
        // -----------------------------------------------------------
        async function onCreateBuilding(e) {
                e.preventDefault();
                const name = (newBuildingName || '').trim();
                if (!name) return;
                try {
                        const b = await createBuilding(token, { name });
                        setNewBuildingName('');
                        await loadBuildings();
                        setSelBuildingId(b.id);
                } catch (e) {
                        alert(e.message || 'Create building failed');
                }
        }

        async function onRenameBuilding(b) {
                const name = window.prompt('New building name:', b.name);
                if (!name) return;
                try {
                        const updated = await updateBuilding(token, b.id, { name: name.trim() });
                        // Update local list
                        setBuildings(prev => prev.map(x => (x.id === b.id ? { ...x, name: updated.name } : x)));
                } catch (e) {
                        alert(e.message || 'Rename building failed');
                }
        }

        async function onDeleteBuilding(b) {
                if (!window.confirm(`Delete building "${b.name}" (includes floors & rooms)?`)) return;
                try {
                        await deleteBuilding(token, b.id);
                        // If we deleted the selected building, clear selection
                        if (selBuildingId === b.id) {
                                setSelBuildingId('');
                                setSelFloorId('');
                                setFloors([]);
                                setRooms([]);
                        }
                        await loadBuildings();
                } catch (e) {
                        alert(e.message || 'Delete building failed');
                }
        }

        // -----------------------------------------------------------
        // Actions: Floors
        // -----------------------------------------------------------
        async function onCreateFloor(e) {
                e.preventDefault();
                if (!selBuildingId) return alert('Create or select a building first');
                try {
                        const created = await createFloor(token, { buildingId: selBuildingId, name: (fName || '').trim() });
                        setFName('');
                        await loadFloorsForBuilding(selBuildingId);
                        setSelFloorId(created.id);
                } catch (e) {
                        alert(e.message || 'Create floor failed');
                }
        }

        async function onRenameFloor(f, e) {
                e.stopPropagation();
                const newName = window.prompt('New floor name:', f.name);
                if (!newName) return;
                try {
                        const updated = await updateFloor(token, f.id, { name: newName.trim() });
                        // Update local list quickly
                        setFloors(prev => prev.map(x => (x.id === f.id ? { ...x, name: updated.name } : x)));
                        // Keep current selection
                } catch (e) {
                        alert(e.message || 'Rename floor failed');
                }
        }

        async function onDeleteFloorRow(f, e) {
                e.stopPropagation();
                if (!window.confirm(`Delete floor "${f.name}" (includes rooms)?`)) return;
                try {
                        await deleteFloor(token, f.id);
                        if (selFloorId === f.id) {
                                setSelFloorId('');
                                setRooms([]);
                        }
                        await loadFloorsForBuilding(selBuildingId);
                } catch (e) {
                        alert(e.message || 'Delete floor failed');
                }
        }

        // -----------------------------------------------------------
        // Actions: Rooms
        // -----------------------------------------------------------
        async function onCreateRoom(e) {
                e.preventDefault();
                if (!selectedFloor) return alert('Select a floor first');
                try {
                        await createRoomInFloor(token, selectedFloor.id, {
                                name: rName.trim(),
                                capacity: Number(rCap),
                                equipment: { projector: rProj === 'have' }

                        });
                        setRName('');
                        setRCap('');
                        setRProj('none');
                        await loadRoomsForFloor(selectedFloor.id);
                } catch (e) {
                        alert(e.message || 'Create room failed');
                }
        }

        async function onRenameRoom(room) {
                const name = window.prompt('New room name:', room.name);
                if (!name) return;
                try {
                        await updateRoom(token, room.id, { name: name.trim() });
                        await loadRoomsForFloor(selectedFloor.id);
                } catch (e) {
                        alert(e.message || 'Rename failed');
                }
        }

        async function onChangeCap(room) {
                const cap = window.prompt('New capacity:', String(room.capacity));
                if (!cap) return;
                try {
                        await updateRoom(token, room.id, { capacity: Number(cap) });
                        await loadRoomsForFloor(selectedFloor.id);
                } catch (e) {
                        alert(e.message || 'Update capacity failed');
                }
        }

        async function onDeleteRoomClick(room) {
                if (!window.confirm(`Delete room "${room.name}"?`)) return;
                try {
                        await deleteRoom(token, room.id);
                        await loadRoomsForFloor(selectedFloor.id);
                } catch (e) {
                        alert(e.message || 'Delete room failed');
                }
        }

        // --- add this new handler somewhere with the other room handlers ---
        async function onChangeProjector(room) {
                const current = room?.equipment?.projector ? 'have' : 'none';
                const input = window.prompt('Projector (type "have" or "none"):', current);
                if (!input) return;
                const normalized = String(input).trim().toLowerCase();
                const projector = normalized === 'have' || normalized === 'h' || normalized === 'yes' || normalized === 'y' || normalized === 'true';
                try {
                        await updateRoom(token, room.id, {
                                equipment: { ...(room.equipment || {}), projector } // merge
                        });
                        await loadRoomsForFloor(selectedFloor.id);
                } catch (e) {
                        alert(e.message || 'Update projector failed');
                }
        }


        // -----------------------------------------------------------
        // Render
        // -----------------------------------------------------------
        return (
                // Fill available height from AdminLayout; prevent outer scroll
                <div className="row g-3 h-100" style={{ overflow: 'hidden' }}>
                        {/* ===================== LEFT: Buildings + Floors ===================== */}
                        <aside className="col-12 col-md-4 col-lg-3 h-100">
                                <div className="card border-0 shadow-sm h-100">
                                        <div className="card-body d-flex flex-column h-100 overflow-hidden">
                                                {/* ---- Sticky: Building selector + create building ---- */}
                                                <div className="position-sticky top-0 bg-white z-1 pb-2 border-bottom">
                                                        {/* Building selector row */}
                                                        <div className="row g-2 align-items-end">
                                                                <div className="col-12">
                                                                        <label className="form-label small mb-1">Building</label>
                                                                        <div className="d-flex gap-2">
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

                                                                                {/* Building actions when selected */}
                                                                                {selBuildingId && (
                                                                                        <div className="btn-group btn-group-sm">
                                                                                                <button
                                                                                                        type="button"
                                                                                                        className="btn btn-outline-secondary"
                                                                                                        onClick={() => {
                                                                                                                const b = buildings.find(x => x.id === selBuildingId);
                                                                                                                if (b) onRenameBuilding(b);
                                                                                                        }}
                                                                                                >
                                                                                                        <i className="bi bi-pencil"></i>
                                                                                                </button>
                                                                                                <button
                                                                                                        type="button"
                                                                                                        className="btn btn-outline-danger"
                                                                                                        onClick={() => {
                                                                                                                const b = buildings.find(x => x.id === selBuildingId);
                                                                                                                if (b) onDeleteBuilding(b);
                                                                                                        }}
                                                                                                >
                                                                                                        <i className="bi bi-trash"></i>
                                                                                                </button>
                                                                                        </div>
                                                                                )}
                                                                        </div>
                                                                </div>

                                                                {/* Create building inline */}
                                                                <div className="col-12">
                                                                        <form className="d-flex gap-2" onSubmit={onCreateBuilding}>
                                                                                <input
                                                                                        className="form-control form-control-sm"
                                                                                        placeholder="New building name"
                                                                                        value={newBuildingName}
                                                                                        onChange={(e) => setNewBuildingName(e.target.value)}
                                                                                        required
                                                                                />
                                                                                <button
                                                                                        className="btn btn-sm text-white"
                                                                                        style={{ backgroundColor: BRAND, borderColor: BRAND }}
                                                                                >
                                                                                        + Building
                                                                                </button>
                                                                        </form>
                                                                </div>
                                                        </div>


                                                        {/* Create Floor (under current building) */}
                                                        <form className="border rounded-3 p-2 mt-2" onSubmit={onCreateFloor}>
                                                                <div className="row g-2">
                                                                        <div className="col-12">
                                                                                <label className="form-label small mb-1">Floor name</label>
                                                                                <input
                                                                                        className="form-control form-control-sm"
                                                                                        value={fName}
                                                                                        onChange={e => setFName(e.target.value)}
                                                                                        placeholder="First Floor"
                                                                                        required
                                                                                        disabled={!selBuildingId}
                                                                                />
                                                                        </div>
                                                                        <div className="col-12">
                                                                                <button
                                                                                        className="btn btn-sm text-white w-100"
                                                                                        style={{ backgroundColor: BRAND, borderColor: BRAND }}
                                                                                        disabled={!selBuildingId}
                                                                                >
                                                                                        + Create Floor
                                                                                </button>
                                                                        </div>
                                                                </div>
                                                        </form>
                                                </div>

                                                {/* ---- Scrollable floor list ---- */}
                                                <div className="flex-grow-1 overflow-auto">
                                                        {loadingFloors ? (
                                                                <div className="d-flex align-items-center gap-2 px-3 py-2">
                                                                        <span className="spinner-border spinner-border-sm" />
                                                                        <span>Loading…</span>
                                                                </div>
                                                        ) : sortedFloors.length === 0 ? (
                                                                <div className="text-secondary small px-3 py-2">No floors yet.</div>
                                                        ) : (
                                                                <div className="list-group">
                                                                        {sortedFloors.map(f => (
                                                                                <div
                                                                                        key={f.id}
                                                                                        className={`list-group-item d-flex align-items-center justify-content-between ${selFloorId === f.id ? 'active' : ''}`}
                                                                                        role="button"
                                                                                        onClick={() => setSelFloorId(f.id)}
                                                                                        style={selFloorId === f.id ? { backgroundColor: BRAND, borderColor: BRAND, color: '#fff' } : undefined}
                                                                                >
                                                                                        <div className="me-2">
                                                                                                <div className="fw-semibold">{f.name}</div>
                                                                                        </div>

                                                                                        <div className="btn-group btn-group-sm">
                                                                                                <button
                                                                                                        type="button"
                                                                                                        className={`btn ${selFloorId === f.id ? 'btn-light' : 'btn-outline-secondary'}`}
                                                                                                        onClick={(e) => onRenameFloor(f, e)}
                                                                                                >
                                                                                                        Edit
                                                                                                </button>
                                                                                                <button
                                                                                                        type="button"
                                                                                                        className={`btn ${selFloorId === f.id ? 'btn-light' : 'btn-outline-danger'}`}
                                                                                                        onClick={(e) => onDeleteFloorRow(f, e)}
                                                                                                >
                                                                                                        Delete
                                                                                                </button>
                                                                                        </div>
                                                                                </div>
                                                                        ))}
                                                                </div>
                                                        )}
                                                </div>

                                                {err && <div className="alert alert-danger mt-3 mb-0">{err}</div>}
                                        </div>
                                </div>
                        </aside>

                        {/* ===================== RIGHT: Rooms (for selected floor) ===================== */}
                        <main className="col-12 col-md-8 col-lg-9 h-100">
                                <div className="card border-0 shadow-sm h-100">
                                        <div className="card-body d-flex flex-column h-100 overflow-hidden">
                                                {/* ---- Sticky header: floor title + add room ---- */}
                                                <div className="position-sticky top-0 bg-white z-1 pt-1 pb-2 border-bottom">
                                                        {!selectedFloor ? (
                                                                <div className="alert alert-light border mb-2">Select a floor on the left.</div>
                                                        ) : (
                                                                <>
                                                                        {/* Title + count */}
                                                                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                                                                                <h2 className="h5 mb-0">{selectedFloor.name}</h2>
                                                                                <div
                                                                                        className="badge rounded-pill"
                                                                                        style={{ backgroundColor: BRAND, color: '#fff', fontSize: '0.9rem', padding: '0.5rem 0.75rem' }}
                                                                                >
                                                                                        {rooms.length} room{rooms.length !== 1 ? 's' : ''}
                                                                                </div>
                                                                        </div>

                                                                        {/* Add Room: button left, fields right */}
                                                                        <form className="row g-3" onSubmit={onCreateRoom}>
                                                                                <div className="col-12 col-md-3 col-lg-2 d-flex align-items-end">
                                                                                        <button className="btn text-white w-100" style={{ backgroundColor: BRAND, borderColor: BRAND }}>
                                                                                                + Add Room
                                                                                        </button>
                                                                                </div>
                                                                                <div className="col-12 col-md-6 col-lg-6">
                                                                                        <label className="form-label">Room name</label>
                                                                                        <input
                                                                                                className="form-control"
                                                                                                value={rName}
                                                                                                onChange={e => setRName(e.target.value)}
                                                                                                placeholder="Add Room Name"
                                                                                                required
                                                                                        />
                                                                                </div>
                                                                                <div className="col-12 col-md-3 col-lg-2">
                                                                                        <label className="form-label">Capacity</label>
                                                                                        <input
                                                                                                type="number"
                                                                                                className="form-control"
                                                                                                value={rCap}
                                                                                                onChange={e => setRCap(e.target.value)}
                                                                                                placeholder='Capacity'
                                                                                                min={1}
                                                                                                max={999}
                                                                                                required
                                                                                        />
                                                                                </div>


                                                                                {/* Input Field Projector Have Or None */}

                                                                                <div className="col-12 col-md-2 col-lg-2">
                                                                                        <label className="form-label">Projector</label>
                                                                                        <select
                                                                                                className="form-select"
                                                                                                value={rProj}
                                                                                                onChange={(e) => setRProj(e.target.value)}
                                                                                        >
                                                                                                <option value="have">Have</option>
                                                                                                <option value="none">None</option>
                                                                                        </select>
                                                                                </div>


                                                                        </form>
                                                                </>
                                                        )}
                                                </div>

                                                {/* ---- Scrollable rooms table (sticky header) ---- */}
                                                <div className="flex-grow-1 overflow-auto">
                                                        {selectedFloor && (
                                                                <div className="table-responsive mt-3">
                                                                        <table className="table table-striped table-hover align-middle">
                                                                                <thead className="table-dark" style={{ position: 'sticky', top: 0, zIndex: 3 }}>
                                                                                        <tr>
                                                                                                <th style={{ width: 220 }}>Name</th>
                                                                                                <th style={{ width: 140 }}>Capacity</th>
                                                                                                <th style={{ width: 120 }}>Projector</th> {/* ← ADD */}

                                                                                        </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                        {rooms.length === 0 ? (
                                                                                                <tr>
                                                                                                        <td colSpan={3} className="text-secondary">No rooms yet.</td>

                                                                                                </tr>
                                                                                        ) : (
                                                                                                rooms.map(r => (
                                                                                                        <tr key={r.id}>
                                                                                                                {/* NAME cell (click to edit) */}  {/* ← REPLACE */}
                                                                                                                {/* NAME cell — click to edit name ONLY */}  {/* ← REPLACE */}
                                                                                                                <td
                                                                                                                        onClick={() => startEditName(r)}
                                                                                                                        style={{ cursor: 'pointer', width: 220 }}
                                                                                                                >
                                                                                                                        {editNameId === r.id ? (
                                                                                                                                <div className="d-flex align-items-center gap-2">
                                                                                                                                        <input
                                                                                                                                                className="form-control form-control-sm rounded-3 shadow-sm"
                                                                                                                                                value={editNameVal}
                                                                                                                                                onChange={(e) => setEditNameVal(e.target.value)}
                                                                                                                                                autoFocus
                                                                                                                                                onKeyDown={(e) => {
                                                                                                                                                        if (e.key === 'Enter') saveNameInline();
                                                                                                                                                        if (e.key === 'Escape') cancelInlineEdit();
                                                                                                                                                }}
                                                                                                                                        />
                                                                                                                                        <div className="btn-group btn-group-sm">
                                                                                                                                                <button className="btn btn-primary" onClick={saveNameInline}>Save</button>
                                                                                                                                                <button className="btn btn-outline-danger" onClick={deleteInlineRoom}>Delete</button>
                                                                                                                                        </div>
                                                                                                                                </div>
                                                                                                                        ) : (
                                                                                                                                r.name
                                                                                                                        )}
                                                                                                                </td>


                                                                                                                {/* CAPACITY cell — click to edit capacity ONLY */}
                                                                                                                <td
                                                                                                                        onClick={() => startEditCap(r)}
                                                                                                                        style={{ cursor: 'pointer', width: 140 }}
                                                                                                                >
                                                                                                                        {editCapId === r.id ? (
                                                                                                                                <div
                                                                                                                                        className="d-flex align-items-center gap-2"
                                                                                                                                        onClick={(e) => e.stopPropagation()} // don’t re-trigger cell click
                                                                                                                                >
                                                                                                                                        <input
                                                                                                                                                type="number"
                                                                                                                                                min={1}
                                                                                                                                                max={999}
                                                                                                                                                className="form-control form-control-sm rounded-3 shadow-sm"
                                                                                                                                                value={editCapVal}
                                                                                                                                                onChange={(e) => setEditCapVal(e.target.value)}
                                                                                                                                                autoFocus
                                                                                                                                                onKeyDown={(e) => {
                                                                                                                                                        if (e.key === 'Enter') saveCapInline();
                                                                                                                                                        if (e.key === 'Escape') cancelInlineEdit();
                                                                                                                                                }}
                                                                                                                                        />
                                                                                                                                        <div className="btn-group btn-group-sm">
                                                                                                                                                <button type="button" className="btn btn-primary" onClick={saveCapInline}>
                                                                                                                                                        Save
                                                                                                                                                </button>
                                                                                                                                        </div>
                                                                                                                                </div>
                                                                                                                        ) : (
                                                                                                                                r.capacity
                                                                                                                        )}
                                                                                                                </td>

                                                                                                                {/* PROJECTOR cell — click to edit, show red when None */}
                                                                                                                <td
                                                                                                                        onClick={() => startEditProjector(r)}
                                                                                                                        style={{ cursor: 'pointer', width: 160 }}
                                                                                                                >
                                                                                                                        {editProjId === r.id ? (
                                                                                                                                <div className="d-flex align-items-center gap-2">
                                                                                                                                        <select
                                                                                                                                                className="form-select form-select-sm rounded-3 shadow-sm"
                                                                                                                                                value={editProjVal}
                                                                                                                                                onChange={(e) => setEditProjVal(e.target.value)}
                                                                                                                                                autoFocus
                                                                                                                                                onKeyDown={(e) => {
                                                                                                                                                        if (e.key === 'Enter') saveProjInline();
                                                                                                                                                        if (e.key === 'Escape') cancelInlineEdit();
                                                                                                                                                }}
                                                                                                                                        >
                                                                                                                                                <option value="none">None</option>
                                                                                                                                                <option value="have">Have</option>
                                                                                                                                        </select>
                                                                                                                                        <div className="btn-group btn-group-sm">
                                                                                                                                                <button className="btn btn-primary" onClick={saveProjInline}>Save</button>
                                                                                                                                        </div>
                                                                                                                                </div>
                                                                                                                        ) : (
                                                                                                                                <span className={r?.equipment?.projector ? '' : 'text-danger'}>
                                                                                                                                        {r?.equipment?.projector ? 'Have' : 'None'}
                                                                                                                                </span>
                                                                                                                        )}
                                                                                                                </td>




                                                                                                        </tr>
                                                                                                ))
                                                                                        )}
                                                                                </tbody>
                                                                        </table>
                                                                </div>
                                                        )}
                                                </div>
                                        </div>
                                </div>
                        </main>
                </div>
        );
}
