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