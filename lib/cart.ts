import { CartItem, Product } from "./types";

export const MAX_QUANTITY = 10;

const getCartKey = (userId: string) => `av_cart_${userId}`;
const getPickupsKey = (userId: string) => `av_pickups_${userId}`;

// --- CART FUNCTIONS ---
export const getCart = (userId: string): CartItem[] => {
  if (typeof window === "undefined") return [];
  const json = localStorage.getItem(getCartKey(userId));
  if (!json) return [];
  try { return JSON.parse(json) as CartItem[]; } catch { return []; }
};

export const saveCart = (userId: string, cart: CartItem[]) => {
  if (typeof window !== "undefined") localStorage.setItem(getCartKey(userId), JSON.stringify(cart));
};

export const addItem = (
  userId: string, product: Product, shopId: string, shopName?: string, 
  shopLat?: number, shopLng?: number, shopPickups?: number, shopReports?: number
) => {
  const cart = getCart(userId);
  const existing = cart.find(item => item.product_id === product.id);
  
  if (existing) {
    if (existing.quantity < MAX_QUANTITY) existing.quantity++;
  } else {
    cart.push({
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      unit: product.unit,
      shop_id: shopId,
      quantity: 1,
      image_url: product.imageUrl,
      shop_name: shopName,
      shop_lat: shopLat,
      shop_lng: shopLng,
      shop_pickups: shopPickups,
      shop_reports: shopReports
    });
  }
  saveCart(userId, cart);
};

export const increaseQuantity = (userId: string, productId: string) => {
  const cart = getCart(userId).map(item => {
    if (item.product_id === productId) item.quantity = Math.min(item.quantity + 1, MAX_QUANTITY);
    return item;
  });
  saveCart(userId, cart);
};

export const decreaseQuantity = (userId: string, productId: string) => {
  const cart = getCart(userId).map(item => {
    if (item.product_id === productId) item.quantity = Math.max(item.quantity - 1, 1);
    return item;
  });
  saveCart(userId, cart);
};

export const removeItem = (userId: string, productId: string) => {
  const cart = getCart(userId).filter(item => item.product_id !== productId);
  saveCart(userId, cart);
};

export const clearCart = (userId: string) => {
  if (typeof window !== "undefined") localStorage.removeItem(getCartKey(userId));
};

// --- ACTIVE PICKUPS FUNCTIONS ---
export const getPickups = (userId: string): CartItem[] => {
  if (typeof window === "undefined") return [];
  const json = localStorage.getItem(getPickupsKey(userId));
  if (!json) return [];
  try { return JSON.parse(json) as CartItem[]; } catch { return []; }
};

export const savePickups = (userId: string, pickups: CartItem[]) => {
  if (typeof window !== "undefined") localStorage.setItem(getPickupsKey(userId), JSON.stringify(pickups));
};

export const addPickups = (userId: string, items: CartItem[]) => {
  const current = getPickups(userId);
  savePickups(userId, [...current, ...items]);
};

export const removePickupShop = (userId: string, shopId: string) => {
  const current = getPickups(userId).filter(item => item.shop_id !== shopId);
  savePickups(userId, current);
};