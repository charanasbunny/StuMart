import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { adminSignOut } from '../../services/adminService';
import ImageLightbox from '../ui/ImageLightbox';

const navItems = [
  {
    to: '/admin/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5a1 1 0 0 1-1-1v-4.5h-3V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  {
    to: '/admin/pin-management',
    label: 'PINs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 12h10M7 17h6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5h14a2 2 0 0 1 2 2v8a4 4 0 0 1-4 4H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      </svg>
    ),
  },
  {
    to: '/admin/registration-requests',
    label: 'Registration requests',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
  },
  {
    to: '/admin/products',
    label: 'Products',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7.5 12 3l8.5 4.5-8.5 4.5-8.5-4.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 12.5 12 17l8.5-4.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 17.5 12 22l8.5-4.5" />
      </svg>
    ),
  },
  {
    to: '/admin/feedbacks',
    label: 'Feedback',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16a2 2 0 0 1 2 2v8a4 4 0 0 1-4 4H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      </svg>
    ),
  },
];

const navLabel = (item) => item.label.toLowerCase();

export default function AdminLayout({
  title,
  subtitle,
  backTo,
  lastUpdated,
  onRefresh,
  isRefreshing = false,
  children,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoLightboxOpen, setIsLogoLightboxOpen] = useState(false);

  const activePath = useMemo(() => location.pathname, [location.pathname]);
  const updatedLabel = lastUpdated ? lastUpdated.toLocaleString() : null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const result = await adminSignOut();
      if (!result.success) {
        console.error(result.error || 'Failed to logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen admin-theme">
      <div className="admin-shell">
        <aside className="admin-sidebar hidden lg:flex">
          <div className="admin-sidebar-header">
            <button
              type="button"
              onClick={() => setIsLogoLightboxOpen(true)}
              aria-label="Open logo"
            >
              <img
                src="/newlogotransparent.png"
                alt="StuMart Logo"
                className="w-[84px] h-[84px] object-contain mb-5"
              />
            </button>
            <div className="admin-brand">StuMart Admin</div>
            <p className="admin-brand-sub">Operations console</p>
          </div>
          <nav className="admin-nav">
            {navItems.map((item) => {
              const isActive = activePath.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`admin-nav-link ${isActive ? 'admin-nav-link--active' : ''}`}
                >
                  <span className="admin-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="admin-main">
          <header className="admin-header">
            <div className="admin-header-content flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsLogoLightboxOpen(true)}
                  aria-label="Open logo"
                  className="lg:hidden"
                >
                  <img
                    src="/newlogotransparent.png"
                    alt="StuMart Logo"
                    className="h-[84px] w-[84px] object-contain"
                  />
                </button>
                <div className="admin-title-row min-w-0">
                  {backTo && (
                    <button
                      type="button"
                      onClick={() => navigate(backTo)}
                      className="admin-back-button"
                      aria-label="Go back"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  <h1 className="admin-title">{title}</h1>
                </div>
              </div>
              <div className="admin-header-actions flex items-center gap-2">
                {updatedLabel && (
                  <span className="admin-updated">Updated {updatedLabel}</span>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="admin-button lg:hidden"
                >
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </button>
              </div>
            </div>
            <div className="admin-nav-mobile lg:hidden" aria-label="Admin navigation">
              {navItems.map((item) => {
                const isActive = activePath.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`admin-nav-pill ${isActive ? 'admin-nav-pill--active' : ''}`}
                  >
                    <span className="admin-nav-icon">{item.icon}</span>
                    <span>{navLabel(item)}</span>
                  </Link>
                );
              })}
            </div>
          </header>

          <main className="admin-content admin-animate-in">{children}</main>
        </div>
      </div>

      <ImageLightbox
        src="/newlogotransparent.png"
        alt="StuMart Logo"
        isOpen={isLogoLightboxOpen}
        onClose={() => setIsLogoLightboxOpen(false)}
      />
    </div>
  );
}
