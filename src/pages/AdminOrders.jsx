import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentAdmin } from '../services/adminService';
import { getOrders, updateOrderStatus } from '../services/ordersService';
import AdminLayout from '../components/admin/AdminLayout';

export default function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' = all, 'pending', 'verified', 'delivered'
  const [updatingId, setUpdatingId] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const loadOrders = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const { admin, error: adminError } = await getCurrentAdmin();
      if (adminError || !admin) {
        navigate('/login?type=admin');
        return;
      }

      const result = await getOrders({ status: statusFilter || undefined });
      if (!result.success) {
        setError(result.error || 'Failed to load orders.');
      } else {
        setError('');
        setOrders(result.data || []);
      }
      setLastUpdated(new Date());
      if (isRefresh) setIsRefreshing(false);
      else setIsLoading(false);
    },
    [navigate, statusFilter]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadOrders]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    const result = await updateOrderStatus(orderId, newStatus);
    if (result.success) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } else {
      setError(result.error || 'Failed to update status.');
    }
    setUpdatingId(null);
  };

  const selectedOrder = detailId ? orders.find((o) => o.id === detailId) : null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600" />
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      title="Orders"
      subtitle="Verify payments and mark delivery. Students pay via QR and submit details here."
      lastUpdated={lastUpdated}
      onRefresh={() => loadOrders(true)}
      isRefreshing={isRefreshing}
    >
      <div className="max-w-6xl mx-auto space-y-4">
        {error && (
          <div className="admin-alert admin-alert--error">{error}</div>
        )}

        <div className="admin-card p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm font-medium text-gray-700">Filter:</span>
            {['', 'pending', 'verified', 'delivered'].map((s) => (
              <button
                key={s || 'all'}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {orders.length === 0 ? (
            <p className="text-gray-500 py-8 text-center">No orders found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Buyer</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Tx Ref</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const prod = o.products || {};
                    return (
                      <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700">
                          {new Date(o.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setDetailId(detailId === o.id ? null : o.id)}
                            className="text-indigo-600 hover:underline text-left"
                          >
                            {prod.title || o.product_id}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          {o.buyer_name || '—'} ({o.buyer_student_pin})
                        </td>
                        <td className="px-3 py-2 font-mono">₹{o.amount_paid}</td>
                        <td className="px-3 py-2 font-mono text-gray-600">{o.tx_reference}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              o.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : o.status === 'verified'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 flex flex-wrap gap-1">
                          {o.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(o.id, 'verified')}
                              disabled={updatingId === o.id}
                              className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
                            >
                              Verify
                            </button>
                          )}
                          {(o.status === 'pending' || o.status === 'verified') && (
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(o.id, 'delivered')}
                              disabled={updatingId === o.id}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                            >
                              Delivered
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedOrder && (
          <div className="admin-card p-4 border-2 border-indigo-200">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-gray-900">Order details</h3>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">Product</dt>
              <dd className="font-medium">{(selectedOrder.products || {}).title || selectedOrder.product_id}</dd>
              <dt className="text-gray-500">Buyer name</dt>
              <dd>{selectedOrder.buyer_name || '—'}</dd>
              <dt className="text-gray-500">Buyer PIN</dt>
              <dd className="font-mono">{selectedOrder.buyer_student_pin}</dd>
              <dt className="text-gray-500">Buyer email</dt>
              <dd>{selectedOrder.buyer_email || '—'}</dd>
              <dt className="text-gray-500">Amount paid</dt>
              <dd className="font-mono">₹{selectedOrder.amount_paid}</dd>
              <dt className="text-gray-500">Transaction reference</dt>
              <dd className="font-mono">{selectedOrder.tx_reference}</dd>
              <dt className="text-gray-500">Payment app</dt>
              <dd>{selectedOrder.payment_method}</dd>
              <dt className="text-gray-500">Delivery preference</dt>
              <dd>{selectedOrder.delivery_preference || '—'}</dd>
              <dt className="text-gray-500">Notes</dt>
              <dd>{selectedOrder.notes || '—'}</dd>
            </dl>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
