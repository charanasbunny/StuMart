import { supabase } from './supabaseClient';

/**
 * Authentication Service
 * Handles all authentication-related operations including signup, login, and logout.
 * Note: Production onboarding flow uses admin approval + completion token (no Supabase email confirmation dependency).
 */

/**
 * Get the base URL for email redirects (e.g. after email confirmation or password reset).
 * Set VITE_APP_URL in .env / Vercel; no hardcoded fallback in repo.
 */
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_APP_URL;
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
};


/**
 * Sign up a new student
 * @param {Object} studentData - Student registration data
 * @param {string} studentData.pinNumber - Unique PIN number (primary key)
 * @param {string} studentData.name - Student name
 * @param {string} studentData.email - Student email
 * @param {string} studentData.password - Student password
 * @returns {Promise<{success: boolean, error: string|null, data: Object|null}>}
 */
export const signUp = async ({ pinNumber, name, email, password }) => {
  try {
    // Validate and clean email before sending
    const cleanEmail = email.trim().toLowerCase();
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return {
        success: false,
        error: 'Invalid email format. Please enter a valid email address.',
        data: null,
      };
    }

    // Step 1: Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${getBaseUrl()}/login`,
        data: {
          name: name.trim(),
          pin_number: pinNumber.trim(),
        },
      },
    });

    if (authError) {
      // Provide more helpful error messages
      let errorMessage = authError.message;
      
      if (authError.message.includes('email_address_invalid')) {
        errorMessage = 'Invalid email address. Please check your email format and try again. If the problem persists, contact support.';
      } else if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        errorMessage = 'This email is already registered. Please use a different email or try logging in.';
      } else if (authError.message.includes('password')) {
        errorMessage = 'Password does not meet requirements. Please use a stronger password (minimum 6 characters).';
      }
      
      return {
        success: false,
        error: errorMessage,
        data: null,
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'Failed to create user account',
        data: null,
      };
    }

    // Step 2: Create student record using database function
    // This function validates PIN availability and marks it as registered
    // Account is created directly as active in simplified flow
    const { data: studentData, error: studentError } = await supabase
      .rpc('create_student_record', {
        p_pin_number: pinNumber.trim(),
        p_name: name.trim(),
        p_email: cleanEmail,
        p_auth_user_id: authData.user.id,
        p_status: 'active',
      });

    if (studentError || !studentData || studentData.length === 0) {
      // If student insertion fails, we have an orphaned auth user
      // Note: Client-side cannot delete auth users (requires admin API)
      // This is a known limitation - in production, use a server-side function to handle cleanup
      console.error('Failed to create student record:', studentError);

      // Sign out the user to prevent any session issues
      await supabase.auth.signOut();

      let errorMessage = 'Failed to create student record';
      if (studentError) {
        if (studentError.message.includes('not available')) {
          errorMessage = 'This PIN is already registered. Please select a different PIN.';
        } else if (studentError.message.includes('not found')) {
          errorMessage = 'Invalid PIN number. Please select a valid PIN.';
        } else {
          errorMessage = studentError.message;
        }
      }

      return {
        success: false,
        error: errorMessage,
        data: null,
      };
    }

    // Extract student data from array result
    const student = studentData[0];
    
    // Step 3: Return success
    return {
      success: true,
      error: null,
      data: {
        user: authData.user,
        student: student,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred during signup',
      data: null,
    };
  }
};

/**
 * Create Auth user with email + password only (no immediate student insert).
 * Used in complete-signup flow; student row must be linked immediately by claim RPC.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, error: string|null, data: {user: Object}|null}>}
 */
export const signUpPasswordOnly = async (email, password, metadata = {}) => {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${getBaseUrl()}/login`,
        data: {
          ...metadata,
        },
      },
    });
    if (error) {
      let msg = error.message;
      if (error.message?.includes('already registered') || error.message?.includes('already exists')) msg = 'This email is already registered. Try logging in.';
      return { success: false, error: msg, data: null };
    }
    return { success: true, error: null, data: data?.user ? { user: data.user } : null };
  } catch (err) {
    return { success: false, error: err.message || 'Sign up failed', data: null };
  }
};

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const sendPasswordReset = async (email) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getBaseUrl()}/login`, // Where user lands after reset
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Failed to send password reset email',
    };
  }
};


/**
 * Sign in an existing student
 * @param {string} email - Student email
 * @param {string} password - Student password
 * @returns {Promise<{success: boolean, error: string|null, data: Object|null}>}
 */
export const signIn = async (email, password) => {
  try {
    // Step 1: Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return {
        success: false,
        error: authError.message,
        data: null,
      };
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'Authentication failed',
        data: null,
      };
    }

    // Step 2: Verify student record exists in students table
    // Use maybeSingle() so we get 200 + null when no row exists instead of 406 from .single()
    let { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();

    if (studentError) {
      await supabase.auth.signOut();
      return {
        success: false,
        error: studentError.message || 'Could not load student account. Please try again.',
        data: null,
      };
    }

    if (!studentData) {
      await supabase.auth.signOut();
      return {
        success: false,
        error:
          'No student account is linked to this email. Complete signup from the admin approval link or contact support.',
        data: null,
      };
    }

    // Step 3: Verify student account is active.
    if (studentData.status !== 'active') {
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'Your account is not active yet. Contact admin.',
        data: null,
      };
    }

    // Step 4: Return success with user and student data
    return {
      success: true,
      error: null,
      data: {
        user: authData.user,
        student: studentData,
        session: authData.session,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred during login',
      data: null,
    };
  }
};

/**
 * Sign out the current user
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: true,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'An unexpected error occurred during logout',
    };
  }
};

/**
 * Get the current authenticated user and their student record
 * @returns {Promise<{user: Object|null, student: Object|null, error: string|null}>}
 */
export const getCurrentUser = async () => {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return {
        user: null,
        student: null,
        error: null,
      };
    }

    const user = session.user;

    // Get student record; use maybeSingle() to avoid 406 when no row exists
    let { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('pin_number, name, email, joining_year, branch, year, section, auth_user_id, status, email_confirmed, email_confirmed_at, created_at, updated_at')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (studentError || !studentData) {
      return {
        user: null,
        student: null,
        error: 'Student record not found. Please complete signup using your admin approval link.',
      };
    }

    // Backward-compat: auto-activate legacy pending rows.
    if (studentData.status === 'pending') {
      const { data: updatedStudent, error: updateError } = await supabase
        .from('students')
        .update({ status: 'active' })
        .eq('auth_user_id', user.id)
        .select()
        .maybeSingle();

      if (!updateError && updatedStudent) {
        // Return updated student data
        return {
          user,
          student: updatedStudent,
          error: null,
        };
      }
    }

    return {
      user,
      student: studentData,
      error: null,
    };
  } catch (error) {
    return {
      user: null,
      student: null,
      error: error.message || 'Failed to get current user',
    };
  }
};

/**
 * Resend verification email
 * @param {string} email - User email
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const resendVerificationEmail = async (email) => {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${getBaseUrl()}/login`,
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to resend verification email',
    };
  }
};

/**
 * Listen to authentication state changes
 * @param {Function} callback - Callback function to handle auth state changes
 * @returns {Function} Unsubscribe function
 */
export const onAuthStateChange = (callback) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  
  // Return unsubscribe function
  return () => {
    if (subscription) {
      subscription.unsubscribe();
    }
  };
  
};

