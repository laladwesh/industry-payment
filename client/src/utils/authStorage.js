const AUTH_KEY = "industry_auth_token";

export function getAuthToken() {
  return localStorage.getItem(AUTH_KEY);
}

export function saveAuth(token) {
  localStorage.setItem(AUTH_KEY, token);
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}
