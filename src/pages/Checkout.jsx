import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getProductById } from '../services/productService';
import { getCurrentUser } from '../services/authService';
import { createOrder, createGatewayOrder, verifyGatewayPayment } from '../services/ordersService';

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID ?? '';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

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
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    amount_paid: '',
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

  useEffect(() => {
    let mounted = true;
    loadRazorpayScript().then((ok) => {
      if (mounted) setRazorpayReady(ok);
    });
    return () => {
      mounted = false;
    };
  }, []);

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

    if (expectedTotal > 0 && (!RAZORPAY_KEY_ID || !razorpayReady)) {
      setError('Payment gateway is not configured. Set VITE_RAZORPAY_KEY_ID and retry.');
      return;
    }

    // Free items skip gateway and directly create order.
    if (expectedTotal === 0) {
      setSubmitLoading(true);
      const freeResult = await createOrder({
        product_id: product.id,
        buyer_student_pin: student.pin_number,
        buyer_name: student.name || null,
        buyer_email: student.email || null,
        amount_paid: amount,
        tx_reference: 'FREE_ITEM',
        payment_method: 'Free',
        delivery_preference: form.delivery_preference.trim() || null,
        notes: form.notes.trim() || null,
      });
      setSubmitLoading(false);
      if (freeResult.success) setSuccess(true);
      else setError(freeResult.error || 'Failed to submit. Please try again.');
      return;
    }

    setSubmitLoading(true);
    const gatewayOrder = await createGatewayOrder({
      amount: amount * 100, // paise
      currency: 'INR',
      // Razorpay receipt max length is 40 chars.
      receipt: `gvl-${String(product.id).slice(0, 12)}-${Date.now().toString().slice(-10)}`,
      productId: product.id,
      notes: {
        productId: product.id,
        buyerPin: student.pin_number,
      },
    });

    if (!gatewayOrder.success || !gatewayOrder.data?.id) {
      setSubmitLoading(false);
      setError(gatewayOrder.error || 'Failed to initialize payment.');
      return;
    }

    const options = {
      key: RAZORPAY_KEY_ID,
      amount: gatewayOrder.data.amount,
      currency: gatewayOrder.data.currency,
      name: 'GvlPolyMart',
      description: `Payment for ${product.title}`,
      order_id: gatewayOrder.data.id,
      prefill: {
        name: student.name || '',
        email: student.email || '',
      },
      notes: {
        productId: String(product.id),
        buyerPin: String(student.pin_number),
      },
      theme: { color: '#4f46e5' },
      handler: async (response) => {
        const verify = await verifyGatewayPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });

        if (!verify.success) {
          setSubmitLoading(false);
          setError(verify.error || 'Payment verification failed.');
          return;
        }

        const result = await createOrder({
          product_id: product.id,
          buyer_student_pin: student.pin_number,
          buyer_name: student.name || null,
          buyer_email: student.email || null,
          amount_paid: amount,
          tx_reference: response.razorpay_payment_id,
          payment_method: 'Razorpay',
          delivery_preference: form.delivery_preference.trim() || null,
          notes: form.notes.trim() || null,
        });

        setSubmitLoading(false);
        if (result.success) setSuccess(true);
        else setError(result.error || 'Payment succeeded but order creation failed.');
      },
      modal: {
        ondismiss: () => {
          setSubmitLoading(false);
          setError('Payment was cancelled.');
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
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
          <p className="text-gray-500 text-sm mb-6">Payment completed. We will contact you for delivery.</p>
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
          {/* Left: Summary + Gateway */}
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
                <p className={`mt-1 text-lg font-bold text-indigo-600 ${isGuestRestricted ? 'blur-sm select-none' : ''}`}>
                  {total > 0 ? `₹${total}` : 'FREE'}
                </p>
                <p className="text-sm text-gray-500 text-center mt-2">
                  {total > 0
                    ? 'Secure payment powered by Razorpay (UPI / cards / netbanking).'
                    : 'No payment required for free items.'}
                </p>
                {total > 0 && !RAZORPAY_KEY_ID && (
                  <p className="text-xs text-red-500 mt-2 text-center">
                    Set VITE_RAZORPAY_KEY_ID in environment to enable checkout.
                  </p>
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
                {submitLoading
                  ? 'Processing…'
                  : isGuestRestricted
                    ? 'Registered Students Only'
                    : total > 0
                      ? (razorpayReady ? `Pay ₹${total}` : 'Loading Payment...')
                      : 'Confirm Free Order'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
