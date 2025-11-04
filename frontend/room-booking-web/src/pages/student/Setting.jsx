// frontend/src/pages/student/Setting.jsx
import { useEffect, useState } from 'react';
import { getPublicSettings } from '../../api';

export default function Settings() {
        const [loading, setLoading] = useState(true);
        const [err, setErr] = useState('');
        const [s, setS] = useState({
                campusName: '',
                defaultOpenStart: '',
                defaultOpenEnd: '',
                telegramLink: '',
                autoCancelEnabled: false,
                autoCancelGraceMinutes: 0,
        });

        useEffect(() => {
                (async () => {
                        setErr(''); setLoading(true);
                        try {
                                const data = await getPublicSettings();
                                setS({
                                        campusName: data.campusName || '',
                                        defaultOpenStart: data.defaultOpenStart || '',
                                        defaultOpenEnd: data.defaultOpenEnd || '',
                                        telegramLink: data.telegramLink || '',
                                        autoCancelEnabled: !!data.autoCancelEnabled,
                                        autoCancelGraceMinutes: Number(data.autoCancelGraceMinutes || 0),
                                });
                        } catch (e) {
                                setErr(e.message || 'Failed to load settings');
                        } finally {
                                setLoading(false);
                        }
                })();
        }, []);

        return (
                <>
                        <h2 className="h4 mb-3" style={{ marginLeft: '10px', marginTop: '10px' }}>Setting</h2>

                        {err && <div className="alert alert-danger ms-2 me-2">{err}</div>}

                        <div className="card shadow-sm border-0" style={{ marginLeft: '5px' }}>
                                <div className="card-body">
                                        {loading ? (
                                                <div className="d-flex align-items-center gap-2">
                                                        <div className="spinner-border spinner-border-sm" role="status" />
                                                        <span>Loading…</span>
                                                </div>
                                        ) : (
                                                <>
                                                        <div className="mb-3">
                                                                <label className="form-label">Campus name</label>
                                                                <input
                                                                        className="form-control"
                                                                        value={s.campusName || '—'}
                                                                        disabled
                                                                        readOnly
                                                                />
                                                        </div>

                                                        <div className="mb-3">
                                                                <label className="form-label">Default opening hours</label>
                                                                <div className="d-flex gap-2 flex-wrap">
                                                                        <div>
                                                                                <small className="text-secondary d-block">Opening hour</small>
                                                                                <input
                                                                                        className="form-control"
                                                                                        style={{ maxWidth: 160 }}
                                                                                        value={s.defaultOpenStart || '—'}
                                                                                        disabled
                                                                                        readOnly
                                                                                />
                                                                        </div>
                                                                        <div>
                                                                                <small className="text-secondary d-block">Ending hour</small>
                                                                                <input
                                                                                        className="form-control"
                                                                                        style={{ maxWidth: 160 }}
                                                                                        value={s.defaultOpenEnd || '—'}
                                                                                        disabled
                                                                                        readOnly
                                                                                />
                                                                        </div>
                                                                </div>
                                                        </div>

                                                        <div className="mb-3">
                                                                <label className="form-label">Admin contact (Telegram)</label><br />
                                                                {s.telegramLink ? (
                                                                        <a
                                                                                href={s.telegramLink}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="link-primary text-decoration-none"
                                                                                title="Open Telegram"
                                                                        >
                                                                                {s.telegramLink}
                                                                        </a>
                                                                ) : (
                                                                        <span className="text-secondary">—</span>
                                                                )}
                                                        </div>

                                                        <div className="mb-2">
                                                                <label className="form-label d-block">Auto-cancellation</label>
                                                                {s.autoCancelEnabled ? (
                                                                        <span className="badge bg-success">
                                                                                Enabled — cancels if no check-in after {s.autoCancelGraceMinutes || 0} minute(s)
                                                                        </span>
                                                                ) : (
                                                                        <span className="badge bg-secondary">Disabled</span>
                                                                )}
                                                        </div>
                                                </>
                                        )}
                                </div>
                        </div>
                </>
        );
}
