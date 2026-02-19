import { supabase } from './supabaseClient';
import { getCurrentUser } from './authService';
import { getCurrentAdmin } from './adminService';

/**
 * Create a new feedback entry
 * @param {Object} feedbackData
 * @param {string} feedbackData.description
 * @param {string|null} feedbackData.imageUrl
 * @returns {Promise<{success: boolean, data: Object|null, error: string|null}>}
 */
export const createFeedback = async ({ description, imageUrl }) => {
  try {
    const MAX_DESCRIPTION_LENGTH = 500;
    const { user, student, error: userError } = await getCurrentUser();

    if (userError || !user || !student) {
      return {
        success: false,
        data: null,
        error: 'User not authenticated. Please log in to submit feedback.',
      };
    }

    if (!description || !description.trim()) {
      return {
        success: false,
        data: null,
        error: 'Description is required.',
      };
    }

    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      return {
        success: false,
        data: null,
        error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.`,
      };
    }

    const insertPayload = {
      student_pin_number: student.pin_number,
      student_name: student.name || null,
      description: description.trim(),
      image_url: imageUrl || null,
    };

    const { data, error } = await supabase
      .from('student_feedback')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to submit feedback.',
      };
    }

    return {
      success: true,
      data,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error.message || 'An unexpected error occurred.',
    };
  }
};

/**
 * Get feedback entries for students (recent list)
 * @param {Object} options
 * @param {number} options.limit
 * @returns {Promise<{success: boolean, data: Array|null, error: string|null}>}
 */
export const getFeedbackForStudents = async ({ limit = 6 } = {}) => {
  try {
    let query = supabase
      .from('student_feedback')
      .select(`
        id,
        student_name,
        description,
        image_url,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (limit && Number.isFinite(limit)) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to load feedback entries.',
      };
    }

    return {
      success: true,
      data: data || [],
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error.message || 'An unexpected error occurred.',
    };
  }
};

/**
 * Create feedback as admin for a student
 * @param {Object} feedbackData
 * @param {string} feedbackData.studentPinNumber
 * @param {string} feedbackData.description
 * @param {string|null} feedbackData.imageUrl
 * @returns {Promise<{success: boolean, data: Object|null, error: string|null}>}
 */
export const createFeedbackAsAdmin = async ({
  studentPinNumber,
  studentName,
  description,
  imageUrl,
}) => {
  try {
    const MAX_DESCRIPTION_LENGTH = 500;
    const { admin, error: adminError } = await getCurrentAdmin();

    if (adminError || !admin) {
      return {
        success: false,
        data: null,
        error: 'Admin authentication required.',
      };
    }

    if (!studentPinNumber) {
      return {
        success: false,
        data: null,
        error: 'Student PIN is required.',
      };
    }

    if (!description || !description.trim()) {
      return {
        success: false,
        data: null,
        error: 'Description is required.',
      };
    }

    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      return {
        success: false,
        data: null,
        error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.`,
      };
    }

    const insertPayload = {
      student_pin_number: studentPinNumber,
      student_name: studentName || null,
      description: description.trim(),
      image_url: imageUrl || null,
    };

    const { data, error } = await supabase
      .from('student_feedback')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to submit feedback.',
      };
    }

    return {
      success: true,
      data,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error.message || 'An unexpected error occurred.',
    };
  }
};

/**
 * Get all feedback entries for admin view
 * @returns {Promise<{success: boolean, data: Array|null, error: string|null}>}
 */
export const getFeedbackForAdmin = async () => {
  try {
    const { admin, error: adminError } = await getCurrentAdmin();

    if (adminError || !admin) {
      return {
        success: false,
        data: null,
        error: 'Admin authentication required.',
      };
    }

    const { data, error } = await supabase
      .from('student_feedback')
      .select(`
        id,
        description,
        image_url,
        created_at,
        students:student_pin_number (
          name,
          pin_number,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        success: false,
        data: null,
        error: error.message || 'Failed to load feedback entries.',
      };
    }

    return {
      success: true,
      data: data || [],
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error.message || 'An unexpected error occurred.',
    };
  }
};

/**
 * Delete feedback entry as admin
 * @param {string} feedbackId
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const deleteFeedbackAsAdmin = async (feedbackId) => {
  try {
    const { admin, error: adminError } = await getCurrentAdmin();

    if (adminError || !admin) {
      return {
        success: false,
        error: 'Admin authentication required.',
      };
    }

    const { error } = await supabase
      .from('student_feedback')
      .delete()
      .eq('id', feedbackId);

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to delete feedback.',
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred.',
    };
  }
};
