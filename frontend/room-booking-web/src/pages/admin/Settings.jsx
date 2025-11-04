import { useEffect, useState } from 'react';
import { getAdminSettings, saveAdminSettings } from '../../api';

export default function AdminSettings() {
        const [loading, setLoading] = useState(true);
        const [saving, setSaving] = useState(false);
        const [exporting, setExporting] = useState(false);
        const [s, setS] = useState({
                campusName: '',
                defaultOpenStart: '08:00',
                defaultOpenEnd: '18:00',
                telegramLink: '',
                autoCancelEnabled: false,
                autoCancelGraceMinutes: 15,
                reportFrom: '',
                reportTo: '',
                reportFormat: 'csv',
        });

        useEffect(() => {
                (async () => {
                        try {
                                const token = localStorage.getItem('token') || '';
                                const data = await getAdminSettings(token); // requires Bearer
                                setS(v => ({ ...v, ...data }));
                        } catch (e) {
                                alert(e.message || 'Failed to load settings');
                        } finally { setLoading(false); }
                })();
        }, []);

        const onChange = (k) => (e) => {
                const val = (e?.target?.type === 'checkbox') ? e.target.checked : e.target.value;
                setS(v => ({ ...v, [k]: val }));
        };

        function isTime(v) { return /^\d{2}:\d{2}$/.test(v); }
        function isTelegramLink(v) { return !v || /^https:\/\/t\.me\/[A-Za-z0-9_]+/.test(v); }

        async function save() {
                if (!s.campusName.trim()) return alert('Campus name is required.');
                if (!isTime(s.defaultOpenStart) || !isTime(s.defaultOpenEnd)) return alert('Time must be HH:MM (e.g., 08:00).');
                if (!isTelegramLink(s.telegramLink)) return alert('Telegram link must start with https://t.me/');
                if (s.autoCancelEnabled && (isNaN(+s.autoCancelGraceMinutes) || +s.autoCancelGraceMinutes < 1)) {
                        return alert('Auto-cancel minutes should be a positive number.');
                }

                setSaving(true);
                try {
                        const token = localStorage.getItem('token') || '';
                        await saveAdminSettings(token, {
                                campusName: s.campusName.trim(),
                                defaultOpenStart: s.defaultOpenStart,
                                defaultOpenEnd: s.defaultOpenEnd,
                                telegramLink: s.telegramLink || null,
                                autoCancelEnabled: !!s.autoCancelEnabled,
                                autoCancelGraceMinutes: +s.autoCancelGraceMinutes || 0
                        });
                        alert('Settings saved ✅');
                } catch (e) {
                        alert(e.message || 'Failed to save settings');
                } finally { setSaving(false); }
        }

        async function exportReport() {
                if (!s.reportFrom || !s.reportTo) return alert('Please choose From and To dates.');
                setExporting(true);
                try {
                        const token = localStorage.getItem('token') || '';
                        const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/admin/reports/export` +
                                `?format=${encodeURIComponent(s.reportFormat)}` +
                                `&from=${encodeURIComponent(s.reportFrom)}` +
                                `&to=${encodeURIComponent(s.reportTo)}`;
                        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                        if (!res.ok) throw new Error('Export failed');
                        const blob = await res.blob();
                        const ext = s.reportFormat === 'xlsx' ? 'xlsx' : s.reportFormat;
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = `room-usage-${s.reportFrom}_${s.reportTo}.${ext}`;
                        a.click();
                        URL.revokeObjectURL(a.href);
                } catch (e) {
                        alert(e.message || 'Export failed');
                } finally { setExporting(false); }
        }

        if (loading) return <div>Loading…</div>;

        return (
                <div className="container py-3">
                        <h3 className="mb-3">Admin Settings</h3>

                        {/* 1) General information */}
                        <div className="card border-0 shadow-sm mb-3">
                                <div className="card-header bg-white fw-semibold">General information</div>
                                <div className="card-body d-flex flex-column gap-3">
                                        <div>
                                                <label className="form-label">Campus name</label>
                                                <input className="form-control" value={s.campusName} onChange={onChange('campusName')} placeholder="e.g., ITC Main Campus" />
                                        </div>

                                        <div className="d-flex flex-wrap gap-3">
                                                <div>
                                                        <label className="form-label">Opening hour</label>
                                                        <input className="form-control" style={{ maxWidth: 140 }} value={s.defaultOpenStart} onChange={onChange('defaultOpenStart')} placeholder="08:00" />
                                                </div>
                                                <div>
                                                        <label className="form-label">Ending hour</label>
                                                        <input className="form-control" style={{ maxWidth: 140 }} value={s.defaultOpenEnd} onChange={onChange('defaultOpenEnd')} placeholder="18:00" />
                                                </div>
                                                <div className="flex-grow-1" />
                                                <div style={{ minWidth: 320 }}>
                                                        <label className="form-label">Admin contact</label>
                                                        <input className="form-control" value={s.telegramLink || ''} onChange={onChange('telegramLink')} placeholder="https://t.me/your_handle" />
                                                </div>
                                        </div>
                                </div>
                        </div>

                        {/* 2) Booking & Policy Automation */}
                        <div className="card border-0 shadow-sm mb-3">
                                <div className="card-header bg-white fw-semibold">Booking &amp; Policy Automation</div>
                                <div className="card-body d-flex flex-wrap align-items-end gap-3">
                                        <div className="form-check form-switch">
                                                <input className="form-check-input" type="checkbox" id="autoCancel" checked={s.autoCancelEnabled} onChange={onChange('autoCancelEnabled')} />
                                                <label className="form-check-label" htmlFor="autoCancel">Auto-cancellation</label>
                                        </div>
                                        <div>
                                                <label className="form-label">Grace minutes</label>
                                                <input
                                                        className="form-control"
                                                        style={{ maxWidth: 120 }}
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        disabled={!s.autoCancelEnabled}
                                                        value={s.autoCancelGraceMinutes}
                                                        onChange={onChange('autoCancelGraceMinutes')}
                                                />
                                        </div>
                                </div>
                        </div>

                        {/* 3) Insights & Analytics */}
                        <div className="card border-0 shadow-sm mb-3">
                                <div className="card-header bg-white fw-semibold">Insights &amp; Analytics</div>
                                <div className="card-body d-flex flex-wrap align-items-end gap-3">
                                        <div>
                                                <label className="form-label">From</label>
                                                <input className="form-control" type="date" value={s.reportFrom} onChange={onChange('reportFrom')} />
                                        </div>
                                        <div>
                                                <label className="form-label">To</label>
                                                <input className="form-control" type="date" value={s.reportTo} onChange={onChange('reportTo')} />
                                        </div>
                                        <div>
                                                <label className="form-label">Format</label>
                                                <select className="form-select" value={s.reportFormat} onChange={onChange('reportFormat')}>
                                                        <option value="csv">CSV</option>
                                                        <option value="xlsx">Excel</option>
                                                        <option value="pdf">PDF</option>
                                                </select>
                                        </div>
                                        <button
                                                className="btn btn-primary"
                                                disabled={exporting}
                                                onClick={exportReport}
                                                style={{ backgroundColor: '#252444', borderColor: '#252444', color: '#fff' }}
                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#252444'; }}
                                        >
                                                {exporting ? 'Exporting…' : 'Download report'}
                                        </button>
                                </div>
                        </div>

                        <div className="d-flex gap-2">
                                <button
                                        className="btn btn-success"
                                        disabled={saving}
                                        onClick={save}
                                        style={{ backgroundColor: '#252444', borderColor: '#252444', color: '#fff' }}
                                >
                                        {saving ? 'Saving…' : 'Save settings'}
                                </button>
                        </div>
                </div>
        );
}
