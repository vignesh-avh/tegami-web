import { 
  HomeProduct, ProductSectionResponse, ShopSearchResponse, ShopDetailsResponse, 
  UserDetails, AuthResponse, LoginRequest, SignupRequest, OwnerNotification, Product
} from "./types";

const BASE_URL = "https://api.avapp.in/";

export const getToken = () => {
  if (typeof window !== "undefined") return localStorage.getItem("av_access_token");
  return null;
};

export const setToken = (token: string) => {
  if (typeof window !== "undefined") localStorage.setItem("av_access_token", token);
};

export const setRefreshToken = (token: string) => {
  if (typeof window !== "undefined") localStorage.setItem("av_refresh_token", token);
};

export const clearToken = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("av_access_token");
    localStorage.removeItem("av_refresh_token");
  }
};

export const getUserIdFromToken = () => {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub;
  } catch { return null; }
};

export const getUserRoleFromToken = () => {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role;
  } catch { return null; }
};

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  return res; 
};

// --- AUTH ENDPOINTS ---

export const loginUser = async (data: LoginRequest) => {
  const res = await apiFetch("auth/login", { method: "POST", body: JSON.stringify(data) });
  if (res.ok) {
    const auth: AuthResponse = await res.json();
    setToken(auth.access_token);
    if (auth.refresh_token) setRefreshToken(auth.refresh_token);
    return { success: true, status: res.status };
  }
  return { success: false, status: res.status };
};

export const signupUser = async (data: SignupRequest) => {
  const res = await apiFetch("auth/signup", { method: "POST", body: JSON.stringify(data) });
  return { success: res.ok, status: res.status };
};

export const verifyOtp = async (email: string, otp: string) => {
  const res = await apiFetch("auth/verify-otp", { method: "POST", body: JSON.stringify({ email, otp }) });
  if (res.ok) {
    const auth: AuthResponse = await res.json();
    return { success: true, token: auth.access_token, refreshToken: auth.refresh_token };
  }
  return { success: false, status: res.status };
};

export const forgotPasswordAPI = async (email: string) => {
  const res = await apiFetch("auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
  return { success: res.ok, status: res.status };
};

// --- HOME & SHOP ENDPOINTS ---

export const getDeals = async (lat: number, lng: number, category?: string, limit = 8, skip = 0): Promise<ProductSectionResponse> => {
  const query = new URLSearchParams({ user_lat: lat.toString(), user_lng: lng.toString(), limit: limit.toString(), skip: skip.toString() });
  if (category) query.append("category", category);
  const res = await apiFetch(`products/deals?${query.toString()}`);
  return res.json();
};

export const getTrendingProducts = async (lat: number, lng: number, category?: string, limit = 8, skip = 0): Promise<ProductSectionResponse> => {
  const query = new URLSearchParams({ user_lat: lat.toString(), user_lng: lng.toString(), limit: limit.toString(), skip: skip.toString() });
  if (category) query.append("category", category);
  const res = await apiFetch(`products/trending?${query.toString()}`);
  return res.json();
};

export const getBestPriceProducts = async (lat: number, lng: number, category?: string, limit = 8, skip = 0): Promise<ProductSectionResponse> => {
  const query = new URLSearchParams({ user_lat: lat.toString(), user_lng: lng.toString(), limit: limit.toString(), skip: skip.toString() });
  if (category) query.append("category", category);
  const res = await apiFetch(`products/best-price?${query.toString()}`);
  return res.json();
};

export const getExtendedDeals = async (lat: number, lng: number, category?: string, limit = 8, skip = 0): Promise<ProductSectionResponse> => {
  const query = new URLSearchParams({ user_lat: lat.toString(), user_lng: lng.toString(), limit: limit.toString(), skip: skip.toString() });
  if (category) query.append("category", category);
  const res = await apiFetch(`products/deals-extended?${query.toString()}`);
  return res.json();
};

export const getNearbyShops = async (lat: number, lng: number, category?: string): Promise<ShopSearchResponse> => {
  const query = new URLSearchParams({ lat: lat.toString(), lng: lng.toString() });
  if (category) query.append("category", category);
  const res = await apiFetch(`get-nearby-shops?${query.toString()}`);
  return res.json();
};

export const getShopDetails = async (shopId: string): Promise<ShopDetailsResponse> => {
  const res = await apiFetch(`get-shop?id=${shopId}`);
  return res.json();
};

export const getUserDetails = async (userId: string): Promise<UserDetails> => {
  const res = await apiFetch(`get-user?user_id=${userId}`);
  return res.json();
};

export const recordShopView = async (shopId: string): Promise<void> => {
  await apiFetch(`record-shop-view/${shopId}`, { method: "POST" });
};

export const recordProductView = async (productId: string, shopId: string): Promise<void> => {
  await apiFetch(`record-view/${productId}?shop_id=${shopId}`, { method: "POST" });
};

export const addToCartAPI = async (productId: string, userId: string): Promise<{ success: boolean; product: Product }> => {
  const res = await apiFetch("cart/add-item", {
    method: "POST",
    body: JSON.stringify({ product_id: productId, user_id: userId })
  });
  return res.json();
};

export const askAvailability = async (productId: string, userId: string): Promise<void> => {
  await apiFetch("ask-availability", {
    method: "POST",
    body: JSON.stringify({ product_id: productId, user_id: userId })
  });
};

export const getLiveFindsFeed = async (lat: number, lng: number, limit = 20, offset = 0) => {
  const res = await apiFetch(`live-finds/feed?lat=${lat}&lng=${lng}&limit=${limit}&offset=${offset}`);
  return res.json();
};

export const toggleLiveFindLike = async (postId: string) => {
  const res = await apiFetch(`live-finds/${postId}/like`, { method: "POST" });
  return res.json();
};

export const recordLiveFindView = async (postId: string) => {
  await apiFetch(`live-finds/${postId}/view`, { method: "POST" });
};

// --- OWNER ENDPOINTS (This was missing!) ---

export const getDashboardMetrics = async (ownerId: string) => {
  const res = await apiFetch(`owner/dashboard-metrics?owner_id=${ownerId}`);
  if (res.ok) return res.json();
  return null;
};

export const getShopPerformance = async (ownerId: string) => {
  const res = await apiFetch(`owner/shop-performance?owner_id=${ownerId}`);
  if (res.ok) return res.json();
  return null;
};

export const getStoreDescription = async () => {
  const res = await apiFetch("owner/store-description");
  if (res.ok) return res.json();
  return null;
};

export const getOwnerNotificationsList = async () => {
  const res = await apiFetch("notifications/list");
  if (res.ok) return res.json();
  return { notifications: [], unreadCount: 0 };
};

export const getUnreadNotificationCount = async () => {
  const res = await apiFetch("notifications/unread-count");
  if (res.ok) return res.json();
  return { unreadCount: 0 };
};