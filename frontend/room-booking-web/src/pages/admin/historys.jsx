export default function Visualisation() {
        return (
                <>
                        <h2 className="h4 mb-3">Visualisation</h2>

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
                                                        <div className="w-100 rounded-3 bg-body-secondary" style={{ height: 180, border: '1px dashed #ced4da' }} />
                                                </div>
                                        </div>
                                </div>
                                <div className="col-12 col-md-6">
                                        <div className="card shadow-sm border-0 h-100">
                                                <div className="card-body">
                                                        <div className="text-secondary small mb-2">Top time slots (placeholder)</div>
                                                        <div className="w-100 rounded-3 bg-body-secondary" style={{ height: 180, border: '1px dashed #ced4da' }} />
                                                </div>
                                        </div>
                                </div>
                        </div>
                </>
        );
}
