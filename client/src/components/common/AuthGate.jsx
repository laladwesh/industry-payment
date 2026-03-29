import { Navigate } from "react-router-dom";
import { getAuthToken } from "../../utils/authStorage";

function AuthGate({ children }) {
  if (!getAuthToken()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default AuthGate;
