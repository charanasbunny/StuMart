import { createRoot } from "react-dom/client";
import "./index.css";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { publicRoutes, adminRoutes } from "./routes";
import Layout from "./pages/Layout";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: publicRoutes,
  },
  ...adminRoutes,
]);

createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />
);
