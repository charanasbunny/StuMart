import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../services/authService';
import { createFeedback, getFeedbackForStudents } from '../services/feedbackService';
import {
  getImagePreview,
  revokeImagePreview,
  uploadFeedbackImage,
} from '../services/imageUploadService';

export default function CustomerFeedback() {
  const MAX_DESCRIPTION_LENGTH = 500;
  const PREVIEW_COUNT = 3;
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [student, setStudent] = useState(null);
  const [user, setUser] = useState(null);
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(true);
  const [feedbackEntries, setFeedbackEntries] = useState([]);
  const [feedbackError, setFeedbackError] = useState('');
  const [showAllFeedback, setShowAllFeedback] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      const { user: currentUser, student: currentStudent, error: userError } = await getCurrentUser();
      if (!userError && currentUser && currentStudent) {
        setUser(currentUser);
        setStudent(currentStudent);
        return;
      }
      setUser(null);
      setStudent(null);
    };

    loadUser();
  }, []);

  useEffect(() => {
    const loadFeedback = async () => {
      setIsLoadingFeedback(true);
      setFeedbackError('');
      const result = await getFeedbackForStudents({ limit: 20 });
      if (result.success) {
        setFeedbackEntries(result.data || []);
      } else {
        setFeedbackError(result.error || 'Unable to load feedback.');
      }
      setIsLoadingFeedback(false);
    };

    loadFeedback();
  }, []);


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
      const refresh = await getFeedbackForStudents({ limit: 20 });
      if (refresh.success) {
        setFeedbackEntries(refresh.data || []);
      }
      setShowForm(false);
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
                alt="GvlPolyMart"
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
            {!user && (
              <p className="text-xs text-slate-500 mt-3">
                Log in to submit feedback. Everyone can view feedback below.
              </p>
            )}
          </div>

          {!showForm && (
            <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Recent feedback</h2>
              {feedbackEntries.length > PREVIEW_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllFeedback((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  {showAllFeedback ? 'Show less' : 'View all'}
                  <svg
                    className={`w-4 h-4 transition-transform ${showAllFeedback ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>

            {isLoadingFeedback ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Loading feedback...
              </div>
            ) : feedbackError ? (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {feedbackError}
              </div>
            ) : feedbackEntries.length === 0 ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                No feedback yet. Be the first to share.
              </div>
            ) : (
              <div className="space-y-3">
                {(showAllFeedback ? feedbackEntries : feedbackEntries.slice(0, PREVIEW_COUNT)).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-100 bg-white px-4 py-3">
                    <div className="text-xs text-slate-500 mb-2">
                      {entry.student_name || "Unknown"}
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {entry.description}
                    </p>
                    {entry.image_url && (
                      <img
                        src={entry.image_url}
                        alt="Feedback"
                        className="mt-3 w-full max-h-48 object-cover rounded-lg border border-slate-200"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
          {showForm && (
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-7">
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
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          if (!user || !student) {
            navigate('/login');
            return;
          }
          setShowForm((prev) => !prev);
          if (!showForm) {
            setTimeout(() => {
              formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 60);
          }
        }}
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition"
        aria-label={showForm ? 'Close feedback form' : 'Create feedback'}
      >
        {showForm ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        )}
      </button>
    </div>
  );
}

