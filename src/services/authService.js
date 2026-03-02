import { supabase } from './supabaseClient';

/**
 * Authentication Service
 * Handles all authentication-related operations including signup, login, logout,
 * and email verification checks.
 */

/**
 * Get the base URL for email redirects (e.g. after email confirmation or password reset).
 * Uses VITE_APP_URL if set, otherwise current origin in browser (so local dev works), else production URL.
 */
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_APP_URL;
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://gvlpolymart.app';
};

/**
 * Extract registration completion token saved during complete-signup.
 */
const getRegistrationTokenFromUser = (user) => {
  return user?.user_metadata?.registration_token || null;
};

/**
 * Try to finalize approved registration using the token stored in user metadata.
 * This repairs cases where Auth user exists but students row was not created yet.
 */
const tryClaimApprovedRegistrationFromMetadata = async (user) => {
  try {
    if (!user?.id) {
      return { success: false, error: 'Missing authenticated user.' };
    }

    const token = getRegistrationTokenFromUser(user);
    if (!token) {
      return { success: false, error: null };
    }

    const { error } = await supabase.rpc('claim_approved_registration', {
      p_token: token,
      p_auth_user_id: user.id,
    });

    if (!error) {
      return { success: true, error: null };
    }

    // "already registered" means row may already exist; treat as non-fatal.
    if (error.message?.toLowerCase().includes('already registered')) {
      return { success: true, error: null };
    }

    if (error.message?.toLowerCase().includes('expired')) {
      return {
        success: false,
        error: 'Your approval link has expired. Please ask admin to approve again and send a new link.',
      };
    }

    return { success: false, error: error.message || 'Could not complete registration claim.' };
  } catch (err) {
    return { success: false, error: err.message || 'Could not complete registration claim.' };
  }
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
    // Supabase will automatically send confirmation email
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${getBaseUrl()}/login`,
        // Ensure confirmation email is sent
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
    // Account is created but status is 'pending' until email is confirmed
    const { data: studentData, error: studentError } = await supabase
      .rpc('create_student_record', {
        p_pin_number: pinNumber.trim(),
        p_name: name.trim(),
        p_email: cleanEmail,
        p_auth_user_id: authData.user.id,
        p_status: 'pending', // Account is pending until email confirmation
      });

    if (studentError || !studentData || studentData.length === 0) {
      // If student insertion fails, we have an orphaned auth user
      // Note: Client-side cannot delete auth users (requires admin API)
      // The user will need to verify email to login, but won't have a student record
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
    // Note: Account is created but email_confirmed = FALSE
    // Supabase has automatically sent confirmation email
    // User must click link in email to activate account
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
 * Used in complete-signup flow; student row is linked automatically on first verified login.
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

    // Step 2: Check if email is verified
    if (!authData.user.email_confirmed_at) {
      // Sign out the user immediately if email is not verified
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
        data: null,
      };
    }

    // Step 3: Verify student record exists in students table
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

    // Permanent flow: if students row is missing, auto-claim using registration token metadata.
    if (!studentData) {
      const claimResult = await tryClaimApprovedRegistrationFromMetadata(authData.user);

      if (claimResult.success) {
        const refetch = await supabase
          .from('students')
          .select('*')
          .eq('auth_user_id', authData.user.id)
          .maybeSingle();
        studentData = refetch.data || null;
        studentError = refetch.error || null;
      }

      if (studentError || !studentData) {
        await supabase.auth.signOut();
        return {
          success: false,
          error:
            claimResult.error ||
            'No student account is linked to this email. Complete registration from admin link, then verify email.',
          data: null,
        };
      }
    }

    // Step 4: If email is confirmed in Auth but not in database, call confirm_student_email()
    if (authData.user.email_confirmed_at && !studentData.email_confirmed) {
      const { data: confirmedData, error: confirmError } = await supabase.rpc('confirm_student_email', {
        p_auth_user_id: authData.user.id
      });

      if (confirmError) {
        console.error('Error confirming email in database:', confirmError);
        // Continue anyway - will try again on next login
      } else if (confirmedData && confirmedData.length > 0) {
        // Use the confirmed student data
        studentData.email_confirmed = true;
        studentData.status = 'active';
        studentData.email_confirmed_at = confirmedData[0].email_confirmed_at;
      }
    }

    // Step 5: Verify student is active (must have confirmed email)
    if (studentData.status !== 'active' || !studentData.email_confirmed) {
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'Your email is not confirmed. Please check your inbox and click the confirmation link.',
        data: null,
      };
    }

    // Step 5: Return success with user and student data
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

    // Check if email is verified
    if (!user.email_confirmed_at) {
      return {
        user: null,
        student: null,
        error: 'Email not verified',
      };
    }

    // Get student record; use maybeSingle() to avoid 406 when no row exists
    let { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('pin_number, name, email, joining_year, branch, year, section, auth_user_id, status, email_confirmed, email_confirmed_at, created_at, updated_at')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    // If row is missing, attempt one-time auto-claim from metadata token.
    if (!studentData && !studentError) {
      const claimResult = await tryClaimApprovedRegistrationFromMetadata(user);
      if (claimResult.success) {
        const refetch = await supabase
          .from('students')
          .select('pin_number, name, email, joining_year, branch, year, section, auth_user_id, status, email_confirmed, email_confirmed_at, created_at, updated_at')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        studentData = refetch.data || null;
        studentError = refetch.error || null;
      }
      if (!studentData && claimResult.error) {
        return {
          user: null,
          student: null,
          error: claimResult.error,
        };
      }
    }

    if (studentError || !studentData) {
      return {
        user: null,
        student: null,
        error: 'Student record not found',
      };
    }

    // Update status to 'active' if it's still 'pending' (email is verified)
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

