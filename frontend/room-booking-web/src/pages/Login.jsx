import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';

export default function Login() {
        const [email, setEmail] = useState('');
        const [password, setPassword] = useState('');
        const [showPwd, setShowPwd] = useState(false);
        const [submitting, setSubmitting] = useState(false);
        const [error, setError] = useState('');
        const [hover, setHover] = useState(false); // for hover color
        const navigate = useNavigate();

        const PRIMARY = '#272446';
        const ACCENT = '#c01d2e';

        async function handleSubmit(e) {
                e.preventDefault();
                setError('');
                setSubmitting(true);
                try {
                        const { token, user } = await login(email, password);
                        localStorage.setItem('token', token);
                        localStorage.setItem('user', JSON.stringify(user));
                        if (user.role === 'ADMIN') {
                                navigate('/admin/overview', { replace: true });
                        } else {
                                navigate('/rooms', { replace: true });
                        }
                } catch (err) {
                        setError(err.message || 'Login failed');
                } finally {
                        setSubmitting(false);
                }
        }

        return (
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '70vh' }}>
                        <div className="card shadow-sm border-0 rounded-4" style={{ maxWidth: 440, width: '100%' }}>
                                <div className="card-body p-4 p-md-5">
                                        <div className="text-center mb-4">
                                                <h1 className="h4 mt-2 mb-0">Sign in</h1>
                                        </div>

                                        <form onSubmit={handleSubmit}>
                                                {error && <div className="alert alert-danger">{error}</div>}

                                                <div className="mb-3">
                                                        <label className="form-label" htmlFor="email">Email</label>
                                                        <input
                                                                id="email"
                                                                className="form-control"
                                                                type="email"
                                                                value={email}
                                                                onChange={(e) => setEmail(e.target.value)}
                                                                placeholder=""
                                                                autoComplete="email"
                                                                required
                                                                disabled={submitting}
                                                        />
                                                </div>

                                                {/* Password with inline eye toggle */}
                                                <div className="mb-3">
                                                        <label className="form-label" htmlFor="pwd">Password</label>
                                                        <div className="position-relative">
                                                                <input
                                                                        id="pwd"
                                                                        className="form-control"
                                                                        type={showPwd ? 'text' : 'password'}
                                                                        minLength={8}
                                                                        value={password}
                                                                        onChange={(e) => setPassword(e.target.value)}
                                                                        placeholder=""
                                                                        autoComplete="current-password"
                                                                        required
                                                                        disabled={submitting}
                                                                        style={{ paddingRight: '2.75rem' }}
                                                                />
                                                                <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-link text-secondary position-absolute top-50 end-0 translate-middle-y me-2 px-2 py-1"
                                                                        onClick={() => setShowPwd((s) => !s)}
                                                                        aria-label={showPwd ? 'Hide password' : 'Show password'}
                                                                        aria-pressed={showPwd}
                                                                        disabled={submitting}
                                                                >
                                                                        <i className={`bi ${showPwd ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                                                                </button>
                                                        </div>
                                                </div>

                                                {/* Brand-colored button (default = PRIMARY, hover = ACCENT) */}
                                                <button
                                                        className="btn w-100 text-white"
                                                        disabled={submitting}
                                                        style={{
                                                                backgroundColor: hover ? ACCENT : PRIMARY,
                                                                borderColor: hover ? ACCENT : PRIMARY
                                                        }}
                                                        onMouseEnter={() => setHover(true)}
                                                        onMouseLeave={() => setHover(false)}
                                                >
                                                        {submitting && <span className="spinner-border spinner-border-sm me-2" />}Sign in
                                                </button>
                                        </form>
                                </div>
                        </div>
                </div>
        );
}
