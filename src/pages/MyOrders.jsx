import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { getMyOrders } from '../services/ordersService';

function getFirstImage(imageUrls) {
  if (imageUrls && imageUrls.length > 0) return imageUrls[0];
  return 'https://via.placeholder.com/400x300?text=No+Image';
}

function formatPrice(price) {
  const n = parseInt(price, 10) || 0;
  return n === 0 ? 'FREE' : `₹ ${n}`;
}

function StatusBadge({ status }) {
  const config = {
    pending: { label: 'Ordered', className: 'bg-amber-100 text-amber-800' },
    verified: { label: 'Admin Verified', className: 'bg-blue-100 text-blue-800' },
    delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
  };
  const { label, className } = config[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-sm font-medium ${className}`}>
      {label}
    </span>
  );
}

export default function MyOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await getMyOrders();
      if (cancelled) return;
      if (result.success) {
        setOrders(result.data || []);
        setError('');
      } else {
        if (result.error?.includes('Not logged in')) {
          navigate('/login');
          return;
        }
        setError(result.error || 'Failed to load orders');
        setOrders([]);
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading your orders...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Orders</h1>
        <p className="text-gray-600 mb-6">
          Track your orders: Ordered → Admin Verified → Delivered
        </p>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <p className="text-gray-500 mb-4">You haven’t placed any orders yet.</p>
            <Link
              to="/products"
              className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {orders.map((order) => {
              const product = order.products || {};
              return (
                <li key={order.id} className="bg-white rounded-xl shadow overflow-hidden">
                  <Link
                    to={`/products/${order.product_id}`}
                    className="flex flex-col sm:flex-row gap-4 p-4 hover:bg-gray-50 transition"
                  >
                    <div className="w-full sm:w-28 h-28 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={getFirstImage(product.image_urls)}
                        alt={product.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-gray-900 truncate">{product.title || 'Product'}</h2>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {formatPrice(product.price)} · Paid ₹{order.amount_paid}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Ordered on {new Date(order.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <div className="mt-2">
                        <StatusBadge status={order.status} />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-6">
          <Link to="/profile" className="text-indigo-600 hover:underline text-sm">
            ← Back to Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
