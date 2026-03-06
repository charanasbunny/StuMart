import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCurrentAdmin,
  getStudentStatistics,
  getStudentRegistrationTrends,
  getStudentBranchDistribution,
} from '../services/adminService';
import { getPINStatistics } from '../services/pinService';
import { getAllProductsForAdmin } from '../services/productService';
import { getFeedbackForAdmin } from '../services/feedbackService';
import AdminLayout from '../components/admin/AdminLayout';

const CATEGORY_LABELS = {
  books: 'Books',
  stationary: 'Stationery',
  electronics: 'Electronics',
  others: 'Others',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [pinStats, setPinStats] = useState({
    totalPINs: 0,
    availablePINs: 0,
    registeredPINs: 0,
    branchesCount: 0,
    sectionsCount: 0,
    branches: [],
    sections: [],
  });
  const [pinStatsLoading, setPinStatsLoading] = useState(true);
  const [studentStats, setStudentStats] = useState({
    total: 0,
    pending: 0,
    active: 0,
    week: 0,
    month: 0,
    branches: [],
  });
  const [productStats, setProductStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    freeCount: 0,
    topCategory: 'N/A',
    latestFive: [],
    highestPriced: null,
    latest: null,
  });
  const [feedbackStats, setFeedbackStats] = useState({
    total: 0,
    unresolved: 0,
    latest: null,
  });

  /**
   * Load current admin data and statistics
   */
  const loadAdminData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const { admin: adminData, error } = await getCurrentAdmin();

        if (error || !adminData) {
          navigate('/login?type=admin');
          return;
        }

        setAdmin(adminData);

        const [
          pinStatsResult,
          studentStatsResult,
          trendResult,
          branchResult,
          productsResult,
          feedbackResult,
        ] = await Promise.all([
          getPINStatistics(),
          getStudentStatistics(),
          getStudentRegistrationTrends(),
          getStudentBranchDistribution(),
          getAllProductsForAdmin(),
          getFeedbackForAdmin(),
        ]);

        if (pinStatsResult.success && pinStatsResult.data) {
          setPinStats({
            totalPINs: pinStatsResult.data.totalPINs || 0,
            availablePINs: pinStatsResult.data.availablePINs || 0,
            registeredPINs: pinStatsResult.data.registeredPINs || 0,
            branchesCount: pinStatsResult.data.branchesCount || 0,
            sectionsCount: pinStatsResult.data.sectionsCount || 0,
            branches: pinStatsResult.data.branches || [],
            sections: pinStatsResult.data.sections || [],
          });
        }
        setPinStatsLoading(false);

        if (studentStatsResult.success && studentStatsResult.data) {
          setStudentStats((prev) => ({
            ...prev,
            total: studentStatsResult.data.total || 0,
            pending: studentStatsResult.data.pending || 0,
            active: studentStatsResult.data.active || 0,
          }));
        }

        if (trendResult.success && trendResult.data) {
          setStudentStats((prev) => ({
            ...prev,
            week: trendResult.data.week || 0,
            month: trendResult.data.month || 0,
          }));
        }

        if (branchResult.success && branchResult.data) {
          setStudentStats((prev) => ({
            ...prev,
            branches: branchResult.data || [],
          }));
        }

        const products = productsResult.success ? productsResult.data || [] : [];
        const sortedProducts = [...products].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        const totalProducts = products.length;
        const activeProducts = products.filter(
          (item) => (item.status || 'active') === 'active'
        ).length;
        const inactiveProducts = totalProducts - activeProducts;
        const freeCount = products.filter(
          (item) => parseInt(item.price, 10) === 0
        ).length;
        const categoryCounts = products.reduce((acc, item) => {
          const category = item.category || 'unknown';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {});
        const topCategoryKey = Object.entries(categoryCounts).sort(
          (a, b) => b[1] - a[1]
        )[0]?.[0];
        const topCategory = CATEGORY_LABELS[topCategoryKey] || topCategoryKey || 'N/A';
        const highestPriced = products.reduce((max, item) => {
          if (!item) return max;
          const price = parseInt(item.price, 10) || 0;
          const maxPrice = max ? parseInt(max.price, 10) || 0 : -1;
          return price > maxPrice ? item : max;
        }, null);

        setProductStats({
          total: totalProducts,
          active: activeProducts,
          inactive: inactiveProducts,
          freeCount,
          topCategory,
          latestFive: sortedProducts.slice(0, 5),
          highestPriced,
          latest: sortedProducts[0] || null,
        });

        const feedbacks = feedbackResult.success ? feedbackResult.data || [] : [];
        const latestFeedback = feedbacks[0] || null;
        setFeedbackStats({
          total: feedbacks.length,
          unresolved: feedbacks.length,
          latest: latestFeedback,
        });
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Error loading admin data:', error);
        navigate('/login?type=admin');
      } finally {
        if (isRefresh) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [navigate]
  );

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // Show loading state
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

  // Don't render if admin data is not available (will redirect)
  if (!admin) {
    return null;
  }

  return (
    <AdminLayout
      title="Admin Dashboard"
      lastUpdated={lastUpdated}
      onRefresh={() => loadAdminData(true)}
      isRefreshing={isRefreshing}
    >
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div className="admin-card p-3 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
            Welcome, Admin!
          </h2>
          <p className="text-sm sm:text-base text-gray-600">
            This admin space is for AANM &amp; VVRSR GvlPolyMart. You can manage listings,
            student access, and feedback from here.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
          <div className="admin-card p-3 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">System Health</h2>
                <p className="text-xs sm:text-sm text-gray-500">Operational summary.</p>
              </div>
              <button
                type="button"
                onClick={() => loadAdminData(true)}
                disabled={isRefreshing}
                className="admin-button admin-button--ghost"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 3v6h-6" />
                </svg>
                <span className="admin-refresh-label">
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="admin-stat col-span-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Admin Email</p>
                <p className="text-sm font-semibold text-gray-900 mt-2 break-all">
                  {admin.email || 'N/A'}
                </p>
              </div>
              <div className="admin-stat">
                <p className="text-xs uppercase tracking-wide text-gray-500">Active Students</p>
                <p className="text-2xl font-semibold text-emerald-600 mt-2">
                  {studentStats.active}
                </p>
              </div>
              <div className="admin-stat">
                <p className="text-xs uppercase tracking-wide text-gray-500">Feedback Count</p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">
                  {feedbackStats.total}
                </p>
              </div>
            </div>
          </div>

          <div className="admin-card p-3 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Product Summary</h2>
                <p className="text-xs sm:text-sm text-gray-500">Marketplace health snapshot.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2">
              <div className="admin-stat">
                <p className="text-xs uppercase tracking-wide text-gray-500">Active Products</p>
                <p className="text-2xl font-semibold text-emerald-600 mt-2">
                  {productStats.active}
                </p>
              </div>
              <div className="admin-stat">
                <p className="text-xs uppercase tracking-wide text-gray-500">Inactive Products</p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">
                  {productStats.inactive}
                </p>
              </div>
              <div className="admin-stat">
                <p className="text-xs uppercase tracking-wide text-gray-500">Free Listings</p>
                <p className="text-2xl font-semibold text-sky-600 mt-2">
                  {productStats.freeCount}
                </p>
              </div>
              <div className="admin-stat">
                <p className="text-xs uppercase tracking-wide text-gray-500">Top Category</p>
                <p className="text-lg font-semibold text-gray-900 mt-2">
                  {productStats.topCategory}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-card p-3 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                PIN Management Stats
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">Live status of student registrations.</p>
            </div>
            <div className="admin-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h6" />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="admin-stat">
              <p className="text-xs uppercase tracking-wide text-gray-500">Total PINs</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">
                {pinStatsLoading ? '...' : pinStats.totalPINs}
              </p>
            </div>
            <div className="admin-stat">
              <p className="text-xs uppercase tracking-wide text-gray-500">Available</p>
              <p className="text-2xl font-semibold text-emerald-600 mt-2">
                {pinStatsLoading ? '...' : pinStats.availablePINs}
              </p>
            </div>
            <div className="admin-stat">
              <p className="text-xs uppercase tracking-wide text-gray-500">Registered</p>
              <p className="text-2xl font-semibold text-sky-600 mt-2">
                {pinStatsLoading ? '...' : pinStats.registeredPINs}
              </p>
            </div>
            <div className="admin-stat">
              <p className="text-xs uppercase tracking-wide text-gray-500">Branches</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">
                {pinStatsLoading ? '...' : pinStats.branchesCount}
              </p>
              {!pinStatsLoading && pinStats.branches.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {pinStats.branches.join(', ')}
                </p>
              )}
            </div>
            <div className="admin-stat">
              <p className="text-xs uppercase tracking-wide text-gray-500">Sections</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">
                {pinStatsLoading ? '...' : pinStats.sectionsCount}
              </p>
              {!pinStatsLoading && pinStats.sections.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {pinStats.sections.slice(0, 5).join(', ')}
                  {pinStats.sections.length > 5 && ` +${pinStats.sections.length - 5} more`}
                </p>
              )}
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}



