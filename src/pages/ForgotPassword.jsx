import React, { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordReset } from "../services/authService";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const result = await sendPasswordReset(email.trim().toLowerCase());
      setMessage(
        result.success
          ? "A reset link has been sent to your email. Check your inbox and use the link to set a new password."
          : result.error
      );
    } catch {
      setMessage("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Reset your password</h2>
        <p className="text-sm text-gray-600 mb-4">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {message && (
          <p className={`mt-3 text-sm ${message.includes("sent") ? "text-green-700" : "text-red-600"}`}>
            {message}
          </p>
        )}

        <p className="mt-4 text-center text-sm text-gray-600">
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
