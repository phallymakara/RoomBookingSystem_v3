// src/pages/admin/AdminLayout.jsx
import { useEffect, useState } from 'react';
import { openAdminEvents } from '../../api';
import { NavLink, Outlet } from 'react-router-dom';

const COLORS = { primary: '#272446', accent: '#c01d2e' };
const DUR = 280;
const EASE = 'cubic-bezier(.2,.8,.2,1)';
const SIDEBAR_W = 260;   // expanded width
const RAIL_W = 64;       // collapsed icon-only width

export default function AdminLayout() {
        const [sidebarOpen, setSidebarOpen] = useState(true);

        const [unread, setUnread] = useState(0);
        useEffect(() => {
                const token = localStorage.getItem('token') || '';
                if (!token) return;
                const es = openAdminEvents(token);
                es.onmessage = (ev) => {
                        try {
                                const msg = JSON.parse(ev.data);
                                if (msg?.type === 'BOOKING_REQUEST_CREATED') setUnread(u => u + 1);
                        } catch { }
                };
                return () => es.close();
        }, []);

        return (
                // Admin shell: fill viewport minus navbar, NO outer scroll
                <div
                        className="container-fluid p-0"
                        style={{ height: 'calc(100vh - 56px)', overflow: 'hidden' }}
                >
                        <div className="d-flex h-100" style={{ overflow: 'hidden' }}>
                                {/* ==== Sidebar / Rail ==== */}
                                <aside
                                        className="border-end bg-white position-relative d-flex flex-column"
                                        style={{
                                                width: sidebarOpen ? SIDEBAR_W : RAIL_W,
                                                flex: `0 0 ${sidebarOpen ? SIDEBAR_W : RAIL_W}px`,
                                                overflow: 'hidden',
                                                transition: [
                                                        `width ${DUR}ms ${EASE}`,
                                                        `flex-basis ${DUR}ms ${EASE}`,
                                                ].join(', '),
                                                willChange: 'width,flex-basis',
                                                zIndex: 1029,
                                                pointerEvents: 'auto',
                                        }}
                                        aria-expanded={sidebarOpen}
                                >
                                        {/* Toggle button (both states) */}
                                        <div
                                                className="d-flex p-2 border-bottom position-sticky top-0 bg-white"
                                                style={{ zIndex: 1, justifyContent: sidebarOpen ? 'flex-end' : 'center' }}
                                        >
                                                <button
                                                        type="button"
                                                        className="btn d-inline-flex align-items-center justify-content-center rounded-circle"
                                                        onClick={() => setSidebarOpen(v => !v)}
                                                        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                                                        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                                                        style={{
                                                                width: 36,
                                                                height: 36,
                                                                border: '1px solid rgba(0,0,0,.1)',
                                                                background: '#fff',
                                                                transition: `transform ${DUR}ms ${EASE}, box-shadow ${DUR}ms ${EASE}`,
                                                        }}
                                                        onMouseEnter={(e) => {
                                                                e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,.12)';
                                                                e.currentTarget.style.transform = 'translateX(0) scale(1.03)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                                e.currentTarget.style.boxShadow = 'none';
                                                                e.currentTarget.style.transform = 'none';
                                                        }}
                                                >
                                                        <i className={`bi ${sidebarOpen ? 'bi-chevron-left' : 'bi-chevron-right'}`}></i>
                                                </button>
                                        </div>

                                        {/* Nav */}
                                        <nav className={'nav flex-column p-2 ' + (sidebarOpen ? 'px-3' : 'px-2')} style={{ gap: 6 }}>
                                                <AdminLink to="/admin/overview" icon="bi-speedometer2" label="Overview" collapsed={!sidebarOpen} />
                                                <AdminLink to="/admin/floors" icon="bi-columns" label="Building" collapsed={!sidebarOpen} />
                                                <AdminLink to="/admin/rooms" icon="bi-door-closed" label="Rooms" collapsed={!sidebarOpen} />
                                                <AdminLink to="/admin/requests" icon="bi-bell" label={`Requests${unread ? ` (${unread})` : ''}`} collapsed={!sidebarOpen} />
                                                <AdminLink to="/admin/historys" icon="bi-bar-chart" label="History" collapsed={!sidebarOpen} />
                                                <AdminLink to="/admin/settings" icon="bi-gear" label="Setting" collapsed={!sidebarOpen} />
                                        </nav>

                                        {/* Footer */}
                                        <div
                                                className="text-secondary small px-3 pb-3 mt-auto"
                                                style={{
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        opacity: sidebarOpen ? 0.9 : 0.6,
                                                        transition: `opacity ${DUR}ms ${EASE}`,
                                                }}
                                                title="Room-Booking"
                                        >
                                                <span style={{ display: sidebarOpen ? 'inline' : 'none' }}>Room-Booking</span>
                                                {!sidebarOpen && (
                                                        <div className="w-100 text-center">
                                                                <i className="bi bi-layout-sidebar-inset"></i>
                                                        </div>
                                                )}
                                        </div>
                                </aside>

                                {/* ==== Main: child pages handle their own scrolling ==== */}
                                <main className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0, overflow: 'hidden' }}>
                                        <div className="flex-grow-1 d-flex flex-column" style={{ overflow: 'hidden' }}>
                                                <div className="h-100" style={{ overflow: 'hidden' }}>
                                                        <Outlet />
                                                </div>
                                        </div>
                                </main>
                        </div>
                </div>
        );
}

// src/pages/admin/AdminLayout.jsx (or wherever AdminLink is declared)
function AdminLink({ to, icon, label, collapsed }) {
        const base =
                'nav-link d-flex align-items-center rounded-3 position-relative';

        return (
                <NavLink
                        to={to}
                        className={({ isActive }) =>
                                [
                                        base,
                                        collapsed ? 'justify-content-center py-2' : 'px-3 py-2',
                                        isActive ? 'text-white shadow-sm' : ''
                                ]
                                        .filter(Boolean)
                                        .join(' ')
                        }
                        style={({ isActive }) => ({
                                color: isActive ? '#fff' : COLORS.primary,
                                backgroundColor: isActive ? COLORS.primary : 'transparent',
                                transition: `background-color ${DUR}ms ${EASE}, color ${DUR}ms ${EASE}, transform ${DUR}ms ${EASE}, padding ${DUR}ms ${EASE}`,
                                paddingLeft: collapsed ? 0 : 12,
                                paddingRight: collapsed ? 0 : 12
                        })}
                        title={collapsed ? label : undefined}
                        onMouseEnter={(e) => {
                                const active = e.currentTarget.classList.contains('text-white');
                                if (!active) {
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                        e.currentTarget.style.backgroundColor = 'rgba(39,36,70,.06)';
                                }
                        }}
                        onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none';
                                const active = e.currentTarget.classList.contains('text-white');
                                if (!active) {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                }
                        }}
                >
                        {/* indicator bar (optional, for collapsed) */}
                        <span
                                className="position-absolute start-0 top-0 h-100"
                                style={{
                                        width: collapsed ? 3 : 0,
                                        backgroundColor: COLORS.accent,
                                        borderTopRightRadius: 4,
                                        borderBottomRightRadius: 4,
                                        opacity: 0
                                }}
                        />

                        <i className={`bi ${icon} ${collapsed ? '' : 'me-2'}`} />

                        {/* IMPORTANT: use classes to show/hide; avoid inline display toggles */}
                        <span className={collapsed ? 'd-none' : 'd-inline'} style={{ whiteSpace: 'nowrap' }}>
                                {label}
                        </span>
                </NavLink>
        );
}
