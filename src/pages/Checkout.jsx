import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getProductById } from '../services/productService';
import { getCurrentUser } from '../services/authService';
import { createOrder } from '../services/ordersService';

// Replace with your actual UPI ID or set via env (e.g. import.meta.env.VITE_UPI_ID)
const UPI_ID = import.meta.env.VITE_UPI_ID || 'gvlpolymart@upi';

const PAYMENT_APPS = ['GPay', 'PhonePe', 'Paytm', 'Other'];

export default function Checkout() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    amount_paid: '',
    tx_reference: '',
    payment_method: 'GPay',
    delivery_preference: '',
    notes: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { user, student: s, error: userError } = await getCurrentUser();
      if (userError || !user || !s) {
        if (!cancelled) {
          setError('Please log in to place an order.');
          setLoading(false);
        }
        return;
      }

      const res = await getProductById(productId);
      if (!res.success || !res.data) {
        if (!cancelled) {
          setError(res.error || 'Product not found');
          setLoading(false);
        }
        return;
      }

      if (res.data.status !== 'active') {
        if (!cancelled) {
          setError('This product is no longer available.');
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setProduct(res.data);
        setStudent(s);
        setForm((prev) => ({ ...prev, amount_paid: String(res.data.price || '') }));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [productId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const amount = parseInt(form.amount_paid, 10);
    if (!amount || amount < 0) {
      setError('Please enter a valid amount paid.');
      return;
    }
    if (!form.tx_reference.trim()) {
      setError('Please enter the transaction ID / UPI reference.');
      return;
    }

    setSubmitLoading(true);
    const result = await createOrder({
      product_id: product.id,
      buyer_student_pin: student.pin_number,
      buyer_name: student.name || null,
      buyer_email: student.email || null,
      amount_paid: amount,
      tx_reference: form.tx_reference.trim(),
      payment_method: form.payment_method,
      delivery_preference: form.delivery_preference.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSubmitLoading(false);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error || 'Failed to submit. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!product || !student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Product or session not found.'}</p>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="text-indigo-600 hover:underline"
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Details submitted</h1>
          <p className="text-gray-600 mb-6">
            Admin will verify your payment and contact you for delivery.
          </p>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  const price = parseInt(product.price, 10) || 0;
  const priceLabel = price === 0 ? 'FREE' : `₹ ${price}`;
  const seller = product.students || {};
  const qrAmount = price > 0 ? price : 1;
  const upiPayload = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=GVL%20Polymart&am=${qrAmount}&tn=${encodeURIComponent(product.title || 'Order')}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiPayload)}`;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pay &amp; Request Delivery</h1>
        <p className="text-gray-600 mb-6">
          Step 1: Scan the QR and pay. Step 2: Fill the form below. Admin will verify and contact you.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* QR + amount */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Scan &amp; Pay</h2>
            <div className="flex flex-col items-center">
              <img src={qrUrl} alt="UPI QR Code" className="w-48 h-48 object-contain border border-gray-200 rounded-lg" />
              <p className="mt-3 text-lg font-semibold text-indigo-600">{priceLabel}</p>
              <p className="text-sm text-gray-500 mt-1">UPI ID: {UPI_ID}</p>
              <p className="text-xs text-gray-500 mt-1">Add note: {product.title} (PIN: {student.pin_number})</p>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Payment &amp; Delivery Details</h2>

            <div className="space-y-3 mb-4 text-sm text-gray-600">
              <p><span className="font-medium text-gray-700">Product:</span> {product.title}</p>
              <p><span className="font-medium text-gray-700">Seller:</span> {seller.name || 'N/A'} (PIN: {seller.pin_number || 'N/A'})</p>
              <p><span className="font-medium text-gray-700">You:</span> {student.name || 'N/A'} (PIN: {student.pin_number})</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid (₹) *</label>
                <input
                  type="number"
                  name="amount_paid"
                  min="0"
                  value={form.amount_paid}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID / UPI Reference *</label>
                <input
                  type="text"
                  name="tx_reference"
                  value={form.tx_reference}
                  onChange={handleChange}
                  placeholder="e.g. 123456789012"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment App</label>
                <select
                  name="payment_method"
                  value={form.payment_method}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {PAYMENT_APPS.map((app) => (
                    <option key={app} value={app}>{app}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Preference</label>
                <input
                  type="text"
                  name="delivery_preference"
                  value={form.delivery_preference}
                  onChange={handleChange}
                  placeholder="e.g. Meet at library, Department block"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes for Admin (optional)</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Any extra details..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitLoading}
                className="w-full py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitLoading ? 'Submitting...' : 'Submit Payment Details'}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => navigate(`/products/${productId}`)}
            className="text-indigo-600 hover:underline text-sm"
          >
            ← Back to product
          </button>
        </div>
      </div>
    </div>
  );
}
