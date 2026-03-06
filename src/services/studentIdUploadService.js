import { supabase } from './supabaseClient';

const STUDENT_ID_BUCKET = 'student-id-cards';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const getFileExtension = (fileName = '') => {
  const parts = String(fileName).split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

const sanitizePart = (value = '') => {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_');
};

export const validateStudentIdFile = (file) => {
  if (!file) {
    return { valid: false, error: 'Please upload your student ID card (image or PDF).' };
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Upload JPG, PNG, WEBP, or PDF.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 10MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
    };
  }

  return { valid: true, error: null };
};

export const uploadStudentIdFile = async (file, pinNumber) => {
  try {
    const validation = validateStudentIdFile(file);
    if (!validation.valid) {
      return { success: false, data: null, error: validation.error };
    }

    const extension = getFileExtension(file.name) || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
    const safePin = sanitizePart(pinNumber || 'unknown');
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const filePath = `requests/${safePin}/${fileName}`;

    const { data, error } = await supabase.storage
      .from(STUDENT_ID_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      return { success: false, data: null, error: error.message || 'Failed to upload student ID card.' };
    }

    const { data: publicUrlData } = supabase.storage
      .from(STUDENT_ID_BUCKET)
      .getPublicUrl(data.path);

    return {
      success: true,
      error: null,
      data: {
        url: publicUrlData?.publicUrl || null,
        path: data.path,
        mimeType: file.type,
        fileName: file.name,
      },
    };
  } catch (err) {
    return { success: false, data: null, error: err.message || 'Failed to upload student ID card.' };
  }
};
