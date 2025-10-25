import { useEffect, useState } from 'react';
import { getAdminStats } from '../../api';

export default function Overview() {
        const token = localStorage.getItem('token') || '';
        const [stats, setStats] = useState({
                totalBuildings: 0,
                totalRooms: 0,
                approvedToday: 0,
                cancelledToday: 0,
                rejectedToday: 0,
        });
        const [err, setErr] = useState('');
        const [loading, setLoading] = useState(true);

        useEffect(() => {
                let alive = true;

                (async () => {
                        try {
                                setErr('');
                                setLoading(true);
                                // Asia/Phnom_Penh is UTC+7 => 420 minutes
                                const data = await getAdminStats(token, { tzOffsetMinutes: 420 });
                                if (alive && data) setStats(prev => ({ ...prev, ...data }));
                        } catch (e) {
                                if (alive) setErr(e?.message || 'Failed to load stats');
                        } finally {
                                if (alive) setLoading(false);
                        }
                })();

                return () => {
                        alive = false;
                };
        }, [token]);

        const Tile = ({ label, value }) => (
                <div
                        className="flex-grow-1"
                        style={{ flex: "1 1 18%", minWidth: "160px", maxWidth: "20%" }}
                >
                        <div className="card shadow-sm border-0 h-100">
                                <div className="card-body">
                                        <div className="text-secondary small">{label}</div>
                                        <div className="display-6 fw-bold">{loading ? '…' : value ?? 0}</div>
                                </div>
                        </div>
                </div>
        );


        return (
                <>
                        {/* ---------------- Overview Section ---------------- */}
                        <h2 className="h4 mb-3">Overview</h2>
                        {err && <div className="alert alert-danger">{err}</div>}

                        <div className="d-flex flex-wrap gap-3">
                                <Tile label="Total Buildings" value={stats.totalBuildings} />
                                <Tile label="Total Rooms" value={stats.totalRooms} />
                                <Tile label="Approved Today" value={stats.approvedToday} />
                                <Tile label="Cancelled Today" value={stats.cancelledToday} />
                                <Tile label="Rejected Today" value={stats.rejectedToday} />
                        </div>

                        <div className="card shadow-sm border-0 mt-3">
                                <div className="card-body">
                                        <div className="text-secondary small mb-2">Recent activity</div>
                                        <div className="list-group list-group-flush">
                                                <div className="list-group-item">—</div>
                                                <div className="list-group-item">—</div>
                                                <div className="list-group-item">—</div>
                                        </div>
                                </div>
                        </div>

                        {/* ---------------- Visualisation Section ---------------- */}
                        <h2 className="h4 mb-3 mt-4">Visualisation</h2>

                        <div className="card shadow-sm border-0">
                                <div className="card-body">
                                        <div className="text-secondary small mb-2">Bookings by day (placeholder)</div>
                                        <div
                                                className="w-100 rounded-3 bg-body-secondary"
                                                style={{ height: 260, border: '1px dashed #ced4da' }}
                                        />
                                </div>
                        </div>

                        <div className="row g-3 mt-1">
                                <div className="col-12 col-md-6">
                                        <div className="card shadow-sm border-0 h-100">
                                                <div className="card-body">
                                                        <div className="text-secondary small mb-2">Utilization by room (placeholder)</div>
                                                        <div
                                                                className="w-100 rounded-3 bg-body-secondary"
                                                                style={{ height: 180, border: '1px dashed #ced4da' }}
                                                        />
                                                </div>
                                        </div>
                                </div>

                                <div className="col-12 col-md-6">
                                        <div className="card shadow-sm border-0 h-100">
                                                <div className="card-body">
                                                        <div className="text-secondary small mb-2">Top time slots (placeholder)</div>
                                                        <div
                                                                className="w-100 rounded-3 bg-body-secondary"
                                                                style={{ height: 180, border: '1px dashed #ced4da' }}
                                                        />
                                                </div>
                                        </div>
                                </div>
                        </div>
                </>
        );
}
