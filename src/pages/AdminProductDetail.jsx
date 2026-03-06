import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCurrentAdmin } from '../services/adminService';
import { getProductDetailForAdmin } from '../services/productService';
import AdminLayout from '../components/admin/AdminLayout';

export default function AdminProductDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [admin, setAdmin] = useState(null);
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const loadProduct = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const { admin: adminData, error: adminError } = await getCurrentAdmin();
        if (adminError || !adminData) {
          navigate('/login?type=admin');
          return;
        }
        setAdmin(adminData);

        const result = await getProductDetailForAdmin(id);
        if (result.success) {
          setProduct(result.data);
        } else {
          setError(result.error || 'Failed to load product');
        }
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Failed to load product detail:', error);
        setError('Unexpected error');
      } finally {
        if (isRefresh) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [id, navigate]
  );

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !admin || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">{error || 'Product not found'}</p>
      </div>
    );
  }

  const image =
    product.image_urls?.[0] ||
    'https://via.placeholder.com/500x400?text=No+Image';

  const handleShare = async () => {
    const shareData = {
      title: product.title || 'GvlPolyMart Product',
      text: product.title || 'Product details',
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        alert('Link copied to clipboard.');
      }
    } catch (err) {
      console.error('Share failed:', err);
      alert('Unable to share right now.');
    }
  };

  return (
    <AdminLayout
      title="Product Detail"
      subtitle="Review listing information and seller details."
      backTo="/admin/products"
      lastUpdated={lastUpdated}
      onRefresh={() => loadProduct(true)}
      isRefreshing={isRefreshing}
    >
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="admin-card p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="admin-media-frame aspect-[4/3]">
              <img
                src={image}
                alt={product.title}
                className="admin-media-image"
                loading="lazy"
              />
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {product.title}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Category: {product.category || 'N/A'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleShare}
                className="admin-button admin-button--ghost"
                aria-label="Share product"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4" />
                </svg>
                Share
              </button>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="admin-soft-card px-4 py-2">
                <p className="text-xs text-gray-500">Price</p>
                <p className="font-semibold text-emerald-600">
                  {parseInt(product.price, 10) === 0 ? 'FREE' : `₹ ${parseInt(product.price, 10)}`}
                </p>
              </div>

              <div className="admin-soft-card px-4 py-2">
                <p className="text-xs text-gray-500">Status</p>
                <p className="font-semibold">
                  {product.status || 'Active'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <p className="text-xs text-gray-500">Seller</p>
                <p className="font-medium">{product.students?.name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">PIN</p>
                <p className="font-medium">{product.student_pin_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-medium break-all">
                  {product.students?.email || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-card p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Description
          </h3>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">
            {product.description || 'No description provided.'}
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
