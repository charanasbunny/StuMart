import { supabase } from './supabaseClient';

/**
 * Registration request service
 * Flow: User submits details + PIN → Admin approves/rejects → User completes signup with password
 */

/**
 * Submit a registration request (no account created yet). PIN is reserved until admin approves or rejects.
 */
export const submitRegistrationRequest = async ({
  pinNumber,
  name,
  email,
  joiningYear,
  branch,
  year,
  section,
  studentIdCardUrl = null,
  studentIdCardPath = null,
  studentIdCardMimeType = null,
  studentIdCardFileName = null,
}) => {
  try {
    const { data, error } = await supabase.rpc('submit_registration_request', {
      p_pin_number: String(pinNumber).trim(),
      p_name: String(name).trim(),
      p_email: String(email).trim().toLowerCase(),
      p_joining_year: parseInt(joiningYear, 10),
      p_branch: String(branch).trim(),
      p_year: parseInt(year, 10),
      p_section: String(section).trim(),
      p_student_id_card_url: studentIdCardUrl,
      p_student_id_card_path: studentIdCardPath,
      p_student_id_card_mime_type: studentIdCardMimeType,
      p_student_id_card_file_name: studentIdCardFileName,
    });

    if (error) {
      let msg = error.message;
      if (error.message?.includes('not available')) msg = 'This PIN is no longer available.';
      if (error.message?.includes('PIN not found')) msg = 'Invalid PIN.';
      if (error.message?.includes('unique') || error.message?.includes('duplicate')) msg = 'A request for this PIN already exists.';
      return { success: false, error: msg, data: null };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      success: true,
      error: null,
      data: { requestId: row?.request_id, message: row?.message || 'Request submitted.' },
    };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to submit request', data: null };
  }
};

/**
 * Get approved request by completion token (for complete-signup page).
 */
export const getApprovedRequestByToken = async (token) => {
  try {
    const { data, error } = await supabase.rpc('get_approved_request_by_token', { p_token: token });
    if (error) return { success: false, error: error.message, data: null };
    const row = Array.isArray(data) && data.length ? data[0] : null;
    return { success: true, error: null, data: row };
  } catch (err) {
    return { success: false, error: err.message || 'Invalid or expired link', data: null };
  }
};

/**
 * After user has signed up (Auth), claim the approved registration and create student record.
 */
export const claimApprovedRegistration = async (token, authUserId = null) => {
  try {
    let resolvedAuthUserId = authUserId;
    if (!resolvedAuthUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      resolvedAuthUserId = user?.id || null;
    }
    if (!resolvedAuthUserId) return { success: false, error: 'Missing auth user id for claim', data: null };

    const { data, error } = await supabase.rpc('claim_approved_registration', {
      p_token: token,
      p_auth_user_id: resolvedAuthUserId,
    });

    if (error) {
      return { success: false, error: error.message, data: null };
    }

    const row = Array.isArray(data) && data.length ? data[0] : data;
    return { success: true, error: null, data: row };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to complete registration', data: null };
  }
};

/**
 * Admin: get registration requests by status (pending, approved, rejected, completed).
 */
export const getRegistrationRequests = async (status = 'pending') => {
  try {
    const { data, error } = await supabase.rpc('get_registration_requests', { p_status: status });
    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, error: null, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to load requests', data: [] };
  }
};

/**
 * Admin: approve a request. Returns completion URL to share with the student.
 */
export const adminApproveRequest = async (requestId) => {
  try {
    const { data, error } = await supabase.rpc('admin_approve_registration_request', {
      p_request_id: requestId,
    });
    if (error) return { success: false, error: error.message, data: null };
    const row = Array.isArray(data) && data.length ? data[0] : data;
    const baseUrl = import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' && window.location?.origin) || '';
    const completionUrl = baseUrl && row?.completion_url ? `${baseUrl}${row.completion_url}` : null;
    return {
      success: true,
      error: null,
      data: { completionToken: row?.completion_token, tokenExpiresAt: row?.token_expires_at, completionUrl },
    };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to approve', data: null };
  }
};

/**
 * Admin: send approval email containing completion URL.
 * Uses Supabase Edge Function: send-approval-email
 */
export const sendApprovalEmail = async ({ toEmail, studentName, completionUrl, tokenExpiresAt }) => {
  try {
    const invokeSend = async () => {
      return supabase.functions.invoke('send-approval-email', {
        body: {
          toEmail,
          studentName,
          completionUrl,
          tokenExpiresAt,
        },
      });
    };

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session) {
      return { success: false, error: 'Admin session missing. Please login again.', data: null };
    }

    let { data, error } = await invokeSend();

    // Self-heal stale token: refresh once and retry.
    if (error?.message?.toLowerCase().includes('invalid jwt')) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession(sessionData.session);
      if (refreshError || !refreshed?.session) {
        return { success: false, error: 'Invalid admin session token. Please logout and login again.', data: null };
      }
      const retry = await invokeSend();
      data = retry.data;
      error = retry.error;
    }

    if (error) return { success: false, error: error.message || 'Failed to send email', data: null };
    return { success: true, error: null, data: data || null };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to send email', data: null };
  }
};

/**
 * Admin: reject a request. PIN becomes available again.
 */
export const adminRejectRequest = async (requestId, reason = null) => {
  try {
    const { error } = await supabase.rpc('admin_reject_registration_request', {
      p_request_id: requestId,
      p_reason: reason || null,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to reject' };
  }
};
