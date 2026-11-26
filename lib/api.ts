import { 
  HomeProduct, ProductSectionResponse, ShopSearchResponse, ShopDetailsResponse, 
  UserDetails, AuthResponse, LoginRequest, SignupRequest, OwnerNotification, Product, CartItem, CheckoutResponse,
  MultiShopRouteRequest, MultiShopRouteResponse, GoogleAuthRequest,UploadAndPredictResponse, BulkAddRequest
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

export const googleAuth = async (data: { token: string, role?: string }) => {
  // FIX: Matches the FastAPI GoogleAuthRequest model in auth.py
  const payload = {
    access_token: data.token,
    role: data.role || "customer"
  };
  
  const res = await apiFetch("auth/google-auth", { method: "POST", body: JSON.stringify(payload) });
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

export const searchShops = async (productName: string, lat: number, lng: number, inStock: boolean = true): Promise<ShopSearchResponse> => {
  const query = new URLSearchParams({ 
    product_name: productName, 
    user_lat: lat.toString(), 
    user_lng: lng.toString(),
    in_stock: inStock.toString()
  });
  const res = await apiFetch(`get-shops?${query.toString()}`);
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

export const askAvailability = async (productId: string, userId: string): Promise<boolean> => {
  const res = await apiFetch("ask-availability", {
    method: "POST",
    body: JSON.stringify({ product_id: productId, user_id: userId })
  });
  return res.ok; // Returns true if status is 200-299, false otherwise
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

export const getMyFinds = async () => {
  const res = await apiFetch("live-finds/my-finds");
  return res.ok ? res.json() : { posts: [] };
};

export const getCoinHistory = async (userId: string, timeRange: string = "last30") => {
  const res = await apiFetch(`user/coin-history?user_id=${userId}&timeRange=${timeRange}`);
  return res.ok ? res.json() : { transactions: [] };
};

export const createLiveFind = async (
  imageFile: File,
  shopId: string,
  price: number | null,
  description: string | null,
  expiresInHours: number,
  userLat: number,
  userLng: number
) => {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("shop_id", shopId);
  if (price !== null) formData.append("price", price.toString());
  if (description) formData.append("description", description);
  formData.append("expires_in_hours", expiresInHours.toString());
  formData.append("user_lat", userLat.toString());
  formData.append("user_lng", userLng.toString());

  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}live-finds/create`, {
    method: "POST",
    headers,
    body: formData,
  });
  return res.ok ? res.json() : null;
};

export const deleteLiveFind = async (postId: string) => {
  const res = await apiFetch(`live-finds/${postId}`, { method: "DELETE" });
  return res.ok;
};

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

export const addShop = async (data: any) => {
  const res = await apiFetch("add-shop", { method: "POST", body: JSON.stringify(data) });
  if (res.ok) {
    const auth = await res.json();
    if (auth.access_token) setToken(auth.access_token);
    return { success: true };
  }
  return { success: false, status: res.status };
};

export const checkoutCart = async (cartData: CartItem[], userLat?: number, userLng?: number, reserveAmount: number = 10) => {
  const query = new URLSearchParams();
  if (userLat) query.append("user_lat", userLat.toString());
  if (userLng) query.append("user_lng", userLng.toString());
  query.append("reserve_amount", reserveAmount.toString());

  const res = await apiFetch(`checkout-cart/?${query.toString()}`, {
    method: "POST",
    body: JSON.stringify(cartData)
  });

  if (res.status === 402) return { success: false, status: 402, data: null, error: "Insufficient coins" };

  if (res.ok) {
    const data: CheckoutResponse = await res.json();
    return { success: true, status: res.status, data, error: null };
  }
  
  let errorDetail = "Could not reserve right now. Please try again.";
  try {
    const errorData = await res.json();
    if (errorData.detail) errorDetail = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
  } catch (e) {}
  
  return { success: false, status: res.status, data: null, error: errorDetail };
};

export const markGeofencedPickup = async (data: { user_id: string; shop_id: string; items_count: number; order_id?: string }) => {
  const res = await apiFetch("customer/mark-pickup", { method: "POST", body: JSON.stringify(data) });
  if (res.ok) {
    const result = await res.json();
    return { success: true, data: result };
  }
  return { success: false, status: res.status };
};

export const getActivePickups = async (userId: string) => {
  const res = await apiFetch(`customer/active-pickups?user_id=${userId}`);
  if (res.ok) return res.json();
  return { active_pickups: [] };
};

// --- MY SHOP ENDPOINTS ---

export const getOwnerProducts = async (ownerId: string): Promise<{ products: any[] }> => {
  const res = await apiFetch(`get-products/?owner_id=${ownerId}`);
  return res.json();
};

export const deleteProduct = async (productId: string) => {
  const res = await apiFetch(`delete-product/${productId}`, { method: "DELETE" });
  return res.ok;
};

export const updateProduct = async (productId: string, data: any) => {
  const res = await apiFetch(`update-product/${productId}`, { method: "PUT", body: JSON.stringify(data) });
  return res.ok;
};

export const updateStock = async (productId: string, inStock: boolean) => {
  const res = await apiFetch(`update-product/${productId}`, { method: "PUT", body: JSON.stringify({ inStock }) });
  return res.ok;
};

export const setPromotion = async (productId: string, data: any) => {
  const res = await apiFetch(`products/${productId}/promotion`, { method: "PUT", body: JSON.stringify(data) });
  return res.ok;
};

export const removePromotion = async (productId: string) => {
  const res = await apiFetch(`products/${productId}/promotion`, { method: "DELETE" });
  return res.ok;
};

export const getStoreDescription = async () => {
  const res = await apiFetch("owner/store-description");
  if (res.ok) return res.json();
  return { phone: "", description: "" };
};

export const saveStoreDescription = async (data: { description: string, phone?: string }) => {
  const res = await apiFetch("owner/store-description", { method: "PUT", body: JSON.stringify(data) });
  return res.ok;
};

// --- MULTI-SHOP ROUTE & CONSENT ENDPOINTS ---

export const getMultiShopRoute = async (request: MultiShopRouteRequest): Promise<MultiShopRouteResponse | null> => {
  const res = await apiFetch("customer/get-multi-shop-route", {
    method: "POST",
    body: JSON.stringify(request)
  });
  if (res.ok) return res.json();
  return null;
};

export const recordConsent = async (userId: string, consentType: string, accepted: boolean) => {
  const res = await apiFetch("record-consent", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, consent_type: consentType, accepted })
  });
  return res.ok;
};

// --- NAVIGATION BROADCAST ENDPOINTS ---
export const broadcastLocation = async (data: {
  customer_id: string;
  customer_name: string;
  shop_ids: string[];
  latitude: number;
  longitude: number;
  eta: string;
  distance: number;
  route_polyline?: string | null;
  accuracy?: number | null;
  heading?: number | null;
}) => {
  const res = await apiFetch("customer/broadcast-location", { method: "POST", body: JSON.stringify(data) });
  return res.ok;
};

export const cancelNavigation = async (userId: string, orderId?: string) => {
  const res = await apiFetch("customer/cancel-navigation", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, order_id: orderId })
  });
  return res.ok;
};

export const getNavigationRoute = async (data: { user_lat: number, user_lng: number, shop_id: string }) => {
  const res = await apiFetch("customer/get-navigation-route", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.ok ? res.json() : null;
};

export const getAllShopLocations = async () => {
  const res = await apiFetch("all-shop-locations");
  return res.ok ? res.json() : null;
};

export const getIncomingCustomers = async (ownerId: string) => {
  const res = await apiFetch(`owner/incoming-customers?owner_id=${ownerId}`);
  return res.ok ? res.json() : { customers: [] };
};

// --- REFERRAL ENDPOINTS ---
export const applyReferral = async (customerId: string, referralCode: string) => {
  const res = await apiFetch("referral/apply-referral", { 
    method: "POST", 
    body: JSON.stringify({ customer_id: customerId, referral_code: referralCode }) 
  });
  return res.ok ? res.json() : null;
};

export const skipReferral = async (userId: string) => {
  const res = await apiFetch("referral/skip-referral", { 
    method: "POST", 
    body: JSON.stringify({ user_id: userId }) 
  });
  return res.ok ? res.json() : null;
};

// --- ADD PRODUCT ENDPOINTS ---

export const uploadAndPredict = async (file: File, isExtra: boolean = false): Promise<UploadAndPredictResponse | null> => {
  const formData = new FormData();
  formData.append("file", file);
  
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}upload-and-predict/?isExtra=${isExtra}`, {
    method: "POST",
    headers,
    body: formData
  });
  
  if (res.ok) return res.json();
  return null;
};

export const addProduct = async (data: {
  product_name: string, 
  price: string, 
  unit: string, 
  owner_id: string, 
  temp_image_id: string, 
  temp_image_ids?: string[], 
  category: string
}) => {
  const formData = new FormData();
  formData.append("product_name", data.product_name);
  formData.append("price", data.price);
  formData.append("unit", data.unit);
  formData.append("owner_id", data.owner_id);
  formData.append("temp_image_id", data.temp_image_id);
  if (data.temp_image_ids && data.temp_image_ids.length > 0) {
    formData.append("temp_image_ids", JSON.stringify(data.temp_image_ids));
  }
  formData.append("category", data.category);

  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}add-product/`, {
    method: "POST",
    headers,
    body: formData
  });
  return res.ok;
};

export const bulkAddProducts = async (request: BulkAddRequest) => {
  const res = await apiFetch("bulk-add-products/", { 
    method: "POST", 
    body: JSON.stringify(request) 
  });
  return res.ok;
};

