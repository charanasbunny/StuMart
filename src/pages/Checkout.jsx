import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getProductById } from '../services/productService';
import { getCurrentUser } from '../services/authService';
import { createOrder } from '../services/ordersService';

// Set in .env / Vercel: VITE_UPI_ID (no fallback in repo for security)
const UPI_ID = import.meta.env.VITE_UPI_ID ?? '';

const PAYMENT_APPS = ['GPay', 'PhonePe', 'Paytm', 'Other'];

/**
 * Payment breakdown: +10% fee below ₹200, +5% fee on ₹200 and above.
 * Free items (₹0) have no fee.
 */
function getPaymentBreakdown(price) {
  const basePrice = parseInt(price, 10) || 0;
  if (basePrice === 0) {
    return { basePrice: 0, feePercent: 0, feeAmount: 0, total: 0 };
  }
  const feePercent = basePrice < 200 ? 10 : 5;
  const feeAmount = Math.round(basePrice * (feePercent / 100));
  const total = basePrice + feeAmount;
  return { basePrice, feePercent, feeAmount, total };
}

export default function Checkout() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [student, setStudent] = useState(null);
  const [isGuestRestricted, setIsGuestRestricted] = useState(false);
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
      const isEligibleStudent = Boolean(user && s && !userError);

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
        setStudent(isEligibleStudent ? s : null);
        setIsGuestRestricted(!isEligibleStudent);
        const { total } = getPaymentBreakdown(res.data.price);
        setForm((prev) => ({ ...prev, amount_paid: String(total) }));
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

    if (isGuestRestricted) {
      setError('Only registered students can make payments and submit orders.');
      return;
    }

    if (!product || !student) {
      setError('Session or product unavailable. Please go back to the product and try again.');
      return;
    }

    const amount = parseInt(form.amount_paid, 10);
    const { total: expectedTotal } = getPaymentBreakdown(product.price);
    if (!amount || amount < 0) {
      setError('Please enter a valid amount paid.');
      return;
    }
    if (amount !== expectedTotal) {
      setError(`Please enter the total amount ₹${expectedTotal} (product + platform fee).`);
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
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 text-sm mb-4">{error || 'Something went wrong.'}</p>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="text-indigo-600 hover:underline text-sm"
          >
            Back to products
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-sm text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Done</h1>
          <p className="text-gray-500 text-sm mb-6">We’ll verify and contact you for delivery.</p>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700"
          >
            Back to products
          </button>
        </div>
      </div>
    );
  }

  const breakdown = getPaymentBreakdown(product.price);
  const { basePrice, feeAmount, total } = breakdown;
  const seller = product.students || {};
  const qrAmount = total > 0 ? total : 1;
  const hasUpi = Boolean(UPI_ID);
  const upiPayload = hasUpi ? `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=GVL%20Polymart&am=${qrAmount}&tn=${encodeURIComponent(product.title || 'Order')}` : '';
  const qrUrl = hasUpi ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiPayload)}` : '';

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(`/products/${productId}`)}
          className="flex items-center gap-1.5 text-gray-600 hover:text-indigo-600 text-sm mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {isGuestRestricted && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <h1 className="text-sm sm:text-base font-semibold text-amber-900">
              Payment access is limited to registered students.
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-amber-800">
              Please sign in with a registered student account to complete payment submission and order confirmation.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 mb-6">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 text-xs font-semibold">1</span>
          <span className="text-gray-400 text-sm">Pay</span>
          <span className="flex-1 h-px bg-gray-200 max-w-8" />
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-400 text-xs font-semibold">2</span>
          <span className="text-gray-400 text-sm">Confirm</span>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* Left: Summary + QR */}
          <div className="space-y-5">
            {/* Platform fee info */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-indigo-900 mb-2">Platform fee</p>
              <ul className="text-xs text-indigo-800 space-y-1">
                <li className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  Below ₹200 → 10% fee
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  ₹200 & above → 5% fee
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900 text-sm">Summary</h2>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Item</span>
                  <span className="font-medium text-gray-900">{basePrice === 0 ? 'FREE' : `₹${basePrice}`}</span>
                </div>
                {basePrice > 0 && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-600">
                      Platform fee
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-medium ${basePrice < 200 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {basePrice < 200 ? '10% (below ₹200)' : '5% (₹200+)'}
                      </span>
                    </span>
                    <span className="text-gray-700 font-medium">₹{feeAmount}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-100 text-base font-semibold">
                  <span className="text-gray-900">Total</span>
                  <span className={total > 0 ? 'text-indigo-600' : 'text-green-600'}>
                    {total > 0 ? `₹${total}` : 'FREE'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-col items-center">
                {hasUpi ? (
                  <>
                    <div
                      className={`p-2 bg-white rounded-lg border border-gray-200 inline-block ${isGuestRestricted ? 'blur-sm pointer-events-none select-none' : ''}`}
                      aria-hidden={isGuestRestricted}
                    >
                      <img src={qrUrl} alt="Pay with UPI" className="w-40 h-40 object-contain" />
                    </div>
                    <p className={`mt-3 text-lg font-bold text-indigo-600 ${isGuestRestricted ? 'blur-sm select-none' : ''}`}>
                      {total > 0 ? `₹${total}` : 'FREE'}
                    </p>
                    <p className={`text-xs text-gray-400 mt-1 ${isGuestRestricted ? 'blur-sm select-none' : ''}`}>{UPI_ID}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 text-center">Set VITE_UPI_ID in your environment to show UPI payment.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Details</h2>

            <div className="flex flex-col gap-1.5 mb-5 text-sm text-gray-600">
              <div className="flex justify-between gap-2">
                <span>Item</span>
                <span className="text-gray-900 font-medium truncate text-right">{product.title}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Seller</span>
                <span className="text-gray-900 truncate text-right">{seller.name || '—'} ({seller.pin_number || '—'})</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  name="amount_paid"
                  min="0"
                  value={form.amount_paid}
                  onChange={handleChange}
                  required
                  disabled={isGuestRestricted}
                  readOnly={total > 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 read-only:bg-gray-100 read-only:cursor-default text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID</label>
                <input
                  type="text"
                  name="tx_reference"
                  value={form.tx_reference}
                  onChange={handleChange}
                  placeholder="From UPI app"
                  required
                  disabled={isGuestRestricted}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">App</label>
                <select
                  name="payment_method"
                  value={form.payment_method}
                  onChange={handleChange}
                  disabled={isGuestRestricted}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {PAYMENT_APPS.map((app) => (
                    <option key={app} value={app}>{app}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery</label>
                <input
                  type="text"
                  name="delivery_preference"
                  value={form.delivery_preference}
                  onChange={handleChange}
                  placeholder="e.g. Library"
                  disabled={isGuestRestricted}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <input
                  type="text"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Optional"
                  disabled={isGuestRestricted}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitLoading || isGuestRestricted}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2"
              >
                {submitLoading ? 'Submitting…' : isGuestRestricted ? 'Registered Students Only' : 'Submit'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
