import { Navigate, Route, Routes, useParams } from "react-router-dom";
import AuthGate from "./components/common/AuthGate";
import { getAuthToken } from "./utils/authStorage";
import AdminPage from "./pages/AdminPage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import RegistrationProgressPage from "./pages/RegistrationProgressPage";

function LandingRedirect() {
  const token = getAuthToken();
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      const targetPath = payload?.role === "admin" ? "/admin" : "/dashboard";
      return <Navigate to={targetPath} replace />;
    } catch (_error) {
      return <Navigate to="/dashboard" replace />;
    }
  }
  return <Navigate to="/login" replace />;
}

function LegacyPaymentRedirect() {
  const { registrationId } = useParams();
  return <Navigate to={`/registration/${registrationId}`} replace />;
}

function App() {
  return (
    <div className="min-h-screen bg-[#f3f6fd] text-slate-900">

      <Routes>
        <Route path="/" element={<LandingRedirect />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route
          path="/dashboard"
          element={
            <AuthGate>
              <DashboardPage />
            </AuthGate>
          }
        />
        <Route
          path="/registration/:registrationId"
          element={
            <AuthGate>
              <RegistrationProgressPage />
            </AuthGate>
          }
        />
        <Route
          path="/admin"
          element={
            <AuthGate>
              <AdminPage />
            </AuthGate>
          }
        />
        <Route path="/payment/:registrationId" element={<LegacyPaymentRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
