import React, { useState, useEffect } from 'react';

export default function History() {
        const [bookings, setBookings] = useState([]);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState('');

        useEffect(() => {
                // TODO: Implement API call to fetch user's booking history
                // For now, using mock data
                const mockBookings = [
                        {
                                id: 1,
                                roomName: 'Room 101',
                                buildingName: 'Building A',
                                date: '2024-01-15',
                                startTime: '09:00',
                                endTime: '11:00',
                                status: 'APPROVED',
                                reason: 'Study group meeting'
                        },
                        {
                                id: 2,
                                roomName: 'Room 205',
                                buildingName: 'Building B',
                                date: '2024-01-16',
                                startTime: '13:00',
                                endTime: '15:00',
                                status: 'PENDING',
                                reason: 'Project presentation practice'
                        },
                        {
                                id: 3,
                                roomName: 'Room 103',
                                buildingName: 'Building A',
                                date: '2024-01-14',
                                startTime: '15:00',
                                endTime: '17:00',
                                status: 'REJECTED',
                                reason: 'Group discussion'
                        }
                ];

                setTimeout(() => {
                        setBookings(mockBookings);
                        setLoading(false);
                }, 1000);
        }, []);

        const getStatusBadge = (status) => {
                const statusConfig = {
                        'APPROVED': { class: 'success', text: 'Approved' },
                        'PENDING': { class: 'warning', text: 'Pending' },
                        'REJECTED': { class: 'danger', text: 'Rejected' },
                        'CANCELLED': { class: 'secondary', text: 'Cancelled' }
                };

                const config = statusConfig[status] || { class: 'secondary', text: status };
                return <span className={`badge text-bg-${config.class}`}>{config.text}</span>;
        };

        const formatDate = (dateStr) => {
                const date = new Date(dateStr);
                return date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                });
        };

        if (loading) {
                return (
                        <div className="container-fluid p-4">
                                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                                        <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                        </div>
                                </div>
                        </div>
                );
        }

        if (error) {
                return (
                        <div className="container-fluid p-4">
                                <div className="alert alert-danger" role="alert">
                                        <i className="bi bi-exclamation-triangle me-2"></i>
                                        {error}
                                </div>
                        </div>
                );
        }

        return (
                <div className="container-fluid p-4">
                        <div className="row">
                                <div className="col-12">
                                        <div className="d-flex justify-content-between align-items-center mb-4">
                                                <h1 className="h3 mb-0">Booking History</h1>
                                                <div className="d-flex gap-2">
                                                        <button className="btn btn-outline-primary btn-sm">
                                                                <i className="bi bi-download me-1"></i>
                                                                Export
                                                        </button>
                                                </div>
                                        </div>

                                        {bookings.length === 0 ? (
                                                <div className="text-center py-5">
                                                        <i className="bi bi-clock-history text-muted" style={{ fontSize: '3rem' }}></i>
                                                        <h4 className="mt-3 text-muted">No bookings yet</h4>
                                                        <p className="text-muted">Your booking history will appear here once you make your first room booking.</p>
                                                        <a href="/rooms" className="btn btn-primary">Book a Room</a>
                                                </div>
                                        ) : (
                                                <div className="card border-0 shadow-sm">
                                                        <div className="card-body p-0">
                                                                <div className="table-responsive">
                                                                        <table className="table table-hover mb-0">
                                                                                <thead className="table-light">
                                                                                        <tr>
                                                                                                <th className="border-0">Room</th>
                                                                                                <th className="border-0">Date</th>
                                                                                                <th className="border-0">Time</th>
                                                                                                <th className="border-0">Reason</th>
                                                                                                <th className="border-0">Status</th>
                                                                                                <th className="border-0">Actions</th>
                                                                                        </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                        {bookings.map((booking) => (
                                                                                                <tr key={booking.id}>
                                                                                                        <td>
                                                                                                                <div>
                                                                                                                        <div className="fw-semibold">{booking.roomName}</div>
                                                                                                                        <div className="text-muted small">{booking.buildingName}</div>
                                                                                                                </div>
                                                                                                        </td>
                                                                                                        <td>{formatDate(booking.date)}</td>
                                                                                                        <td>
                                                                                                                {booking.startTime} - {booking.endTime}
                                                                                                        </td>
                                                                                                        <td>
                                                                                                                <div className="text-truncate" style={{ maxWidth: '200px' }} title={booking.reason}>
                                                                                                                        {booking.reason}
                                                                                                                </div>
                                                                                                        </td>
                                                                                                        <td>{getStatusBadge(booking.status)}</td>
                                                                                                        <td>
                                                                                                                <div className="btn-group btn-group-sm">
                                                                                                                        <button className="btn btn-outline-secondary" title="View Details">
                                                                                                                                <i className="bi bi-eye"></i>
                                                                                                                        </button>
                                                                                                                        {booking.status === 'PENDING' && (
                                                                                                                                <button className="btn btn-outline-danger" title="Cancel Booking">
                                                                                                                                        <i className="bi bi-x-circle"></i>
                                                                                                                                </button>
                                                                                                                        )}
                                                                                                                </div>
                                                                                                        </td>
                                                                                                </tr>
                                                                                        ))}
                                                                                </tbody>
                                                                        </table>
                                                                </div>
                                                        </div>
                                                </div>
                                        )}
                                </div>
                        </div>
                </div>
        );
}
