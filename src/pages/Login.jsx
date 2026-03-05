import React, { useEffect, useState } from 'react';
import { signIn, getCurrentUser } from '../services/authService';
import { adminSignIn } from '../services/adminService';
import { useNavigate, Link, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from '../services/supabaseClient';





export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const getLoginTypeFromParams = () => {
    const type = searchParams.get('type');
    return type === 'admin' ? 'admin' : 'student';
  };
  const [loginType, setLoginType] = useState(getLoginTypeFromParams());
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const successMessage = location.state?.message;

  useEffect(() => {
    const type = searchParams.get('type');
    if ((type === 'admin' || type === 'student') && type !== loginType) {
      setLoginType(type);
    }
  }, [loginType, searchParams]);

  // Avoid redirect loops: only auto-redirect when a fully linked student session exists.
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (loginType !== 'student') return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted || !session?.user) return;

      const current = await getCurrentUser();
      if (!mounted || !current?.user || !current?.student || current?.error) return;

      const returnUrl = searchParams.get('returnUrl');
      const path = returnUrl ? decodeURIComponent(returnUrl) : '/profile';
      navigate(path, { replace: true });
    })();
    return () => { mounted = false; };
  }, [loginType, navigate, searchParams]);

  /**
   * Validate email format
   */
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Validate form data on frontend
   */
  const validateForm = () => {
    const newErrors = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Minimum 6 characters';
    } else if (formData.password.length > 12) {
      newErrors.password = 'Maximum 12 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form input changes
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const [showPassword, setShowPassword] = useState(false);

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      if (loginType === 'admin') {
        const result = await adminSignIn(
          formData.email.trim().toLowerCase(),
          formData.password
        );

        if (result.success) {
          navigate('/admin/dashboard');
        } else {
          setErrors({ submit: result.error });
        }
      } else {
        // Call student sign-in service
        const result = await signIn(
          formData.email.trim().toLowerCase(),
          formData.password
        );

        if (result.success) {
          const returnUrl = searchParams.get('returnUrl');
          const path = returnUrl ? decodeURIComponent(returnUrl) : '/profile';
          navigate(path, { replace: true });
        } else {
          setErrors({ submit: result.error });
        }
      }
    } catch (error) {
      setErrors({ submit: error.message || 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-6 sm:px-6 lg:px-8 overflow-hidden">
      <div
        className="absolute inset-0 bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/bg-student-illustration.png.jpeg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-white/70" aria-hidden="true" />

      <div className="relative z-10 max-w-md w-full space-y-8">
        <div>
          <h2 className="font-display mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          {successMessage && (
            <div className="mt-3 rounded-md bg-green-50 p-3 border border-green-200">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}
          <p className="mt-2 text-center text-sm text-gray-600">
            {loginType === 'student' ? (
              <>
                Or{' '}
                <Link
                  to="/register"
                  className="font-medium text-indigo-600 hover:text-indigo-500"
                >
                  create a new student account
                </Link>
              </>
            ) : (
              'Admin access only'
            )}
          </p>
        </div>

        <div className="flex items-center justify-center">
          <div
            role="tablist"
            aria-label="Login type"
            className="inline-grid grid-cols-2 rounded-xl bg-gray-100/80 p-1 shadow-sm ring-1 ring-gray-200"
          >
            <button
              type="button"
              role="tab"
              aria-selected={loginType === 'student'}
              onClick={() => {
                setLoginType('student');
                setErrors({});
              }}
              className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                loginType === 'student'
                  ? 'bg-white text-gray-900 shadow ring-1 ring-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Student
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={loginType === 'admin'}
              onClick={() => {
                setLoginType('admin');
                setErrors({});
              }}
              className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                loginType === 'admin'
                  ? 'bg-white text-gray-900 shadow ring-1 ring-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Admin
            </button>
          </div>
        </div>

        <form className=" mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            {/* Email */}
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Email address"
              value={formData.email}
              onChange={handleChange}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="relative">
            <label htmlFor="password" className="sr-only">
              Password
            </label>

            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              autoComplete="current-password"
              required
              value={formData.password}
              onChange={handleChange}
              className="appearance-none rounded-md relative block w-full px-3 py-2 pr-11 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Password"
            />

            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-md p-1.5 text-gray-500 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.4}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.02.152-2.004.437-2.93M6.343 6.343A9.956 9.956 0 0112 5c5.523 0 10 4.477 10 10a9.956 9.956 0 01-1.343 5.657M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.4}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>

            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password}</p>
            )}
          </div>
          <div className="text-sm text-right mt-2">
            <Link
              to="/forgot-password"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Forgot your password?
            </Link>
          </div>
          {/* Error Message */}
          {errors.submit && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">
                    {errors.submit}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="cursor-pointer group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}