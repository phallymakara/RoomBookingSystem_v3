import { useEffect, useRef, useState } from 'react';
import { getAdminStats, getStatsSeries, getRoomUtilization, getBuildingShare } from '../../api';
import Chart from 'chart.js/auto';

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

        // chart state
        const [series, setSeries] = useState([]);
        const [roomUsage, setRoomUsage] = useState([]);
        const [buildingShare, setBuildingShare] = useState([]);
        const lineRef = useRef(null);
        const barRef = useRef(null);
        const pieRef = useRef(null);
        const lineChart = useRef(null);
        const barChart = useRef(null);
        const pieChart = useRef(null);

        useEffect(() => {
                let alive = true;

                (async () => {
                        try {
                                setErr('');
                                setLoading(true);
                                // Asia/Phnom_Penh is UTC+7 => 420 minutes
                                const data = await getAdminStats(token, { tzOffsetMinutes: 420 });
                                if (alive && data) setStats(prev => ({ ...prev, ...data }));
                                const [tiles, s, ru, bs] = await Promise.all([
                                        getAdminStats(token, { tzOffsetMinutes: 420 }),
                                        getStatsSeries(token, { month: 1, tzOffsetMinutes: 420 }),
                                        getRoomUtilization(token, { days: 30 }),
                                        getBuildingShare(token, { days: 30 }),
                                ]);
                                if (alive && tiles) setStats(prev => ({ ...prev, ...tiles }));
                                if (alive) {
                                        setSeries(s || []);
                                        setRoomUsage(ru || []);
                                        setBuildingShare(bs || []);
                                }
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

        // draw charts after data
        useEffect(() => {
                try { lineChart.current?.destroy(); } catch { }
                try { barChart.current?.destroy(); } catch { }
                try { pieChart.current?.destroy(); } catch { }
                // Line: Bookings over time (use Day 1..N labels, and Y max=15)
                if (lineRef.current && series.length) {
                        // Force labels to Day 1..N so the first tick is 1
                        const labels = series.map(pt => pt.day);
                        const month = new Date().getMonth();
                        const year = new Date().getFullYear();
                        const dateLabels = labels.map(d => new Date(year, month, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
                        lineChart.current = new Chart(lineRef.current, {
                                type: 'line',
                                data: {
                                        labels,
                                        datasets: [
                                                { label: 'Approved', data: series.map(d => d.CONFIRMED), tension: 0.5 },
                                                { label: 'Rejected', data: series.map(d => d.REJECTED), tension: 0.5 },
                                                { label: 'Cancelled', data: series.map(d => d.CANCELLED), tension: 0.5 },
                                                { label: 'Pending', data: series.map(d => d.PENDING), tension: 0.5 },
                                        ]
                                },
                                options: {
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        scales: {
                                                y: {
                                                        // show 1..15 by default, but auto-grow if data > 15
                                                        beginAtZero: true,
                                                        suggestedMax: 15,
                                                        ticks: {
                                                                stepSize: 1,
                                                                callback: (v) => Number.isInteger(v) ? v : ''  // show whole numbers only
                                                        }
                                                },
                                                x: {
                                                        ticks: { callback: (value) => dateLabels[value] }
                                                }
                                        }
                                }
                        });
                }
                if (barRef.current && roomUsage.length) {
                        const labels = roomUsage.map(r => r.roomName);
                        const data = roomUsage.map(r => Math.round(r.hours * 10) / 10);
                        barChart.current = new Chart(barRef.current, {
                                type: 'bar',
                                data: { labels, datasets: [{ label: 'Booked hours (30d)', data }] },
                                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true } } }
                        });
                }
                if (pieRef.current && buildingShare.length) {
                        pieChart.current = new Chart(pieRef.current, {
                                type: 'doughnut',
                                data: { labels: buildingShare.map(b => b.buildingName), datasets: [{ data: buildingShare.map(b => b.count) }] },
                                options: { responsive: true, maintainAspectRatio: false }
                        });
                }
                return () => {
                        try { lineChart.current?.destroy(); } catch { }
                        try { barChart.current?.destroy(); } catch { }
                        try { pieChart.current?.destroy(); } catch { }
                };
        }, [series, roomUsage, buildingShare]);


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

                        <div className="d-flex flex-wrap gap-3" style={{ marginLeft: '20px', marginRight: '25px' }}>
                                <Tile label="Total Buildings" value={stats.totalBuildings} />
                                <Tile label="Total Rooms" value={stats.totalRooms} />
                                <Tile label="Approved Today" value={stats.approvedToday} />
                                <Tile label="Cancelled Today" value={stats.cancelledToday} />
                                <Tile label="Rejected Today" value={stats.rejectedToday} />
                        </div>

                        {/* Bookings over time (30d) */}
                        <div className="card shadow-sm border-0 mt-3" style={{ marginLeft: '20px', marginRight: '25px' }}>
                                <div className="card-body">
                                        <div className="text-secondary small mb-2">Bookings over time (last 30 days)</div>
                                        <div style={{ height: 280 }}><canvas ref={lineRef} /></div>
                                </div>
                        </div>

                        {/* ---------------- Visualisation Section ---------------- */}

                        <div className="row g-3 mt-1" style={{ marginLeft: '10px', marginRight: '12px' }}>
                                <div className="col-12 col-md-6">
                                        <div className="card shadow-sm border-0 h-100">
                                                <div className="card-body">
                                                        <div className="text-secondary small mb-2">Room utilization (booked hours, last 30 days)</div>
                                                        <div style={{ height: 260 }}><canvas ref={barRef} /></div>
                                                </div>
                                        </div>
                                </div>
                                <div className="col-12 col-md-6" >
                                        <div className="card shadow-sm border-0 h-100">
                                                <div className="card-body">
                                                        <div className="text-secondary small mb-2">Bookings by building (last 30 days)</div>
                                                        <div style={{ height: 260 }}><canvas ref={pieRef} /></div>
                                                </div>
                                        </div>
                                </div>
                        </div>
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
                        <div className="row g-3 mt-1">
                                {/* Room utilization (30d) */}
                                <div className="col-12 col-md-6">
                                        <div className="card shadow-sm border-0 h-100">
                                                <div className="card-body">
                                                        <div className="text-secondary small mb-2">Room utilization (booked hours, last 30 days)</div>
                                                        <div style={{ height: 260 }}>
                                                                <canvas ref={barRef} />
                                                        </div>
                                                </div>
                                        </div>
                                </div>
                                {/* Bookings by building (30d) */}
                                <div className="col-12 col-md-6">
                                        <div className="card shadow-sm border-0 h-100">
                                                <div className="card-body">
                                                        <div className="text-secondary small mb-2">Bookings by building (last 30 days)</div>
                                                        <div style={{ height: 260 }}>
                                                                <canvas ref={pieRef} />
                                                        </div>
                                                </div>
                                        </div>
                                </div>
                        </div>
                </>
        );
}
