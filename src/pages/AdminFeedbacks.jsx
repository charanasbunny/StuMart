import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentAdmin } from '../services/adminService';
import { getFeedbackForAdmin } from '../services/feedbackService';

export default function AdminFeedbacks() {
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadFeedbacks = async () => {
      const { admin, error: adminError } = await getCurrentAdmin();
      if (adminError || !admin) {
        navigate('/login?type=admin');
        return;
      }

      const result = await getFeedbackForAdmin();
      if (!result.success) {
        setError(result.error || 'Failed to load feedback.');
      }
      setFeedbacks(result.data || []);
      setIsLoading(false);
    };

    loadFeedbacks();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
            aria-label="Back to dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Student Feedback</h1>
            <p className="text-xs sm:text-sm text-gray-500">View submitted feedback from students</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {!error && feedbacks.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
            No feedback submitted yet.
          </div>
        )}

        {feedbacks.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2 sm:px-4 sm:py-3 font-medium">Name</th>
                  <th className="text-left px-3 py-2 sm:px-4 sm:py-3 font-medium">PIN</th>
                  <th className="text-left px-3 py-2 sm:px-4 sm:py-3 font-medium">Email</th>
                  <th className="text-left px-3 py-2 sm:px-4 sm:py-3 font-medium">Feedback</th>
                  <th className="text-left px-3 py-2 sm:px-4 sm:py-3 font-medium">Image</th>
                  <th className="text-left px-3 py-2 sm:px-4 sm:py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {feedbacks.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-3 py-2 sm:px-4 sm:py-4 text-gray-900">
                      {item.students?.name || 'Unknown'}
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-4 text-gray-700">
                      {item.students?.pin_number || 'N/A'}
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-4 text-gray-700">
                      {item.students?.email || 'N/A'}
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-4 text-gray-700 whitespace-pre-wrap">
                      {item.description}
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-4">
                      {item.image_url ? (
                        <a
                          href={item.image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-4 text-gray-600">
                      {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
