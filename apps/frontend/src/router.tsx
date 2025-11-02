import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useLocationTracking } from "./hooks/useLocationTracking";

import AdminShell from "./components/AdminShell";
import Navbar from "./components/Navbar";
import AdminPanel from "./pages/AdminPanel";
import AdminSettings from "./pages/AdminSettings";
import Attendance from "./pages/Attendance";
import CashCut from "./pages/CashCut";
import Dashboard from "./pages/Dashboard";
import Finance from "./pages/Finance";
import Inventory from "./pages/Inventory";
import LoginPage from "./pages/LoginPage";
import MessagesPage from "./pages/Messages";
import MyTasks from "./pages/MyTasks";
import Profile from "./pages/Profile";
import RegisterPage from "./pages/RegisterPage";
import TasksAdmin from "./pages/TasksAdmin";
import Workers from "./pages/Workers";
import { WorkersMap } from "./pages/WorkersMap";
import ClientesAdminPage from "./pages/admin/clientes";

function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster richColors position="top-right" />
    </>
  );
}

function AppLogic() {
  useLocationTracking();
  return <RootLayout />;
}

function WithAuth() {
  return (
    <AuthProvider>
      <AppLogic />
    </AuthProvider>
  );
}

function Protected({
  children,
  role,
}: {
  children: JSX.Element;
  role?: "ADMIN" | "USER";
}) {
  const { user, initializing } = useAuth();
  if (initializing) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function AdminSwitch() {
  const { user } = useAuth();
  if (user?.role === "ADMIN")
    return (
      <AdminShell>
        <AdminPanel />
      </AdminShell>
    );
  return (
    <>
      <Navbar />
      <Dashboard />
    </>
  );
}

function MessagesRoute() {
  const { user } = useAuth();
  if (user?.role === "ADMIN")
    return (
      <AdminShell>
        <MessagesPage />
      </AdminShell>
    );
  return (
    <>
      <Navbar />
      <MessagesPage />
    </>
  );
}

function InventoryRoute() {
  const { user } = useAuth();
  if (user?.role === "ADMIN")
    return (
      <AdminShell>
        <Inventory />
      </AdminShell>
    );
  return (
    <>
      <Navbar />
      <Inventory />
    </>
  );
}

function FinanceRoute() {
  const { user } = useAuth();
  // ADMIN ve el módulo completo de Finanzas en AdminShell, USER ve el corte de caja con Navbar
  if (user?.role === "ADMIN")
    return (
      <AdminShell>
        <Finance />
      </AdminShell>
    );
  return (
    <>
      <Navbar />
      <CashCut />
    </>
  );
}

const futureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as any;

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <WithAuth />,
      children: [
        {
          index: true,
          element: (
            <Protected>
              <AdminSwitch />
            </Protected>
          ),
        },
        { path: "login", element: <LoginPage /> },
        { path: "register", element: <RegisterPage /> },
        {
          path: "workers",
          element: (
            <Protected role="ADMIN">
              <AdminShell>
                <Workers />
              </AdminShell>
            </Protected>
          ),
        },
        {
          path: "messages",
          element: (
            <Protected>
              <MessagesRoute />
            </Protected>
          ),
        },
        {
          path: "profile",
          element: (
            <Protected>
              <>
                <Navbar />
                <Profile />
              </>
            </Protected>
          ),
        },
        {
          path: "admin-settings",
          element: (
            <Protected role="ADMIN">
              <AdminShell>
                <AdminSettings />
              </AdminShell>
            </Protected>
          ),
        },
        {
          path: "attendance",
          element: (
            <Protected role="ADMIN">
              <AdminShell>
                <Attendance />
              </AdminShell>
            </Protected>
          ),
        },
        {
          path: "admin/clientes",
          element: (
            <Protected role="ADMIN">
              <AdminShell>
                <ClientesAdminPage />
              </AdminShell>
            </Protected>
          ),
        },
        {
          path: "inventory",
          element: (
            <Protected>
              <InventoryRoute />
            </Protected>
          ),
        },
        // Finanzas visible para ADMIN y USER usando selector de layout/contenido
        {
          path: "finance",
          element: (
            <Protected>
              <FinanceRoute />
            </Protected>
          ),
        },
        {
          path: "finanzas",
          element: (
            <Protected>
              <FinanceRoute />
            </Protected>
          ),
        },
        // compatibilidad: redirigir /cash-cut a /finanzas
        { path: "cash-cut", element: <Navigate to="/finanzas" replace /> },
        {
          path: "tasks-admin",
          element: (
            <Protected role="ADMIN">
              <AdminShell>
                <TasksAdmin />
              </AdminShell>
            </Protected>
          ),
        },
        {
          path: "my-tasks",
          element: (
            <Protected>
              <>
                <Navbar />
                <MyTasks />
              </>
            </Protected>
          ),
        },
        {
          path: "mapa-de-ubicacion",
          element: (
            <Protected role="ADMIN">
              <AdminShell>
                <WorkersMap />
              </AdminShell>
            </Protected>
          ),
        },
        { path: "*", element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { future: futureFlags }
);

export default router;
