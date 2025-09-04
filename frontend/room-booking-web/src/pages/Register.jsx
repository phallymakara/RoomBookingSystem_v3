import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register as apiRegister, login } from '../api';

export default function Register() {
        const [name, setName] = useState('');
        const [email, setEmail] = useState('');
        const [pwd, setPwd] = useState('');
        const [confirm, setConfirm] = useState('');
        const [showPwd, setShowPwd] = useState(false);
        const [submitting, setSubmitting] = useState(false);
        const [error, setError] = useState('');
        const [hover, setHover] = useState(false); // hover color for button
        const navigate = useNavigate();

        const PRIMARY = '#272446';
        const ACCENT = '#c01d2e';

        async function handleSubmit(e) {
                e.preventDefault();
                setError('');
                if (pwd !== confirm) {
                        setError('Passwords do not match');
                        return;
                }
                setSubmitting(true);
                try {
                        await apiRegister(name, email, pwd);
                        const { token, user } = await login(email, pwd); // auto-login after signup
                        localStorage.setItem('token', token);
                        localStorage.setItem('user', JSON.stringify(user));
                        navigate('/rooms', { replace: true });
                } catch (err) {
                        setError(err.message || 'Registration failed');
                } finally {
                        setSubmitting(false);
                }
        }

        return (
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '70vh' }}>
                        <div className="card shadow-sm border-0 rounded-4" style={{ maxWidth: 520, width: '100%' }}>
                                <div className="card-body p-4 p-md-5">
                                        <div className="text-center mb-4">
                                                {/* icon removed */}
                                                <h1 className="h4 mt-2 mb-0">Sign Up</h1>
                                                {/* subtitle removed */}
                                        </div>

                                        <form onSubmit={handleSubmit}>
                                                {error && <div className="alert alert-danger">{error}</div>}

                                                <div className="mb-3">
                                                        <label className="form-label" htmlFor="name">Full name</label>
                                                        <input
                                                                id="name"
                                                                className="form-control"
                                                                value={name}
                                                                onChange={e => setName(e.target.value)}
                                                                placeholder="Your name"
                                                                required
                                                                disabled={submitting}
                                                        />
                                                </div>

                                                <div className="mb-3">
                                                        <label className="form-label" htmlFor="email">Email</label>
                                                        <input
                                                                id="email"
                                                                className="form-control"
                                                                type="email"
                                                                value={email}
                                                                onChange={e => setEmail(e.target.value)}
                                                                placeholder=""
                                                                autoComplete="email"
                                                                required
                                                                disabled={submitting}
                                                        />
                                                </div>

                                                <div className="mb-3">
                                                        <label className="form-label" htmlFor="pwd">Password</label>
                                                        <div className="input-group">
                                                                <input
                                                                        id="pwd"
                                                                        className="form-control"
                                                                        type={showPwd ? 'text' : 'password'}
                                                                        value={pwd}
                                                                        minLength={8}
                                                                        onChange={e => setPwd(e.target.value)}
                                                                        placeholder=""
                                                                        autoComplete="new-password"
                                                                        required
                                                                        disabled={submitting}
                                                                />
                                                                <button
                                                                        type="button"
                                                                        className="btn btn-outline-secondary"
                                                                        onClick={() => setShowPwd(s => !s)}
                                                                        aria-label={showPwd ? 'Hide password' : 'Show password'}
                                                                        aria-pressed={showPwd}
                                                                        disabled={submitting}
                                                                >
                                                                        <i className={`bi ${showPwd ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                                                                </button>
                                                        </div>
                                                </div>

                                                <div className="mb-4">
                                                        <label className="form-label" htmlFor="confirm">Confirm password</label>
                                                        <input
                                                                id="confirm"
                                                                className="form-control"
                                                                type={showPwd ? 'text' : 'password'}
                                                                value={confirm}
                                                                minLength={8}
                                                                onChange={e => setConfirm(e.target.value)}
                                                                autoComplete="new-password"
                                                                required
                                                                disabled={submitting}
                                                        />
                                                </div>

                                                {/* Brand-colored button */}
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
                                                        {submitting && <span className="spinner-border spinner-border-sm me-2" />}
                                                        Create account
                                                </button>
                                        </form>
                                </div>
                        </div>
                </div>
        );
}
