import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getCurrentUser } from '../services/authService';
import { createProduct } from '../services/productService';
import {
  uploadMultipleImages,
  getImagePreview,
  revokeImagePreview,
  validateImageFile,
} from '../services/imageUploadService';

/** Convert a File object to a base64 data string (without the data URL prefix) */
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result is "data:<mime>;base64,<data>" — strip the prefix
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

export default function CreatePost() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [student, setStudent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  // Form data
  const [formData, setFormData] = useState({
    branch: '',
    category: '',
    title: '',
    description: '',
    price: '',
  });

  // Price predictor (Gemini, frontend)
  const [predictor, setPredictor] = useState({
    name: '',
    condition: 'good',
    boughtDate: '',
    targetAudience: 'students',
    originalPrice: '',
    urgency: 'medium',
  });
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionError, setPredictionError] = useState('');
  const [prediction, setPrediction] = useState(null); // { min, max, summary }

  // Image handling
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [imageErrors, setImageErrors] = useState([]);

  // Form errors
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Branch options
  const branchOptions = [
    { value: '', label: 'All Branches' },
    { value: 'CM', label: 'CM (Computer Science)' },
    { value: 'C', label: 'C (Civil)' },
    { value: 'M', label: 'M (Mechanical)' },
    { value: 'EC', label: 'EC' },
    { value: 'EE', label: 'EE' },
    { value: 'CIOT', label: 'CIOT' },
    { value: 'AIM', label: 'AIM' },
  ];

  const categoryOptions = [
    { value: 'books', label: 'Books' },
    { value: 'stationary', label: 'Stationery' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'others', label: 'Others' },
  ];

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { user: currentUser, student: studentData, error } = await getCurrentUser();
        if (error || !currentUser || !studentData) {
          navigate('/login');
          return;
        }
        setUser(currentUser);
        setStudent(studentData);
      } catch (error) {
        console.error('Error loading user data:', error);
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };
    loadUserData();
  }, [navigate]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((preview) => revokeImagePreview(preview));
    };
  }, [imagePreviews]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'price') {
      const sanitized = value.replace(/[^0-9]/g, '');
      setFormData((prev) => ({ ...prev, [name]: sanitized }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setSubmitError('');
  };

  const handlePredictorChange = (e) => {
    const { name, value } = e.target;
    if (name === 'originalPrice') {
      const sanitized = value.replace(/[^0-9]/g, '');
      setPredictor((prev) => ({ ...prev, [name]: sanitized }));
    } else {
      setPredictor((prev) => ({ ...prev, [name]: value }));
    }
    setPredictionError('');
  };

  const extractJson = (text) => {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  };

  const predictPriceRange = async () => {
    setPrediction(null);
    setPredictionError('');

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setPredictionError('Missing VITE_GEMINI_API_KEY. Add it to your .env and restart the dev server.');
      return;
    }

    const originalPrice = predictor.originalPrice ? parseInt(predictor.originalPrice, 10) : null;

    if (!originalPrice || originalPrice <= 0) {
      setPredictionError('Enter the original price (MRP) to get a better estimate.');
      return;
    }
    if (!predictor.boughtDate) {
      setPredictionError('Select the bought date to get a better estimate.');
      return;
    }
    if (!predictor.targetAudience) {
      setPredictionError('Select a target audience.');
      return;
    }
    if (!predictor.urgency) {
      setPredictionError('Select urgency to sell.');
      return;
    }

    setIsPredicting(true);
    try {
      const inferredName = (predictor.name || formData.title || '').trim() || '(not provided)';

      const textPrompt = `
You are helping students price used items for a campus marketplace in India.
Given the details${selectedImages.length > 0 ? ' and the attached product image' : ''}, estimate a fair resale price range in INR.

Return ONLY valid JSON with this exact shape:
{
  "min": number,   // INR, integer
  "max": number,   // INR, integer
  "summary": string // 1-2 lines, concise, no emojis
}

Rules:
- min <= max
- values should be realistic for student resale
- consider condition, bought date (age), target audience and urgency to sell
${selectedImages.length > 0 ? '- use the image to assess the actual physical condition and identify the product more accurately' : ''}
- do NOT include any extra keys or surrounding text

Details:
- Name: ${inferredName}
- Product condition: ${predictor.condition}
- Bought date (YYYY-MM-DD): ${predictor.boughtDate}
- Target audience: ${predictor.targetAudience}
- Original price (MRP): ₹${originalPrice}
- Urgency to sell: ${predictor.urgency}
- Category: ${formData.category || '(not provided)'}
- Description: ${formData.description || '(not provided)'}
      `.trim();

      // Build the parts array — include image if one is selected
      const parts = [];

      if (selectedImages.length > 0) {
        try {
          const base64Data = await fileToBase64(selectedImages[0]);
          const mimeType = selectedImages[0].type || 'image/jpeg';
          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          });
        } catch (imgErr) {
          console.warn('Could not encode image for prediction, proceeding without it:', imgErr);
        }
      }

      parts.push({ text: textPrompt });

      const requestedModel = import.meta.env.VITE_GEMINI_MODEL;
      // Use a vision-capable model; gemini-2.5-flash supports multimodal input
      const modelCandidates = [
        requestedModel,
        'gemini-2.5-flash',
        'gemini-1.5-flash',
      ].filter(Boolean);

      /** @type {any} */
      let json = null;
      let lastErr = null;

      for (const model of Array.from(new Set(modelCandidates))) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts }],
            }),
          },
        );

        json = await res.json().catch(() => null);
        if (res.ok) {
          lastErr = null;
          break;
        }

        const msg = json?.error?.message || 'Failed to get prediction. Please try again.';
        lastErr = new Error(msg);

        const msgLower = String(msg).toLowerCase();
        const retryable =
          msgLower.includes('not found') ||
          msgLower.includes('not supported') ||
          msgLower.includes('unsupported') ||
          msgLower.includes('permission') ||
          msgLower.includes('does not exist');
        if (!retryable) break;
      }

      if (lastErr) {
        const hint = requestedModel
          ? `Model "${requestedModel}" failed. Try clearing VITE_GEMINI_MODEL or switching it to "gemini-1.5-flash".`
          : `Try setting VITE_GEMINI_MODEL="gemini-1.5-flash" in your .env, then restart the dev server.`;
        throw new Error(`${lastErr.message}\n${hint}`);
      }

      const text =
        json?.candidates?.[0]?.content?.parts
          ?.map((p) => p?.text)
          .filter(Boolean)
          .join('\n') || '';

      const parsed = extractJson(text);
      const min = Number(parsed?.min);
      const max = Number(parsed?.max);
      const summary = String(parsed?.summary || '').trim();

      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0 || min > max || !summary) {
        throw new Error('Gemini returned an unexpected response. Please try again.');
      }

      setPrediction({
        min: Math.round(min),
        max: Math.round(max),
        summary,
        usedImage: selectedImages.length > 0,
      });
    } catch (err) {
      console.error('Price prediction error:', err);
      setPredictionError(err?.message || 'Failed to predict price. Please try again.');
    } finally {
      setIsPredicting(false);
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    const newErrors = [];
    const validFiles = [];
    const newPreviews = [];

    files.forEach((file) => {
      const validation = validateImageFile(file);
      if (validation.valid) {
        validFiles.push(file);
        newPreviews.push(getImagePreview(file));
      } else {
        newErrors.push(`Image: ${validation.error}`);
      }
    });

    if (newErrors.length > 0) {
      setImageErrors(newErrors);
    }

    if (validFiles.length > 0) {
      setSelectedImages([validFiles[0]]);
      setImagePreviews([newPreviews[0]]);
      // Reset any prior prediction since the image changed
      setPrediction(null);
    }

    e.target.value = '';
  };

  const handleRemoveImage = (index) => {
    revokeImagePreview(imagePreviews[index]);
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setImageErrors((prev) => prev.filter((_, i) => i !== index));
    // Reset prediction — it may have relied on the image
    setPrediction(null);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.category) {
      newErrors.category = 'Please select a category';
    }

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    } else if (formData.title.trim().length > 255) {
      newErrors.title = 'Title must be less than 255 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    } else if (formData.description.length > 425) {
      newErrors.description = 'Description must be maximum 425 characters';
    }

    if (!formData.price) {
      newErrors.price = 'Price is required';
    } else {
      const price = parseInt(formData.price, 10);
      if (isNaN(price) || price < 0 || price > 10000) {
        newErrors.price = 'Please enter a valid price (0-10000)';
      }
    }

    if (selectedImages.length === 0) {
      newErrors.images = 'Please select at least one image';
    } else if (selectedImages.length > 1) {
      newErrors.images = 'Please select only one image';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSuccessMessage('');

    if (!validateForm()) return;

    if (!user || !student) {
      setSubmitError('User session expired. Please log in again.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress({ current: 0, total: selectedImages.length });

    try {
      const uploadResult = await uploadMultipleImages(
        selectedImages,
        user.id,
        (current, total) => {
          setUploadProgress({ current, total });
        }
      );

      if (!uploadResult.success || uploadResult.urls.length === 0) {
        setSubmitError(
          uploadResult.errors.length > 0
            ? `Failed to upload images: ${uploadResult.errors.join(', ')}`
            : 'Failed to upload images. Please try again.'
        );
        setIsSubmitting(false);
        return;
      }

      const productData = {
        branch: formData.branch || null,
        category: formData.category,
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: parseInt(formData.price, 10),
        imageUrls: uploadResult.urls,
      };

      const result = await createProduct(productData);

      if (result.success) {
        setSuccessMessage('Post created successfully! Redirecting...');
        imagePreviews.forEach((preview) => revokeImagePreview(preview));
        setTimeout(() => {
          navigate('/profile');
        }, 2000);
      } else {
        setSubmitError(result.error || 'Failed to create post. Please try again.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      setSubmitError(error.message || 'An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
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

  if (!user || !student) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Post</h1>
          <p className="mt-2 text-sm text-gray-600">Share your product with other students</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
          {/* Branch Selection */}
          <div>
            <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-2">
              Branch <span className="text-gray-500">(Optional)</span>
            </label>
            <select
              id="branch"
              name="branch"
              value={formData.branch}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                errors.branch ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              {branchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.branch && <p className="mt-1 text-sm text-red-600">{errors.branch}</p>}
          </div>

          {/* Category Selection */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                errors.category ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select a category</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              maxLength={255}
              placeholder="Enter product title"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            <div className="mt-1 flex justify-between">
              {errors.title ? (
                <p className="text-sm text-red-600">{errors.title}</p>
              ) : (
                <p className="text-sm text-gray-500">{formData.title.length}/255 characters</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={6}
              placeholder="Describe your product in detail..."
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            <div className="mt-1 flex justify-between">
              {errors.description ? (
                <p className="text-sm text-red-600">{errors.description}</p>
              ) : (
                <p className="text-sm text-gray-500">{formData.description.length}/425 characters</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photos <span className="text-red-500">*</span>
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-indigo-400 transition-colors">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h12m-4-4v12"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="image-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                  >
                    <span>Upload images</span>
                    <input
                      id="image-upload"
                      name="image-upload"
                      type="file"
                      className="sr-only"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      multiple
                      onChange={handleImageSelect}
                      disabled={isSubmitting}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 5MB each</p>
              </div>
            </div>

            {imageErrors.length > 0 && (
              <div className="mt-2 space-y-1">
                {imageErrors.map((error, index) => (
                  <p key={index} className="text-sm text-red-600">{error}</p>
                ))}
              </div>
            )}

            {imagePreviews.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-contain rounded-lg border border-gray-300 bg-gray-50"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      disabled={isSubmitting}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      aria-label="Remove image"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {errors.images && <p className="mt-2 text-sm text-red-600">{errors.images}</p>}
            {selectedImages.length > 0 && (
              <p className="mt-2 text-sm text-gray-600">{selectedImages.length} image(s) selected</p>
            )}
          </div>
          {/* Price */}
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
              Price (₹) <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <input
                  type="text"
                  id="price"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  onKeyPress={(e) => {
                    if (!/[0-9]/.test(e.key)) e.preventDefault();
                  }}
                  required
                  max="10000"
                  placeholder="0"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                    errors.price ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
              </div>

              {/* Price Predictor Panel - only shown when API key is set (use backend in production to avoid exposing key) */}
              {import.meta.env.VITE_GEMINI_API_KEY && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Price Predictor</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Uses Gemini to estimate a resale range (INR).
                    </p>
                  </div>
                </div>

                {/* Image context badge */}
                {selectedImages.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1.5">
                    {/* Thumbnail */}
                    <img
                      src={imagePreviews[0]}
                      alt="Product"
                      className="h-7 w-7 rounded object-cover border border-indigo-200 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-indigo-700 leading-tight">
                        Product image attached
                      </p>
                      <p className="text-[11px] text-indigo-500 leading-tight truncate">
                        Gemini will visually analyse it for a better estimate.
                      </p>
                    </div>
                    <svg className="ml-auto h-4 w-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                )}

                {!selectedImages.length && (
                  <p className="mt-2 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                    💡 Upload a product photo above first for a more accurate AI-powered estimate.
                  </p>
                )}

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="pred-name">
                      Name
                    </label>
                    <input
                      id="pred-name"
                      name="name"
                      value={predictor.name}
                      onChange={handlePredictorChange}
                      placeholder={formData.title ? `Using title: ${formData.title}` : 'e.g. Scientific calculator'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">Leave empty to use the Title field.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="condition">
                      Condition
                    </label>
                    <select
                      id="condition"
                      name="condition"
                      value={predictor.condition}
                      onChange={handlePredictorChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                      <option value="new">New / Unused</option>
                      <option value="like_new">Like new</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="originalPrice">
                      Original price (₹)
                    </label>
                    <input
                      id="originalPrice"
                      name="originalPrice"
                      value={predictor.originalPrice}
                      onChange={handlePredictorChange}
                      placeholder="e.g. 2500"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="boughtDate">
                      Bought date
                    </label>
                    <input
                      type="date"
                      id="boughtDate"
                      name="boughtDate"
                      value={predictor.boughtDate}
                      onChange={handlePredictorChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="targetAudience">
                      Target audience
                    </label>
                    <select
                      id="targetAudience"
                      name="targetAudience"
                      value={predictor.targetAudience}
                      onChange={handlePredictorChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                      <option value="students">Students (campus marketplace)</option>
                      <option value="general">General buyers</option>
                      <option value="collectors">Collectors / niche buyers</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="urgency">
                      Urgency to sell
                    </label>
                    <select
                      id="urgency"
                      name="urgency"
                      value={predictor.urgency}
                      onChange={handlePredictorChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                      <option value="low">Low (can wait for best price)</option>
                      <option value="medium">Medium</option>
                      <option value="high">High (need to sell fast)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={predictPriceRange}
                  disabled={isPredicting || isSubmitting}
                  className={`mt-3 w-full px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                    isPredicting || isSubmitting
                      ? 'bg-gray-200 text-gray-700 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {isPredicting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      {selectedImages.length > 0 ? 'Analysing image…' : 'Predicting…'}
                    </>
                  ) : (
                    <>
                      {selectedImages.length > 0 && (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                      Predict price range
                    </>
                  )}
                </button>

                {predictionError && (
                  <p className="mt-2 text-xs text-red-600">{predictionError}</p>
                )}

                {prediction && (
                  <div className="mt-3 rounded-lg bg-white border border-indigo-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-indigo-700">
                        Suggested range: ₹{prediction.min} – ₹{prediction.max}
                      </p>
                      {prediction.usedImage && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-500 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Image used
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-700">{prediction.summary}</p>
                  </div>
                )}
              </div>
              )}
            </div>
          </div>

          {/* Image Upload */}
          

          {/* Upload Progress */}
          {isSubmitting && uploadProgress.total > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-indigo-800">Uploading images...</span>
                <span className="text-sm text-indigo-600">
                  {uploadProgress.current} / {uploadProgress.total}
                </span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{submitError}</p>
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              disabled={isSubmitting}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSubmitting ? 'Uploading...' : 'Upload Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}