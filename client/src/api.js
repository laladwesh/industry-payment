import axios from "axios";

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:5000/ccd-industry/api"
    : process.env.REACT_APP_API_BASE || "/ccd-industry/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("industry_auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
