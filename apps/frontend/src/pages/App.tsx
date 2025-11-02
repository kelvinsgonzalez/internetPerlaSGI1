import { Navigate, Route, Routes } from "react-router-dom";
import AdminShell from "../components/AdminShell";
import Navbar from "../components/Navbar";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import AdminPanel from "./AdminPanel";
import Attendance from "./Attendance";
import CashCut from "./CashCut";
import Dashboard from "./Dashboard";
import Finance from "./Finance";
import Inventory from "./Inventory";
import LoginPage from "./LoginPage";
import MessagesPage from "./Messages";
import MyTasks from "./MyTasks";
import Profile from "./Profile";
import RegisterPage from "./RegisterPage";
import TasksAdmin from "./TasksAdmin";
import Workers from "./Workers";

function Protected({
  children,
  role,
}: {
  children: JSX.Element;
  role?: "ADMIN" | "USER";
}) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <Protected>
              <AdminSwitch />
            </Protected>
          }
        />
        <Route
          path="/workers"
          element={
            <Protected role="ADMIN">
              <AdminShell>
                <Workers />
              </AdminShell>
            </Protected>
          }
        />
        <Route
          path="/messages"
          element={
            <Protected>
              <MessagesRoute />
            </Protected>
          }
        />
        <Route
          path="/profile"
          element={
            <Protected>
              <>
                <Navbar />
                <Profile />
              </>
            </Protected>
          }
        />
        <Route
          path="/attendance"
          element={
            <Protected role="ADMIN">
              <AdminShell>
                <Attendance />
              </AdminShell>
            </Protected>
          }
        />
        <Route
          path="/inventory"
          element={
            <Protected role="ADMIN">
              <AdminShell>
                <Inventory />
              </AdminShell>
            </Protected>
          }
        />
        <Route
          path="/finance"
          element={
            <Protected role="ADMIN">
              <AdminShell>
                <Finance />
              </AdminShell>
            </Protected>
          }
        />
        <Route
          path="/tasks-admin"
          element={
            <Protected role="ADMIN">
              <AdminShell>
                <TasksAdmin />
              </AdminShell>
            </Protected>
          }
        />
        <Route
          path="/my-tasks"
          element={
            <Protected>
              <>
                <Navbar />
                <MyTasks />
              </>
            </Protected>
          }
        />
        <Route
          path="/cash-cut"
          element={
            <Protected>
              <>
                <Navbar />
                <CashCut />
              </>
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AuthProvider>
  );
}

function RoleSwitch() {
  const { user } = useAuth();
  if (user?.role === "ADMIN") return <AdminPanel />;
  return <Dashboard />;
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
  return <MessagesPage />;
}
