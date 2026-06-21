const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("taskflow-token") || "";
}

export function setToken(token) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("taskflow-token", token);
  else localStorage.removeItem("taskflow-token");
}

export async function api(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}
