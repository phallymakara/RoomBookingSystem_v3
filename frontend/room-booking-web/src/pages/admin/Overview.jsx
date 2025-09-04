export default function Overview() {
        return (
                <>
                        {/* ---------------- Overview Section ---------------- */}
                        <h2 className="h4 mb-3">Overview</h2>
                        <div className="row g-3">
                                {/* Total Buildings */}
                                <div className="col-12 col-md-6 col-xl-3">
                                        <div className="card shadow-sm border-0 h-100">
                                                <div className="card-body">
                                                        <div className="text-secondary small">Total Buildings</div>
                                                        <div className="display-6 fw-bold">—</div>
                                                </div>
                                        </div>
                                </div>

                                {/* Total Rooms */}
                                <div className="col-12 col-md-6 col-xl-3">
                                        <div className="card shadow-sm border-0 h-100">
                                                <div className="card-body">
                                                        <div className="text-secondary small">Total Rooms</div>
                                                        <div className="display-6 fw-bold">—</div>
                                                </div>
                                        </div>
                                </div>

                                {/* Approved Today */}
                                <div className="col-12 col-md-6 col-xl-3">
                                        <div className="card shadow-sm border-0 h-100">
                                                <div className="card-body">
                                                        <div className="text-secondary small">Approved Today</div>
                                                        <div className="display-6 fw-bold">—</div>
                                                </div>
                                        </div>
                                </div>

                                {/* Cancelled */}
                                <div className="col-12 col-md-6 col-xl-3">
                                        <div className="card shadow-sm border-0 h-100">
                                                <div className="card-body">
                                                        <div className="text-secondary small">Cancelled</div>
                                                        <div className="display-6 fw-bold">—</div>
                                                </div>
                                        </div>
                                </div>
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
