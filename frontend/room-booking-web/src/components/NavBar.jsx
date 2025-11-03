import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { openAdminEvents } from '../api';

export default function NavBar({ authed, user, onLogout }) {
        const [unread, setUnread] = useState(0);
        useEffect(() => {
                if (user?.role !== 'ADMIN') return;
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
        }, [user]);
        // optional: clear when viewing requests
        useEffect(() => {
                if (window.location.pathname.startsWith('/admin/requests')) setUnread(0);
        }, [window.location.pathname]);
        return (
                <nav className="navbar navbar-expand-lg bg-white border-bottom sticky-top">
                        <div className="container">
                                {/* BRAND: logo + title */}
                                <Link
                                        className="navbar-brand fw-semibold d-flex align-items-center"
                                        to={authed ? (user?.role === 'ADMIN' ? '/admin/overview' : '/rooms') : '/login'}
                                >
                                        <img
                                                src="/ams.png"
                                                alt="Department logo"
                                                width="70"
                                                height="30"
                                                className="me-2"
                                                style={{ objectFit: 'contain' }}
                                        />
                                        <span>Room-Booking</span>
                                </Link>

                                <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav">
                                        <span className="navbar-toggler-icon"></span>
                                </button>

                                <div id="nav" className="collapse navbar-collapse">
                                        <div className="ms-auto d-flex align-items-center gap-2">
                                                {authed ? (
                                                        <>
                                                                {user?.role === 'ADMIN' && (
                                                                        <Link
                                                                                to="/admin/requests"
                                                                                className="btn btn-sm btn-light position-relative d-inline-flex align-items-center justify-content-center rounded-circle"
                                                                                aria-label="Notifications"
                                                                                title="Notifications"
                                                                                style={{ width: 36, height: 36 }}
                                                                        >
                                                                                <i className="bi bi-bell"></i>
                                                                                {unread > 0 && (
                                                                                        <span
                                                                                                className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                                                                                                style={{
                                                                                                        fontSize: '10px',
                                                                                                        lineHeight: '12px',
                                                                                                        minWidth: '16px',
                                                                                                        height: '16px',
                                                                                                        display: 'inline-flex',
                                                                                                        alignItems: 'center',
                                                                                                        justifyContent: 'center',
                                                                                                        padding: 0,
                                                                                                }}
                                                                                        >
                                                                                                {unread > 99 ? '99+' : unread}
                                                                                        </span>
                                                                                )}
                                                                        </Link>
                                                                )}


                                                                {user?.role === 'ADMIN' && (
                                                                        <Link
                                                                                className="btn btn-sm d-inline-flex align-items-center"
                                                                                to="/admin/overview"
                                                                                style={{
                                                                                        '--bs-btn-bg': '#272446',
                                                                                        '--bs-btn-border-color': '#272446',
                                                                                        '--bs-btn-hover-bg': '#1f1d37',
                                                                                        '--bs-btn-hover-border-color': '#1f1d37',
                                                                                        '--bs-btn-color': '#fff'
                                                                                }}
                                                                        >
                                                                                <i className="bi bi-speedometer2 me-1"></i>
                                                                                Admin
                                                                        </Link>
                                                                )}

                                                                <button className="btn btn-outline-secondary btn-sm" onClick={onLogout}>
                                                                        <i className="bi bi-box-arrow-right me-1"></i> Logout
                                                                </button>
                                                        </>
                                                ) : (
                                                        <>
                                                                {/* Login: outline button in #c01d2e */}
                                                                <Link
                                                                        className="btn btn-outline-secondary btn-sm"
                                                                        to="/login"
                                                                        style={{
                                                                                '--bs-btn-color': '#c01d2e',
                                                                                '--bs-btn-border-color': '#c01d2e',
                                                                                '--bs-btn-hover-color': '#fff',
                                                                                '--bs-btn-hover-bg': '#c01d2e',
                                                                                '--bs-btn-hover-border-color': '#c01d2e',
                                                                                '--bs-btn-active-color': '#fff',
                                                                                '--bs-btn-active-bg': '#a61927',
                                                                                '--bs-btn-active-border-color': '#a61927'
                                                                        }}
                                                                >
                                                                        <i className="bi bi-box-arrow-in-right me-1"></i> Login
                                                                </Link>

                                                                {/* Register: solid button in #272445 */}
                                                                <Link
                                                                        className="btn btn-primary btn-sm"
                                                                        to="/register"
                                                                        style={{
                                                                                '--bs-btn-bg': '#272445',
                                                                                '--bs-btn-border-color': '#272445',
                                                                                '--bs-btn-hover-bg': '#1f1d37',
                                                                                '--bs-btn-hover-border-color': '#1f1d37',
                                                                                '--bs-btn-color': '#fff',
                                                                                '--bs-btn-active-bg': '#19182c',
                                                                                '--bs-btn-active-border-color': '#19182c'
                                                                        }}
                                                                >
                                                                        <i className="bi bi-person-plus me-1"></i> Register
                                                                </Link>
                                                        </>
                                                )}
                                        </div>
                                </div>
                        </div>
                </nav>
        );
}
