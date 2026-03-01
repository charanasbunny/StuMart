import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { getApprovedRequestByToken, claimApprovedRegistration } from '../services/registrationService';
import { signUpPasswordOnly } from '../services/authService';

export default function CompleteSignup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Missing link. Ask admin for the approval link.');
      setLoading(false);
      return;
    }
    (async () => {
      const result = await getApprovedRequestByToken(token);
      setLoading(false);
      if (result.success && result.data) setRequest(result.data);
      else setError(result.error || 'Invalid or expired link.');
    })();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitLoading(true);
    try {
      const signUpResult = await signUpPasswordOnly(request.email, password);
      if (!signUpResult.success) {
        setError(signUpResult.error || 'Could not create account.');
        setSubmitLoading(false);
        return;
      }
      const claimResult = await claimApprovedRegistration(token);
      if (!claimResult.success) {
        const msg = claimResult.error || 'Could not complete registration.';
        setError(msg.includes('already registered') ? 'This email is already registered. Please log in.' : msg);
        setSubmitLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate('/login', { state: { message: 'Account created. Check your email to confirm and then log in.' } }), 3000);
    } catch (err) {
      const msg = err.message || 'Something went wrong.';
      setError(msg.includes('already registered') || msg.includes('duplicate key') ? 'This email is already registered. Please log in.' : msg);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link to="/register" className="text-indigo-600 font-semibold">Back to registration</Link>
          <span className="mx-2">|</span>
          <Link to="/login" className="text-indigo-600 font-semibold">Login</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Account created</h2>
          <p className="mt-2 text-gray-600">Check your email and click the confirmation link, then log in.</p>
          <p className="mt-4 text-sm text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 text-center">Complete your registration</h1>
        <p className="mt-2 text-gray-600 text-center text-sm">Set a password for your StuMart account.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={request.email}
              readOnly
              className="mt-1 block w-full px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="mt-1 block w-full px-4 py-2 rounded-lg border border-gray-300"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              className="mt-1 block w-full px-4 py-2 rounded-lg border border-gray-300"
              required
            />
          </div>
          {error && (
            <div className="text-sm text-red-600">
              <p>{error}</p>
              {(error.includes('already registered') || error.includes('duplicate')) && (
                <Link to="/login" className="inline-block mt-2 text-indigo-600 font-semibold hover:underline">
                  Go to login →
                </Link>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={submitLoading}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitLoading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          <Link to="/login" className="text-indigo-600 font-semibold">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
