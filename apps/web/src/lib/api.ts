const getApiBaseUrl = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  
  // In production, use relative URLs (nginx proxies /api/ to the API server)
  // Ignore placeholder values from Docker build
  if (process.env.NODE_ENV === "production") {
    if (apiUrl && !apiUrl.includes("placeholder")) {
      return apiUrl;
    }
    return ""; // Empty - use relative URLs
  }
  
  // In development
  return apiUrl || "http://localhost:4000";
};

export const apiFetch = async <T>(
  path: string,
  options: RequestInit = {},
  token?: string
) => {
  const baseUrl = getApiBaseUrl();
  // Handle both absolute URLs (development) and relative URLs (production)
  const url = baseUrl ? new URL(path, baseUrl).toString() : `/api${path}`;
  
  // Only set Content-Type for requests with a body
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {})
  };
  
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API error ${response.status}`);
  }

  return (await response.json()) as T;
};
