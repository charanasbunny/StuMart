import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentAdmin } from '../services/adminService';
import {
  getRegistrationRequests,
  adminApproveRequest,
  adminRejectRequest,
  sendApprovalEmail,
} from '../services/registrationService';
import AdminLayout from '../components/admin/AdminLayout';

export default function AdminRegistrationRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [approvalUrl, setApprovalUrl] = useState(null);
  const [success, setSuccess] = useState('');

  const loadRequests = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      const { admin, error: adminError } = await getCurrentAdmin();
      if (adminError || !admin) {
        navigate('/login?type=admin');
        return;
      }

      const result = await getRegistrationRequests('pending');
      if (!result.success) setError(result.error || 'Failed to load requests.');
      else {
        setError('');
        setRequests(result.data || []);
      }
      setLastUpdated(new Date());
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [navigate]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRequests();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadRequests]);

  const handleApprove = async (request) => {
    setActionId(request.id);
    setApprovalUrl(null);
    setSuccess('');
    setError('');

    const result = await adminApproveRequest(request.id);
    if (result.success && result.data?.completionUrl) {
      const emailResult = await sendApprovalEmail({
        toEmail: request.email,
        studentName: request.name,
        completionUrl: result.data.completionUrl,
        tokenExpiresAt: result.data.tokenExpiresAt,
      });

      if (emailResult.success) {
        setSuccess(`Approved and email sent to ${request.email}.`);
        setApprovalUrl(null);
      } else {
        setError(`Approved, but email failed. Copy and share the link manually. (${emailResult.error})`);
        setApprovalUrl(result.data.completionUrl);
      }
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } else {
      setError(result.error || 'Failed to approve.');
    }
    setActionId(null);
  };

  const handleReject = async (requestId) => {
    if (!window.confirm('Reject this registration request? The PIN will become available again.')) return;
    setActionId(requestId);
    const result = await adminRejectRequest(requestId);
    if (result.success) setRequests((prev) => prev.filter((r) => r.id !== requestId));
    else setError(result.error || 'Failed to reject.');
    setActionId(null);
  };

  const copyUrl = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setApprovalUrl(null);
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleString() : '–');
  const isImageType = (mimeType = '') => String(mimeType).startsWith('image/');
  const isPdfType = (mimeType = '') => String(mimeType).toLowerCase() === 'application/pdf';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      title="Registration requests"
      subtitle="Verify and approve or reject student registration requests."
      lastUpdated={lastUpdated}
      onRefresh={() => loadRequests(true)}
      isRefreshing={isRefreshing}
    >
      <div className="max-w-5xl mx-auto">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">{success}</div>
        )}

        {approvalUrl && (
          <div className="mb-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
            <p className="text-sm font-medium text-emerald-800">Share this link with the student to complete registration:</p>
            <p className="mt-2 text-sm text-emerald-700 break-all">{approvalUrl}</p>
            <button
              type="button"
              onClick={() => copyUrl(approvalUrl)}
              className="mt-2 px-3 py-1.5 rounded bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            >
              Copy link
            </button>
          </div>
        )}

        {requests.length === 0 ? (
          <div className="admin-card p-8 text-center text-gray-500">
            No pending registration requests.
          </div>
        ) : (
          <div className="admin-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">PIN</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Name</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Email</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Branch / Year / Section</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">ID Card</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Requested</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">{r.pin_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{r.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {r.branch} / {r.year} / {r.section}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {r.student_id_card_url ? (
                          <div className="flex items-center gap-2">
                            {isImageType(r.student_id_card_mime_type) ? (
                              <a
                                href={r.student_id_card_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 text-indigo-600 hover:underline"
                              >
                                <img
                                  src={r.student_id_card_url}
                                  alt={`${r.name} ID card`}
                                  className="h-12 w-12 rounded-md object-cover border border-gray-200"
                                />
                                View image
                              </a>
                            ) : (
                              <a
                                href={r.student_id_card_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 text-indigo-600 hover:underline"
                              >
                                {isPdfType(r.student_id_card_mime_type) ? 'View PDF' : 'Open file'}
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">Not uploaded</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(r.requested_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(r)}
                            disabled={actionId !== null}
                            className="admin-button admin-button--primary text-sm py-1.5 px-3"
                          >
                            {actionId === r.id ? '...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(r.id)}
                            disabled={actionId !== null}
                            className="admin-button admin-button--ghost text-sm py-1.5 px-3 text-red-600 hover:bg-red-50"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
