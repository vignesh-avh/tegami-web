// --- API Data Models ---

export interface HomeProduct {
  _id: string;
  product_name: string;
  price: number;
  unit: string;
  category?: string;
  imageUrl: string;
  shop_id: string;
  shop_name: string;
  images?: string[];
  shop_pickups?: number;
  shop_reports?: number;
  distance?: number;
  isOnSale?: boolean;
  salePrice?: number;
  saleDescription?: string;
  saleEndDate?: string;
  sold_count?: number;
  marketing_tagline?: string;
  discountPercentage?: number;
}

export interface ProductSectionResponse {
  products: HomeProduct[];
}

export interface DashboardMetrics {
  todayViews: number;
  noStockItems?: number;
  activePromotions: number;
}

export interface UserDetails {
  id?: string;
  role: string;
  coins: number;
  hasEnteredReferral: boolean;
  referral_earnings?: number;
  fullName?: string;
  email?: string;
  city?: string;
  shopName?: string;
  referral_code?: string;
  referral_count?: number;
  livePhotoConsentAccepted?: boolean;
  work_track?: string;
  wallet_balance?: number;
  locationConsentAccepted?: boolean;
  locationConsentTimestamp?: string;
}

export interface PerformanceData {
  date: string;
  sales: number;
  views: number;
}

export interface PerformanceResponse {
  performance: PerformanceData[];
}

export interface LiveFind {
  id: string;
  user_id: string;
  user_name: string;
  shop_id: string;
  shop_name: string;
  shop_location?: { type: string; coordinates: number[] };
  image_url: string;
  price?: number;
  description?: string;
  created_at: string;
  expires_at: string;
  likes_count: number;
  comments: LiveFindComment[];
  distance: number;
  is_own: boolean;
  liked_by?: string[];
  user_level?: number;
  user_level_name?: string;
}

export interface LiveFindComment {
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

export interface LevelInfo {
  level: number;
  level_name: string;
  posts: number;
  views: number;
  likes: number;
  progress: number;
}

export interface LiveFindsFeedResponse {
  posts: LiveFind[];
  level_info?: LevelInfo;
}

export interface LikeResponse {
  success: boolean;
  action: string;
  likes_count: number;
}

export interface CoinTransaction {
  dateTime: string;
  productNames: string[];
  amount: number;
  coins: number;
}

// --- API Data Models ---

export interface HomeProduct {
  _id: string;
  product_name: string;
  price: number;
  unit: string;
  category?: string;
  imageUrl: string;
  shop_id: string;
  shop_name: string;
  images?: string[];
  shop_pickups?: number;
  shop_reports?: number;
  distance?: number;
  isOnSale?: boolean;
  salePrice?: number;
  saleDescription?: string;
  saleEndDate?: string;
  sold_count?: number;
  marketing_tagline?: string;
  discountPercentage?: number;
}

export interface ProductSectionResponse {
  products: HomeProduct[];
}

export interface DashboardMetrics {
  todayViews: number;
  noStockItems?: number;
  activePromotions: number;
}

export interface UserDetails {
  id?: string;
  role: string;
  coins: number;
  hasEnteredReferral: boolean;
  referral_earnings?: number;
  fullName?: string;
  email?: string;
  city?: string;
  shopName?: string;
  referral_code?: string;
  referral_count?: number;
  livePhotoConsentAccepted?: boolean;
  work_track?: string;
  wallet_balance?: number;
  locationConsentAccepted?: boolean;
  locationConsentTimestamp?: string;
}

export interface PerformanceData {
  date: string;
  sales: number;
  views: number;
}

export interface PerformanceResponse {
  performance: PerformanceData[];
}

export interface LiveFind {
  id: string;
  user_id: string;
  user_name: string;
  shop_id: string;
  shop_name: string;
  shop_location?: { type: string; coordinates: number[] };
  image_url: string;
  price?: number;
  description?: string;
  created_at: string;
  expires_at: string;
  likes_count: number;
  comments: LiveFindComment[];
  distance: number;
  is_own: boolean;
  liked_by?: string[];
  user_level?: number;
  user_level_name?: string;
}

export interface LiveFindComment {
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

export interface LevelInfo {
  level: number;
  level_name: string;
  posts: number;
  views: number;
  likes: number;
  progress: number;
}

export interface LiveFindsFeedResponse {
  posts: LiveFind[];
  level_info?: LevelInfo;
}

export interface LikeResponse {
  success: boolean;
  action: string;
  likes_count: number;
}

export interface CoinTransaction {
  dateTime: string;
  productNames: string[];
  amount: number;
  coins: number;
}

export interface CoinHistoryResponse {
  transactions: CoinTransaction[];
}

// --- NEW MODELS ADDED FROM CONCEPT.TXT ---

export interface CartItem {
  product_id: string;
  product_name: string;
  price: number;
  unit: string;
  shop_id: string;
  quantity: number;
  user_id?: string;
  image_url?: string;
  shop_name?: string;
  shop_lat?: number;
  shop_lng?: number;
  shop_pickups?: number;
  shop_reports?: number;
}

export interface CheckoutRequest {
  cartData: CartItem[];
}

export interface CheckoutResponse {
  message: string;
  status: string;
  updated_coins?: number;
  coins_earned?: number;
  potential_coins?: number;
}

export interface MarkPickupRewardRequest {
  user_id: string;
  shop_id: string;
  items_count: number;
  order_id?: string;
}

export interface TriggerVisitChargeRequest {
  user_id: string;
  shop_id: string;
  order_id: string;
}

export interface ActivePickupShopLocation {
  shop_id: string;
  shop_name: string;
  lat: number;
  lng: number;
}

export interface ActivePickupOrder {
  _id: string;
  shop_locations: ActivePickupShopLocation[];
  items: string[];
  potential_coins: number;
  reserved_coins?: number;
  route_polyline?: string;
}

export interface ActivePickupsResponse {
  active_pickups: ActivePickupOrder[];
}

export interface CancelOrderRequest {
  user_id: string;
  order_id?: string;
}

export interface CancelNavigationRequest {
  user_id: string;
  order_id?: string;
}

export interface ProductListResponse {
  products: Product[];
}

export interface Product {
  id: string;
  images?: string[];
  name: string;
  price: number;
  unit: string;
  count: number;
  imageUrl: string;
  category?: string;
  inStock: boolean;
  shopId: string;
  isOnSale?: boolean;
  salePrice?: number;
  saleDescription?: string;
  saleEndDate?: string;
  last_updated?: string;
  last_asked_at?: string;
}

export interface UpdateProductRequest {
  product_name: string;
  price: number;
  unit: string;
  category: string;
}

export interface UpdateStockRequest {
  inStock: boolean;
}

export interface PromotionUpdateRequest {
  salePrice: number;
  saleDescription: string;
  durationDays: number;
}

export interface BulkUpdateSectionRequest {
  owner_id: string;
  section: string;
  action: string;
  value: number;
}

export interface BulkUpdateSectionResponse {
  success: boolean;
  modified_count: number;
  message: string;
  new_timestamp?: string;
}

export interface ShopSectionTimestampsResponse {
  last_pressed_in_stock?: string;
  last_pressed_low_stock?: string;
  last_pressed_no_stock?: string;
}

export interface ShopSearchResponse {
  shops: Shop[];
}

export interface Shop {
  _id: string;
  name: string;
  distance?: number;
  rating?: string;
  products?: string[];
  preview_images?: string[];
  total_views?: number;
  total_sales?: number;
  pickups?: number;
  reports?: number;
}

export interface ShopDetailsResponse {
  shop: ShopDetails;
}

export interface ShopDetails {
  _id?: string;
  name: string;
  latitude: number;
  longitude: number;
  pickups?: number;
  reports?: number;
  mobile_number?: string;
  description?: string;
  products: Product[];
}

export interface OwnerNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  createdAt: string;
  askCount: number;
  answered: boolean;
  answer?: string;
  answeredAt?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
}

export interface SignupRequest {
  fullName: string;
  email: string;
  city: string;
  password: string;
  role: string;
  mobileNumber?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AddShopRequest {
  name: string;
  rating: number;
  latitude: number;
  longitude: number;
  store: string;
  owner_id: string;
  mobile_number: string;
}

export interface StoreDescriptionResponse {
  phone?: string;
  description?: string;
}

export interface StoreDescriptionRequest {
  description: string;
  phone?: string;
}

export interface MultiShopRouteRequest {
  user_lat: number;
  user_lng: number;
  shop_ids: string[];
}

export interface MultiShopRouteHop {
  shopId: string;
  shopName: string;
  shopLat: number;
  shopLng: number;
  routePolyline?: string;
  durationMins?: number;
  distanceMeters?: number;
  isWalkable?: boolean;
}

export interface MultiShopRouteResponse {
  optimizedHops: MultiShopRouteHop[] | null;
  totalDistance?: number;
  totalDuration?: number;
  totalShops?: number;
}