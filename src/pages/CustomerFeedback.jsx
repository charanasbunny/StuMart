import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../services/authService';
import { createFeedback } from '../services/feedbackService';
import {
  getImagePreview,
  revokeImagePreview,
  uploadFeedbackImage,
} from '../services/imageUploadService';

export default function CustomerFeedback() {
  const MAX_DESCRIPTION_LENGTH = 500;
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [user, setUser] = useState(null);
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      const { user: currentUser, student: currentStudent, error: userError } = await getCurrentUser();
      if (userError || !currentUser || !currentStudent) {
        navigate('/login');
        return;
      }
      setUser(currentUser);
      setStudent(currentStudent);
    };

    loadUser();
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        revokeImagePreview(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (imagePreview) {
      revokeImagePreview(imagePreview);
    }
    setImageFile(file);
    setImagePreview(file ? getImagePreview(file) : null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    if (!user || !student) {
      setError('Please log in to submit feedback.');
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = null;

      if (imageFile) {
        const uploadResult = await uploadFeedbackImage(imageFile, user.id);
        if (!uploadResult.success) {
          setError(uploadResult.error || 'Failed to upload image.');
          setIsSubmitting(false);
          return;
        }
        imageUrl = uploadResult.url;
      }

      const result = await createFeedback({
        description,
        imageUrl,
      });

      if (!result.success) {
        setError(result.error || 'Failed to submit feedback.');
        setIsSubmitting(false);
        return;
      }

      setDescription('');
      setImageFile(null);
      if (imagePreview) {
        revokeImagePreview(imagePreview);
      }
      setImagePreview(null);
      setSuccess('Feedback submitted. Thank you.');
    } catch (submitError) {
      setError(submitError.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
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

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-14 md:py-16">
        <div className="bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/40 p-8 md:p-12">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center justify-center overflow-hidden">
              <img
                src="/newlogo.jpeg"
                alt="StuMart"
                className="w-10 h-10 object-contain"
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-600">
              Feedback
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-3">
              Student Feedback
            </h1>
            <p className="hidden sm:block text-base text-gray-600 mt-2 max-w-2xl mx-auto">
              Share suggestions or issues to help us improve the student experience. Description is required, image is optional.
            </p>
          </div>

          <div className="mb-8 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-700">
            We read every response and use it to improve the platform.
          </div>

          <form onSubmit={handleSubmit} className="space-y-7">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="description" className="block text-sm font-semibold text-gray-800">
                  Description
                </label>
                <span className="text-xs text-slate-400">
                  {MAX_DESCRIPTION_LENGTH - description.length} characters left
                </span>
              </div>
              <textarea
                id="description"
                name="description"
                rows={6}
                required
                maxLength={MAX_DESCRIPTION_LENGTH}
                autoFocus
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-200"
                placeholder="Tell us what you liked, what felt confusing, or what should improve."
              />
              <p className="text-xs text-slate-500 mt-2">
                Please avoid sharing passwords or sensitive information.
              </p>
            </div>

            <div>
              <label htmlFor="image" className="block text-sm font-semibold text-gray-800 mb-2">
                Attach screenshot (optional)
              </label>
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4">
                <input
                  id="image"
                  name="image"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-white file:text-indigo-700 file:shadow-sm hover:file:bg-indigo-50"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Upload one image. JPG, PNG, or WebP, up to 5MB.
                </p>
                {imagePreview && (
                  <div className="mt-4">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full max-w-sm rounded-lg border border-slate-200"
                    />
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold tracking-wide hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

