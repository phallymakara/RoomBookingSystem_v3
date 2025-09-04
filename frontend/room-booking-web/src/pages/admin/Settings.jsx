export default function Settings() {
        return (
                <>
                        <h2 className="h4 mb-3">Setting</h2>

                        <div className="card shadow-sm border-0">
                                <div className="card-body">
                                        <div className="mb-3">
                                                <label className="form-label">Campus name</label>
                                                <input className="form-control" placeholder="—" disabled />
                                        </div>
                                        <div className="mb-3">
                                                <label className="form-label">Default opening hours</label>
                                                <div className="d-flex gap-2">
                                                        <input className="form-control" placeholder="08:00" style={{ maxWidth: 160 }} disabled />
                                                        <input className="form-control" placeholder="22:00" style={{ maxWidth: 160 }} disabled />
                                                </div>
                                        </div>
                                        <button className="btn btn-secondary" disabled>Save (disabled)</button>
                                </div>
                        </div>
                </>
        );
}
