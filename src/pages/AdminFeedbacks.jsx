import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentAdmin } from '../services/adminService';
import { deleteFeedbackAsAdmin, getFeedbackForAdmin } from '../services/feedbackService';
import useDebouncedValue from '../hooks/useDebouncedValue';
import AdminLayout from '../components/admin/AdminLayout';

export default function AdminFeedbacks() {
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [expandedIds, setExpandedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 250);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const loadFeedbacks = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const { admin, error: adminError } = await getCurrentAdmin();
      if (adminError || !admin) {
        navigate('/login?type=admin');
        return;
      }

      const result = await getFeedbackForAdmin();
      if (!result.success) {
        setError(result.error || 'Failed to load feedback.');
      } else {
        setError('');
      }
      setFeedbacks(result.data || []);
      setLastUpdated(new Date());

      if (isRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFeedbacks();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadFeedbacks]);


  const handleDelete = async (feedbackId) => {
    if (!window.confirm('Delete this feedback? This cannot be undone.')) {
      return;
    }

    setDeletingId(feedbackId);
    const result = await deleteFeedbackAsAdmin(feedbackId);
    if (!result.success) {
      setError(result.error || 'Failed to delete feedback.');
    } else {
      setFeedbacks((prev) => prev.filter((item) => item.id !== feedbackId));
    }
    setDeletingId(null);
  };

  const toggleExpanded = (feedbackId) => {
    setExpandedIds((prev) =>
      prev.includes(feedbackId)
        ? prev.filter((id) => id !== feedbackId)
        : [...prev, feedbackId]
    );
  };

  const filteredFeedbacks = feedbacks.filter((item) => {
    if (!debouncedSearch.trim()) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      item.description?.toLowerCase().includes(q) ||
      item.students?.name?.toLowerCase().includes(q) ||
      item.students?.pin_number?.toLowerCase().includes(q) ||
      item.students?.email?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredFeedbacks.length / pageSize));
  const clampedPage = Math.min(currentPage, totalPages);
  const pagedFeedbacks = filteredFeedbacks.slice(
    (clampedPage - 1) * pageSize,
    clampedPage * pageSize
  );

  const getPreview = (text, max = 140) => {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max)}...` : text;
  };

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
    <AdminLayout
      title="Student Feedback"
      subtitle="Review submissions from students."
      lastUpdated={lastUpdated}
      onRefresh={() => loadFeedbacks(true)}
      isRefreshing={isRefreshing}
    >
      <div className="max-w-6xl mx-auto space-y-4">
        {error && (
          <div className="admin-alert admin-alert--error">
            {error}
          </div>
        )}

        <div className="admin-card p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <label className="text-xs uppercase tracking-wide text-gray-500">Search</label>
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by name, PIN, email, or text"
                className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="text-xs text-gray-500">
              {filteredFeedbacks.length} result(s)
            </div>
          </div>
        </div>

        {!error && filteredFeedbacks.length === 0 && (
          <div className="admin-card p-8 text-center text-gray-600">
            {feedbacks.length === 0
              ? 'No feedback submitted yet.'
              : 'No feedback matches your search.'}
          </div>
        )}

        {filteredFeedbacks.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {pagedFeedbacks.map((item) => {
                const isExpanded = expandedIds.includes(item.id);
                const description = item.description || '';
                const preview = getPreview(description, 140);

                return (
                  <div key={item.id} className="admin-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {item.students?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.students?.pin_number || 'N/A'} · {item.students?.email || 'N/A'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="h-8 w-8 inline-flex items-center justify-center rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                        aria-label="Delete feedback"
                        title="Delete"
                      >
                        {deletingId === item.id ? (
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M22 12a10 10 0 0 1-10 10" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">
                      {isExpanded ? description : preview}
                    </p>
                    {description.length > 140 && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(item.id)}
                        className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      {item.image_url ? (
                        <a
                          href={item.image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 hover:underline"
                        >
                          View image
                        </a>
                      ) : (
                        <span>No image</span>
                      )}
                      <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block admin-card overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2 sm:px-4 sm:py-3 font-medium">Name</th>
                    <th className="text-left px-3 py-2 sm:px-4 sm:py-3 font-medium">PIN</th>
                    <th className="text-left px-3 py-2 sm:px-4 sm:py-3 font-medium">Email</th>
                    <th className="text-left px-3 py-2 sm:px-4 sm:py-3 font-medium">Feedback</th>
                    <th className="text-left px-3 py-2 sm:px-4 sm:py-3 font-medium">Image</th>
                    <th className="text-left px-3 py-2 sm:px-4 sm:py-3 font-medium">Date</th>
                    <th className="text-left px-3 py-2 sm:px-4 sm:py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pagedFeedbacks.map((item) => {
                    const isExpanded = expandedIds.includes(item.id);
                    const description = item.description || '';
                    const preview = getPreview(description, 120);

                    return (
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
                          {isExpanded ? description : preview}
                          {description.length > 120 && (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(item.id)}
                              className="ml-2 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                            >
                              {isExpanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2 sm:px-4 sm:py-4">
                          {item.image_url ? (
                            <a
                              href={item.image_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-700 hover:underline"
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
                        <td className="px-3 py-2 sm:px-4 sm:py-4">
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            className="h-8 w-8 inline-flex items-center justify-center rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                            aria-label="Delete feedback"
                            title="Delete"
                          >
                            {deletingId === item.id ? (
                              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M22 12a10 10 0 0 1-10 10" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Page {clampedPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={clampedPage === 1}
                  className="admin-button admin-button--ghost"
                >
                  Prev
                </button>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={clampedPage === totalPages}
                  className="admin-button"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
