const getApiBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const apiFetch = async <T>(
  path: string,
  options: RequestInit = {},
  token?: string
) => {
  const url = new URL(path, getApiBaseUrl());
  
  // Only set Content-Type for requests with a body
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {})
  };
  
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API error ${response.status}`);
  }

  return (await response.json()) as T;
};
