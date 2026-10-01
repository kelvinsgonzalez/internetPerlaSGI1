import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useLocationTracking } from "./hooks/useLocationTracking";
import { ReleasesProvider } from "./hooks/useReleases";
import { isManager, MANAGEMENT_ROLES, type Role } from "./services/roles";

import AdminShell from "./components/AdminShell";
import Navbar from "./components/Navbar";
import AdminPanel from "./pages/AdminPanel";
import AdminSettings from "./pages/AdminSettings";
import AuditLog from "./pages/AuditLog";
import Attendance from "./pages/Attendance";
import CashCut from "./pages/CashCut";
import Dashboard from "./pages/Dashboard";
import Finance from "./pages/Finance";
import Historial from "./pages/Historial";
import InventoryHome from "./pages/InventoryHome";
import InventoryStatus from "./pages/InventoryStatus";
import InventoryMovements from "./pages/InventoryMovements";
import InventoryConfig from "./pages/InventoryConfig";
import LoginPage from "./pages/LoginPage";
import MessagesPage from "./pages/Messages";
import MyTasks from "./pages/MyTasks";
import Profile from "./pages/Profile";
import ReleasesAdmin from "./pages/ReleasesAdmin";
import TaskArchive from "./pages/TaskArchive";
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
  return (
    <ReleasesProvider>
      <RootLayout />
    </ReleasesProvider>
  );
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
  roles,
}: {
  children: JSX.Element;
  roles?: Role[];
}) {
  const { user, initializing } = useAuth();
  if (initializing) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AdminSwitch() {
  const { user } = useAuth();
  // El SUPERVISOR no tiene Dashboard: entra directo a su primer módulo.
  if (user?.role === "SUPERVISOR") return <Navigate to="/attendance" replace />;
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
  if (isManager(user?.role))
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

function InventoryRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (user?.role === "ADMIN")
    return <AdminShell>{children}</AdminShell>;
  // El SUPERVISOR no tiene acceso al módulo de Inventario.
  if (user?.role === "SUPERVISOR") return <Navigate to="/" replace />;
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

function FinanceRoute() {
  const { user } = useAuth();
  // ADMIN/SUPERVISOR ven el módulo completo de Finanzas en AdminShell, USER ve el corte de caja con Navbar
  if (isManager(user?.role))
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
        {
          path: "workers",
          element: (
            <Protected roles={["ADMIN"]}>
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
            <Protected roles={["ADMIN"]}>
              <AdminShell>
                <AdminSettings />
              </AdminShell>
            </Protected>
          ),
        },
        {
          path: "attendance",
          element: (
            <Protected roles={MANAGEMENT_ROLES}>
              <AdminShell>
                <Attendance />
              </AdminShell>
            </Protected>
          ),
        },
        {
          path: "admin/clientes",
          element: (
            <Protected roles={["ADMIN"]}>
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
              <InventoryRoute>
                <InventoryHome />
              </InventoryRoute>
            </Protected>
          ),
        },
        {
          path: "inventory/estatus",
          element: (
            <Protected>
              <InventoryRoute>
                <InventoryStatus />
              </InventoryRoute>
            </Protected>
          ),
        },
        {
          path: "inventory/movimientos",
          element: (
            <Protected>
              <InventoryRoute>
                <InventoryMovements />
              </InventoryRoute>
            </Protected>
          ),
        },
        {
          path: "inventory/config",
          element: (
            <Protected roles={["ADMIN"]}>
              <AdminShell>
                <InventoryConfig />
              </AdminShell>
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
            <Protected roles={MANAGEMENT_ROLES}>
              <AdminShell>
                <TasksAdmin />
              </AdminShell>
            </Protected>
          ),
        },
        {
          path: "archivo-tareas",
          element: (
            <Protected roles={MANAGEMENT_ROLES}>
              <AdminShell>
                <TaskArchive />
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
            <Protected roles={MANAGEMENT_ROLES}>
              <AdminShell>
                <WorkersMap />
              </AdminShell>
            </Protected>
          ),
        },
        {
          path: "historial",
          element: (
            <Protected roles={MANAGEMENT_ROLES}>
              <AdminShell>
                <Historial />
              </AdminShell>
            </Protected>
          ),
        },
        {
          path: "auditoria",
          element: (
            <Protected roles={["ADMIN"]}>
              <AdminShell>
                <AuditLog />
              </AdminShell>
            </Protected>
          ),
        },
        {
          path: "versiones",
          element: (
            <Protected roles={["ADMIN"]}>
              <AdminShell>
                <ReleasesAdmin />
              </AdminShell>
            </Protected>
          ),
        },
        { path: "*", element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { future: futureFlags, basename: "/crm" }
);

export default router;
