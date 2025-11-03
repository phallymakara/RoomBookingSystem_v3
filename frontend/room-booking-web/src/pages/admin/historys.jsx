// frontend/src/pages/student/History.jsx
import { useEffect, useMemo, useState } from 'react';
import { getBookingHistory } from '../../api';

const STATUS_LABELS = {
        CONFIRMED: 'Approved',
        APPROVED: 'Approved',
        ACCEPTED: 'Accepted',
        REJECTED: 'Rejected',
        CANCELLED: 'Cancelled',
        CANCELED: 'Cancelled',
        PENDING: 'Pending',
};

const ALL_STATUSES = ['ACCEPTED', 'APPROVED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'PENDING'];

const STATUS_BADGE_CLASS = (s) => {
        switch (s) {
                case 'CONFIRMED':
                case 'APPROVED':
                case 'ACCEPTED':
                        return 'badge text-bg-success';
                case 'REJECTED':
                        return 'badge text-bg-danger';
                case 'CANCELLED':
                case 'CANCELED':
                        return 'badge text-bg-secondary';
                case 'PENDING':
                        return 'badge text-bg-warning';
                default:
                        return 'badge text-bg-light text-dark';
        }
};

function SortHeader({ field, active, order, onClick, children }) {
        // active = current sort field; order = 'asc' | 'desc'
        const isActive = active === field;
        return (
                <th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => onClick(field)}>
                        {children}{' '}
                        {isActive && (
                                <span aria-hidden="true" style={{ opacity: 0.7 }}>
                                        {order === 'asc' ? '▲' : '▼'}
                                </span>
                        )}
                </th>
        );
}

export default function History() {
        const token = localStorage.getItem('token') || '';

        const [statuses, setStatuses] = useState(['ACCEPTED', 'APPROVED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'PENDING']);
        const [q, setQ] = useState('');
        const [page, setPage] = useState(1);
        const [pageSize] = useState(20);
        const [sort, setSort] = useState('createdAt'); // 'createdAt' | 'startTs' | 'endTs' | 'status'
        const [order, setOrder] = useState('desc'); // 'asc' | 'desc'

        const [data, setData] = useState({ total: 0, items: [] });
        const [loading, setLoading] = useState(true);
        const [err, setErr] = useState('');

        // fetch
        useEffect(() => {
                let alive = true;
                (async () => {
                        try {
                                setErr('');
                                setLoading(true);
                                const result = await getBookingHistory(token, {
                                        statuses,
                                        page,
                                        pageSize,
                                        q,
                                        sort,
                                        order,
                                });
                                if (alive) setData(result);
                        } catch (e) {
                                if (alive) setErr(e?.message || 'Failed to load history');
                        } finally {
                                if (alive) setLoading(false);
                        }
                })();
                return () => { alive = false; };
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [token, statuses.join(','), page, pageSize, q, sort, order]);

        const totalPages = useMemo(
                () => Math.max(Math.ceil((data.total || 0) / pageSize), 1),
                [data.total, pageSize]
        );

        const toggleStatus = (s) => {
                setPage(1);
                setStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
        };

        const headerSort = (field) => {
                if (sort === field) {
                        setOrder(order === 'asc' ? 'desc' : 'asc');
                } else {
                        setSort(field);
                        setOrder('asc');
                }
                setPage(1);
        };

        // Reset to all statuses
        const selectAll = () => { setStatuses(ALL_STATUSES); setPage(1); };
        const clearAll = () => { setStatuses([]); setPage(1); };

        const rangeText = data.items.length
                ? `${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + data.items.length} of ${data.total}`
                : `0–0 of ${data.total}`;

        return (
                <>
                        <h2 className="h4 mb-3">History</h2>
                        {err && <div className="alert alert-danger">{err}</div>}

                        {/* Filters */}
                        <div className="card border-0 shadow-sm mb-3">
                                <div className="card-body">
                                        <div className="row g-2 align-items-center">
                                                <div className="col-12 col-md-auto">
                                                        <input
                                                                className="form-control"
                                                                placeholder="Search room, building, user…"
                                                                value={q}
                                                                onChange={(e) => { setPage(1); setQ(e.target.value); }}
                                                        />
                                                </div>

                                                <div className="col-12 col-md">
                                                        <div className="d-flex flex-wrap gap-2">
                                                                {ALL_STATUSES.map(s => (
                                                                        <button
                                                                                key={s}
                                                                                type="button"
                                                                                className={`btn btn-sm ${statuses.includes(s) ? 'btn-primary' : 'btn-outline-secondary'}`}
                                                                                onClick={() => toggleStatus(s)}
                                                                        >
                                                                                {STATUS_LABELS[s] || s}
                                                                        </button>
                                                                ))}
                                                                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={selectAll}>
                                                                        Select all
                                                                </button>
                                                                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearAll}>
                                                                        Clear
                                                                </button>
                                                        </div>
                                                </div>

                                                <div className="col-12 col-md-auto ms-auto d-flex gap-2">
                                                        <select
                                                                className="form-select form-select-sm"
                                                                value={sort}
                                                                onChange={(e) => { setSort(e.target.value); setOrder('desc'); setPage(1); }}
                                                        >
                                                                <option value="createdAt">Sort by created</option>
                                                                <option value="startTs">Sort by start</option>
                                                                <option value="endTs">Sort by end</option>
                                                                <option value="status">Sort by status</option>
                                                        </select>
                                                        <select
                                                                className="form-select form-select-sm"
                                                                value={order}
                                                                onChange={(e) => { setOrder(e.target.value); setPage(1); }}
                                                        >
                                                                <option value="desc">Desc</option>
                                                                <option value="asc">Asc</option>
                                                        </select>
                                                </div>
                                        </div>
                                </div>
                        </div>

                        {/* Table */}
                        <div className="card border-0 shadow-sm">
                                <div className="table-responsive">
                                        <table className="table align-middle mb-0">
                                                <thead className="table-light">
                                                        <tr>
                                                                <SortHeader field="createdAt" active={sort} order={order} onClick={headerSort}>Created</SortHeader>
                                                                <SortHeader field="startTs" active={sort} order={order} onClick={headerSort}>Start</SortHeader>
                                                                <SortHeader field="endTs" active={sort} order={order} onClick={headerSort}>End</SortHeader>
                                                                <th>Room</th>
                                                                <th>Building</th>
                                                                <th>Course</th>
                                                                <th>Reason</th>
                                                                <SortHeader field="status" active={sort} order={order} onClick={headerSort}>Status</SortHeader>
                                                                <th>Cancel reason</th>
                                                                <th>User</th>
                                                        </tr>
                                                </thead>
                                                <tbody>
                                                        {loading ? (
                                                                <tr><td colSpan={8} className="text-center py-4">Loading…</td></tr>
                                                        ) : data.items.length === 0 ? (
                                                                <tr><td colSpan={8} className="text-center py-4">No records</td></tr>
                                                        ) : (
                                                                data.items.map(row => (
                                                                        <tr key={row.id}>
                                                                                <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                                                                                <td>{row.startTs ? new Date(row.startTs).toLocaleString() : '—'}</td>
                                                                                <td>{row.endTs ? new Date(row.endTs).toLocaleString() : '—'}</td>
                                                                                <td>{row.room?.name || '—'}</td>
                                                                                <td>{row.building?.name || '—'}</td>
                                                                                <td>{row.courseName || '—'}</td>
                                                                                <td>{row.reason || '—'}</td>
                                                                                <td><span className={STATUS_BADGE_CLASS(row.status)}>{STATUS_LABELS[row.status] || row.status}</span></td>
                                                                                <td>{row.cancelReason || '—'}</td>
                                                                                <td>
                                                                                        {row.user?.name || row.user?.email
                                                                                                ? (<span title={row.user?.email || ''}>{row.user?.name || row.user?.email}</span>)
                                                                                                : '—'}
                                                                                </td>
                                                                        </tr>
                                                                ))
                                                        )}
                                                </tbody>
                                        </table>
                                </div>

                                {/* Pagination */}
                                <div className="card-body d-flex justify-content-between align-items-center">
                                        <div className="small text-secondary">{rangeText}</div>
                                        <div className="btn-group">
                                                <button
                                                        className="btn btn-outline-secondary btn-sm"
                                                        disabled={page <= 1}
                                                        onClick={() => setPage(p => Math.max(p - 1, 1))}
                                                >
                                                        Prev
                                                </button>
                                                <span className="btn btn-outline-secondary btn-sm disabled">{page} / {totalPages}</span>
                                                <button
                                                        className="btn btn-outline-secondary btn-sm"
                                                        disabled={page >= totalPages}
                                                        onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                                                >
                                                        Next
                                                </button>
                                        </div>
                                </div>
                        </div>
                </>
        );
}
