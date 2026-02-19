import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentAdmin } from '../services/adminService';
import { getPINStatistics } from '../services/pinService';
import AdminLayout from '../components/admin/AdminLayout';

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

        const pinStatsResult = await getPINStatistics();
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
      subtitle="StuMart - AANM VVRSR Polytechnic Gudlavalleru"
      lastUpdated={lastUpdated}
      onRefresh={() => loadAdminData(true)}
      isRefreshing={isRefreshing}
    >
      <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
        <div className="admin-card p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
            Welcome, Admin
          </h2>
          <p className="text-sm sm:text-base text-gray-600">
            Review the latest listings, then check feedback and PIN status when needed.
            Everything you need is in the navigation.
          </p>
        </div>

        

        <div className="admin-card p-4 sm:p-6">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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



