import { lazy, Suspense } from "react";
import ProtectedRoute from "./components/ProtectedRoute";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import { Navigate } from "react-router-dom";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const CreatePost = lazy(() => import("./pages/CreatePost"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const MyPosts = lazy(() => import("./pages/MyPosts"));
const CustomerFeedback = lazy(() => import("./pages/CustomerFeedback"));
const AdminFeedbacks = lazy(() => import("./pages/AdminFeedbacks"));
const AdminPINManagement = lazy(() => import("./pages/AdminPINManagement"));
const AdminProducts = lazy(() => import("./pages/AdminProducts"));
const AdminProductDetail = lazy(() => import("./pages/AdminProductDetail"));
const AdminRegistrationRequests = lazy(() => import("./pages/AdminRegistrationRequests"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const CompleteSignup = lazy(() => import("./pages/CompleteSignup"));
const Checkout = lazy(() => import("./pages/Checkout"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));

const RouteLoader = () => (
  <div className="min-h-[50vh] flex items-center justify-center bg-slate-50">
    <div className="text-sm text-slate-600">Loading page...</div>
  </div>
);

const withRouteSuspense = (Component) => (
  <Suspense fallback={<RouteLoader />}>
    <Component />
  </Suspense>
);

export const publicRoutes = [
  { path: "/", element: withRouteSuspense(Home) },

  { path: "/about", element: withRouteSuspense(AboutUs) },
  { path: "/contact", element: withRouteSuspense(ContactUs) },

  { path: "/products", element: withRouteSuspense(Products) },
  { path: "/products/:id", element: withRouteSuspense(ProductDetail) },
  {
    path: "/checkout/:productId",
    element: (
      <ProtectedRoute>
        {withRouteSuspense(Checkout)}
      </ProtectedRoute>
    ),
  },

  { path: "/login", element: withRouteSuspense(Login) },
  { path: "/register", element: withRouteSuspense(Register) },
  { path: "/complete-signup", element: withRouteSuspense(CompleteSignup) },

  {
    path: "/profile",
    element: (
      <ProtectedRoute>
        {withRouteSuspense(Profile)}
      </ProtectedRoute>
    ),
  },
  { path: "/Profile", element: <Navigate to="/profile" replace /> },

  {
    path: "/create-post",
    element: (
      <ProtectedRoute>
        {withRouteSuspense(CreatePost)}
      </ProtectedRoute>
    ),
  },

  {
    path: "/my-posts",
    element: (
      <ProtectedRoute>
        {withRouteSuspense(MyPosts)}
      </ProtectedRoute>
    ),
  },
  { path: "/MyPosts", element: <Navigate to="/my-posts" replace /> },
  {
    path: "/my-orders",
    element: (
      <ProtectedRoute>
        {withRouteSuspense(MyOrders)}
      </ProtectedRoute>
    ),
  },


  { path: "/forgot-password", element: withRouteSuspense(ForgotPassword) },
  {
    path: "/customer-feedback",
    element: withRouteSuspense(CustomerFeedback),
  },
  { path: "*", element: <Navigate to="/" replace /> },

];

export const adminRoutes = [
  { path: "/admin/login", element: <Navigate to="/login?type=admin" replace /> },

  {
    path: "/admin/dashboard",
    element: (
      <ProtectedAdminRoute>
        {withRouteSuspense(AdminDashboard)}
      </ProtectedAdminRoute>
    ),
  },

  {
    path: "/admin/pin-management",
    element: (
      <ProtectedAdminRoute>
        {withRouteSuspense(AdminPINManagement)}
      </ProtectedAdminRoute>
    ),
  },

  {
    path: "/admin/registration-requests",
    element: (
      <ProtectedAdminRoute>
        {withRouteSuspense(AdminRegistrationRequests)}
      </ProtectedAdminRoute>
    ),
  },

  {
    path: "/admin/products",
    element: (
      <ProtectedAdminRoute>
        {withRouteSuspense(AdminProducts)}
      </ProtectedAdminRoute>
    ),
  },

  {
    path: "/admin/products/:id",
    element: (
      <ProtectedAdminRoute>
        {withRouteSuspense(AdminProductDetail)}
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "/admin/orders",
    element: (
      <ProtectedAdminRoute>
        {withRouteSuspense(AdminOrders)}
      </ProtectedAdminRoute>
    ),
  },
  {
    path: "/admin/feedbacks",
    element: (
      <ProtectedAdminRoute>
        {withRouteSuspense(AdminFeedbacks)}
      </ProtectedAdminRoute>
    ),
  },
  { path: "/admin/*", element: <Navigate to="/admin/dashboard" replace /> },
];
