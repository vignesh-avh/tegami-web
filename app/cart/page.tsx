"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUserIdFromToken, checkoutCart, markGeofencedPickup, getActivePickups } from "../../lib/api";
import { CartItem } from "../../lib/types";
import { getCart, getPickups, increaseQuantity, decreaseQuantity, removeItem, clearCart, addPickups, savePickups } from "../../lib/cart";
import { calculateDistance } from "../../lib/utils";
import BottomNav from "../../components/BottomNav";

// ============================================================
// EXACT colors from ui/theme/Color.kt
// ============================================================
const C = {
  primary: "#6200EE",              // AVPrimary
  secondary: "#03DAC5",            // AVSecondary
  accent: "#018786",               // AVAccent
  bgLight: "#F5F5F5",              // AVBackgroundLight
  surface: "#FFFFFF",              // AVSurfaceLight
  textPrimary: "#121212",          // AVTextPrimaryLight
  textSecondary: "#757575",        // AVTextSecondaryLight
  textOnSurfaceVariant: "#49454F", // Material3 default onSurfaceVariant (not overridden)
  error: "#B00020",                // AVError
  border: "#E0E0E0",               // AVBorderLight
  border50: "#E0E0E080",           // AVBorderLight at 50%
  border30: "#E0E0E04D",           // AVBorderLight at 30%
  gray: "#888888",                 // Compose Color.Gray
  black: "#000000",                // Compose Color.Black
  primary20: "rgba(98,0,238,0.2)", // AVPrimary at 20%
  secondary20: "rgba(3,218,197,0.2)", // AVSecondary at 20%
  secondary10: "rgba(3,218,197,0.1)", // AVSecondary at 10%
};

export default function CartScreen() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [activePickups, setActivePickups] = useState<CartItem[]>([]);
  const [backendActivePickups, setBackendActivePickups] = useState<any[]>([]);

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showSummaryDetails, setShowSummaryDetails] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showInsufficientCoins, setShowInsufficientCoins] = useState(false);
  const [showNavConsentDialog, setShowNavConsentDialog] = useState(false);

  const [earnedCoins, setEarnedCoins] = useState(0);
  const [refundIncluded, setRefundIncluded] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number, lng: number } | null>(null);

  const [routeEstimateReady, setRouteEstimateReady] = useState(false);
  const [coinsToSpend, setCoinsToSpend] = useState(0);
  const [alreadyPaidCoins, setAlreadyPaidCoins] = useState(0);
  const [reserveAmount, setReserveAmount] = useState(10);

  const [pickupEnableStates, setPickupEnableStates] = useState<Record<string, boolean>>({});
  const [newlyAddedShopIds, setNewlyAddedShopIds] = useState<Set<string>>(new Set());
  const shopArrivalTimes = useRef<Record<string, number>>({});

  const userId = getUserIdFromToken();

  // 1. Initial Load
  useEffect(() => {
    if (!userId) {
      router.push("/login");
      return;
    }

    setCartItems(getCart(userId));
    setActivePickups(getPickups(userId));
    setIsInitialLoad(false);

    const savedStates = localStorage.getItem(`av_geofence_${userId}`);
    if (savedStates) setPickupEnableStates(JSON.parse(savedStates));
  }, [userId, router]);

  // 2. Fetch Backend Pickups (Bulletproof Sync)
  const fetchBackend = async () => {
    if (!userId) return;
    const res = await getActivePickups(userId);

    if (res && res.active_pickups) {
      setBackendActivePickups(res.active_pickups);

      const localPickups = getPickups(userId);

      // CRITICAL FIX: do NOT wipe local pickups when backend is empty but local has items
      if (res.active_pickups.length === 0 && localPickups.length > 0) {
        return;
      }

      const activeShopIds = res.active_pickups.flatMap((o: any) => o.shop_locations?.map((s: any) => s.shop_id) || []);

      const staleShops = localPickups.filter(p => !activeShopIds.includes(p.shop_id)).map(p => p.shop_id);

      if (staleShops.length > 0 && res.active_pickups.length > 0) {
        let currentPickups = localPickups;
        staleShops.forEach(id => { currentPickups = currentPickups.filter(p => p.shop_id !== id); });
        savePickups(userId, currentPickups);
        setActivePickups(currentPickups);
      }
    }
  };

  useEffect(() => {
    if (userId) fetchBackend();
  }, [userId]);

  // 3. Geolocation + Geofencing + Route Calculation
  const calculateRouteCost = (lat: number, lng: number) => {
    const allItems = [...cartItems, ...activePickups];
    const allShopIds = Array.from(new Set(allItems.map(i => i.shop_id)));
    if (allShopIds.length === 0) {
      setCoinsToSpend(0); setReserveAmount(10); setRouteEstimateReady(true); return;
    }

    let shopLocations: { lat: number, lng: number }[] = [];
    allShopIds.forEach(shopId => {
      const item = allItems.find(i => i.shop_id === shopId);
      if (item && item.shop_lat && item.shop_lng) {
        shopLocations.push({ lat: item.shop_lat, lng: item.shop_lng });
      }
    });

    if (shopLocations.length === 0) {
      setCoinsToSpend(0); setReserveAmount(10); setRouteEstimateReady(true); return;
    }

    // Nearest Neighbor continuous distance calculation
    let currentLat = lat;
    let currentLng = lng;
    let totalDistanceMeters = 0;
    let unvisited = [...shopLocations];

    while (unvisited.length > 0) {
      let closestIdx = -1;
      let minDist = Infinity;
      for (let i = 0; i < unvisited.length; i++) {
        const dKm = calculateDistance(currentLat, currentLng, unvisited[i].lat, unvisited[i].lng);
        if (dKm * 1000 < minDist) { minDist = dKm * 1000; closestIdx = i; }
      }
      if (closestIdx !== -1) {
        totalDistanceMeters += minDist;
        currentLat = unvisited[closestIdx].lat;
        currentLng = unvisited[closestIdx].lng;
        unvisited.splice(closestIdx, 1);
      }
    }

    const totalKm = totalDistanceMeters / 1000;
    const roundedKm = Math.ceil(totalKm);
    const totalCost = Math.max(10, roundedKm * 10);

    const paid = backendActivePickups.reduce((sum, order) => sum + (order.reserved_coins || 0), 0);
    setAlreadyPaidCoins(paid);

    const extraToPay = Math.max(0, totalCost - paid);
    setCoinsToSpend(totalCost);
    setReserveAmount(cartItems.length === 0 ? 0 : extraToPay);
    setRouteEstimateReady(true);
  };

  useEffect(() => {
    if (!userId || (cartItems.length === 0 && activePickups.length === 0)) return;

    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLoc({ lat, lng });

          calculateRouteCost(lat, lng);

          // Geofencing (20m for 5s)
          const now = Date.now();
          const uniqueShops = Array.from(new Set(activePickups.map(p => p.shop_id)));
          let stateChanged = false;
          const newStates = { ...pickupEnableStates };
          let newArrivalTimes = { ...shopArrivalTimes.current };

          uniqueShops.forEach(shopId => {
            const shopItems = activePickups.filter(p => p.shop_id === shopId);
            const shopLat = shopItems[0].shop_lat;
            const shopLng = shopItems[0].shop_lng;

            if (shopLat && shopLng && !newStates[shopId]) {
              const distKm = calculateDistance(lat, lng, shopLat, shopLng);
              const distMeters = distKm * 1000;

              if (distMeters <= 20) {
                if (!newArrivalTimes[shopId]) {
                  newArrivalTimes[shopId] = now;
                } else {
                  if (now - newArrivalTimes[shopId] >= 5000) {
                    newStates[shopId] = true;
                    stateChanged = true;
                    delete newArrivalTimes[shopId];
                  }
                }
              } else {
                if (newArrivalTimes[shopId]) delete newArrivalTimes[shopId];
              }
            }
          });

          shopArrivalTimes.current = newArrivalTimes;
          if (stateChanged) {
            setPickupEnableStates(newStates);
            localStorage.setItem(`av_geofence_${userId}`, JSON.stringify(newStates));
          }
        },
        (err) => console.log("Location error", err),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [userId, activePickups, pickupEnableStates, cartItems, backendActivePickups]);

  const handleIncrease = (id: string) => {
    if (!userId) return;
    increaseQuantity(userId, id);
    setCartItems(getCart(userId));
  };

  const handleDecrease = (id: string) => {
    if (!userId) return;
    decreaseQuantity(userId, id);
    setCartItems(getCart(userId));
  };

  const handleRemove = (id: string) => {
    if (!userId) return;
    removeItem(userId, id);
    setCartItems(getCart(userId));
  };

  const handleCheckout = async () => {
    if (!userId || cartItems.length === 0) return;
    setIsCheckingOut(true);

    const isSubsequentCheckout = activePickups.length > 0;
    if (isSubsequentCheckout) {
      setNewlyAddedShopIds(new Set(cartItems.map(c => c.shop_id)));
    } else {
      setNewlyAddedShopIds(new Set());
    }

    const payload = cartItems.map(item => ({ ...item, user_id: userId }));
    const res = await checkoutCart(payload, userLoc?.lat, userLoc?.lng, reserveAmount);

    if (res.status === 402) {
      setIsCheckingOut(false);
      setShowInsufficientCoins(true);
      return;
    }

    if (res.success) {
      addPickups(userId, cartItems);
      clearCart(userId);

      setActivePickups(getPickups(userId));
      setCartItems([]);

      setTimeout(() => {
        fetchBackend();
      }, 5000);
    } else {
      alert(`Checkout Failed: ${res.error || "Unknown error"}`);
    }
    setIsCheckingOut(false);
  };

  const handleMarkPickedUp = async (shopId: string) => {
    if (!userId || !pickupEnableStates[shopId]) return;

    const itemsFromShop = activePickups.filter(p => p.shop_id === shopId);
    const totalItems = itemsFromShop.reduce((sum, item) => sum + item.quantity, 0);

    const order = backendActivePickups.find(o => o.shop_locations?.some((s: any) => s.shop_id === shopId));
    const orderId = order ? order._id : undefined;

    const res = await markGeofencedPickup({
      user_id: userId,
      shop_id: shopId,
      items_count: totalItems,
      order_id: orderId
    });

    if (res.success) {
      const updatedPickups = activePickups.filter(p => p.shop_id !== shopId);
      setActivePickups(updatedPickups);
      savePickups(userId, updatedPickups);

      const newStates = { ...pickupEnableStates };
      delete newStates[shopId];
      setPickupEnableStates(newStates);
      localStorage.setItem(`av_geofence_${userId}`, JSON.stringify(newStates));

      const standardProductCoins = totalItems * 3;
      const earned = res.data?.coins_earned || standardProductCoins;

      setEarnedCoins(earned);
      setRefundIncluded(earned > standardProductCoins);
      setShowSuccess(true);
      fetchBackend();
    } else {
      alert("Failed to mark pickup. Please try again.");
    }
  };

  const totalItemsCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const itemsTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const earnableCoins = totalItemsCount * 3;

  if (isInitialLoad) {
    return (
      <div
        className="min-h-screen bg-[#F5F5F5]"
        style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}
      />
    );
  }

  const groupedPickups = activePickups.reduce((acc, item) => {
    if (!acc[item.shop_id]) acc[item.shop_id] = [];
    acc[item.shop_id].push(item);
    return acc;
  }, {} as Record<string, CartItem[]>);

  const groupedCart = cartItems.reduce((acc, item) => {
    if (!acc[item.shop_id]) acc[item.shop_id] = [];
    acc[item.shop_id].push(item);
    return acc;
  }, {} as Record<string, CartItem[]>);

  const showBottomBar = cartItems.length > 0 && !showSuccess;

  // Padding so the fixed bottom bar never cuts content
  const bottomPad = !showBottomBar
    ? "pb-20"
    : showSummaryDetails
    ? "pb-[420px]"
    : "pb-[240px]";

  return (
    <div
      className={`min-h-screen w-full overflow-x-hidden bg-[#F5F5F5] ${bottomPad}`}
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}
    >
      {/* ============ HEADER ============ */}
      <div className="sticky top-0 z-50 bg-[#F5F5F5]">
        <div className="max-w-md mx-auto px-4 pt-0.5 pb-0.5">
          <h1 className="text-[22px] font-bold text-[#121212] leading-[28px] tracking-normal">
            Shopping Cart
          </h1>
          <p className="text-[12px] text-[#49454F] leading-[16px] pb-1">
            {totalItemsCount > 0
              ? `${totalItemsCount} ${totalItemsCount === 1 ? "item" : "items"} in your cart`
              : "Review your selected items"}
          </p>
        </div>
      </div>

      {cartItems.length === 0 && activePickups.length === 0 ? (
        /* ============ EMPTY STATE ============ */
        <div className="max-w-md mx-auto flex flex-col items-center justify-center h-[60vh] px-8 text-center">
          <svg
            className="w-20 h-20 mb-4"
            style={{ color: C.primary20 }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h2 className="text-[28px] font-bold text-[#121212] leading-[36px]">Your Cart is Empty</h2>
          <p className="text-sm text-[#757575] pt-2 pb-6">Looks like you haven't added anything yet.</p>
          <Link
            href="/shops"
            className="bg-[#6200EE] text-white px-6 h-11 rounded-xl font-semibold flex items-center justify-center text-[15px]"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="max-w-md mx-auto px-4 pt-1">
          {/* ============ ACTIVE PICKUPS SECTION (one card, all shops) ============ */}
          {Object.keys(groupedPickups).length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold text-[#757575] tracking-[0.8px] uppercase pt-2 pb-1">
                To Pick Up Today
              </h3>

              <div className="bg-white rounded-2xl border border-[#E0E0E0] my-1.5 overflow-hidden">
                {Object.entries(groupedPickups).map(([shopId, items], index, arr) => {
                  const isEligible = pickupEnableStates[shopId] === true;
                  const isNew = newlyAddedShopIds.has(shopId);
                  return (
                    <div key={shopId}>
                      {/* Shop header */}
                      <div className="flex justify-between items-center px-3 py-2.5">
                        <span className="text-[16px] font-bold text-black leading-[22px] truncate flex-1 min-w-0">
                          {items[0].shop_name || "Shop Items"}
                        </span>
                        {isNew && (
                          <span
                            className="ml-2 text-white text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse shrink-0"
                            style={{ backgroundColor: C.accent, borderRadius: "4px" }}
                          >
                            NEW
                          </span>
                        )}
                      </div>

                      <div className="h-px bg-[#E0E0E080]" />

                      {/* Items */}
                      {items.map(item => (
                        <div key={item.product_id} className="flex items-center justify-between px-4 py-2">
                          <div className="flex items-center flex-1 min-w-0 pr-2">
                            <div className="w-12 h-12 rounded-lg bg-[#F5F5F5] overflow-hidden shrink-0 flex items-center justify-center mr-3">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.product_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <svg
                                  className="w-6 h-6"
                                  style={{ color: "rgba(98,0,238,0.5)" }}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              )}
                            </div>
                            <p className="text-[14px] font-medium text-[#121212] leading-[20px] line-clamp-2">
                              {item.quantity}x {item.product_name}
                            </p>
                          </div>
                          <span className="text-[14px] text-[#757575] leading-[20px] whitespace-nowrap shrink-0">
                            ₹{Math.trunc(item.price * item.quantity)}
                          </span>
                        </div>
                      ))}

                      <div className="h-px bg-[#E0E0E080]" />

                      {/* Mark as Picked Up */}
                      <div className="px-3 py-1">
                        <button
                          onClick={() => handleMarkPickedUp(shopId)}
                          disabled={!isEligible}
                          className="w-full py-2 flex items-center justify-center gap-2 rounded-md"
                          style={{ color: isEligible ? C.primary : C.gray }}
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-[14px] font-bold leading-[20px]">
                            {isEligible ? "Mark as Picked Up" : "Reach shop to unlock"}
                          </span>
                        </button>
                      </div>

                      {/* 4px separator between pickup shops */}
                      {index < arr.length - 1 && <div className="h-1 bg-[#F5F5F5]" />}
                    </div>
                  );
                })}

                {/* Navigate button */}
                <div className="h-px bg-[#E0E0E0]" />
                <div className="p-4">
                  <button
                    onClick={() => setShowNavConsentDialog(true)}
                    className="w-full h-12 bg-[#6200EE] text-white rounded-xl font-bold text-[16px] flex items-center justify-center gap-2"
                  >
                    <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    Navigate to All Shops
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============ REGULAR CART ITEMS (separate card per shop) ============ */}
          {Object.keys(groupedCart).length > 0 && (
            <div className={Object.keys(groupedPickups).length > 0 ? "mt-3" : ""}>
              <h3 className="text-[11px] font-bold text-[#757575] tracking-[0.8px] uppercase pt-2 pb-1">
                Your Cart
              </h3>

              <div>
                {Object.entries(groupedCart).map(([shopId, items]) => {
                  const isUnverified = (items[0].shop_pickups || 0) < 3 || (items[0].shop_reports || 0) > 5;
                  return (
                    <div
                      key={shopId}
                      className="bg-white rounded-2xl border my-1.5 overflow-hidden"
                      style={{
                        borderColor: isUnverified ? "rgba(176,0,32,0.3)" : C.border,
                      }}
                    >
                      {/* Shop header */}
                      <div className="flex justify-between items-center px-3 py-2.5">
                        <span className="text-[16px] font-bold text-black leading-[22px] truncate flex-1 min-w-0">
                          {items[0].shop_name || "Shop"}
                        </span>
                        {isUnverified && (
                          <svg
                            className="w-4 h-4 shrink-0 ml-2"
                            style={{ color: C.error }}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>

                      <div className="h-px bg-[#E0E0E080]" />

                      {/* Items */}
                      {items.map((item, idx) => (
                        <div key={item.product_id}>
                          <div className="flex items-center px-4 py-2">
                            <div className="w-16 h-16 rounded-lg bg-[#F5F5F5] overflow-hidden shrink-0 flex items-center justify-center">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.product_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <svg
                                  className="w-7 h-7"
                                  style={{ color: "rgba(98,0,238,0.5)" }}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              )}
                            </div>

                            <div className="ml-3 flex-1 min-w-0 flex flex-col gap-0.5">
                              <p className="text-[16px] font-semibold text-[#121212] leading-[22px] truncate">
                                {item.product_name}
                              </p>
                              <p className="text-[13px] text-[#757575] leading-[18px]">
                                {item.quantity > 1
                                  ? `₹${Math.trunc(item.price)} × ${item.quantity} = ₹${Math.trunc(item.price * item.quantity)}`
                                  : `₹${Math.trunc(item.price)}`}
                              </p>
                              {isUnverified && (
                                <div className="flex items-center">
                                  <svg
                                    className="w-[13px] h-[13px] mr-1 shrink-0"
                                    style={{ color: C.error }}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-[11px] leading-[15px]" style={{ color: C.error }}>
                                    New shop, not verified yet
                                  </span>
                                </div>
                              )}

                              <div className="h-1" />

                              <div className="flex justify-between items-center">
                                <div className="flex items-center">
                                  <button
                                    onClick={() => handleDecrease(item.product_id)}
                                    className="w-8 h-8 rounded-full bg-[#6200EE] text-white flex items-center justify-center text-[16px] font-bold leading-none"
                                    aria-label="Decrease quantity"
                                  >
                                    −
                                  </button>
                                  <span className="text-[15px] font-bold text-[#121212] min-w-[28px] text-center px-1.5">
                                    {item.quantity}
                                  </span>
                                  <button
                                    onClick={() => handleIncrease(item.product_id)}
                                    className="w-8 h-8 rounded-full bg-[#6200EE] text-white flex items-center justify-center text-[16px] font-bold leading-none"
                                    aria-label="Increase quantity"
                                  >
                                    +
                                  </button>
                                </div>

                                <button
                                  onClick={() => handleRemove(item.product_id)}
                                  className="w-9 h-9 flex items-center justify-center"
                                  style={{ color: C.gray }}
                                  aria-label="Remove item"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                          {idx < items.length - 1 && <div className="h-px mx-4 bg-[#E0E0E04D]" />}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ FIXED BOTTOM SUMMARY BAR ============ */}
      {showBottomBar && (
        <div
          className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#F5F5F5] px-4 py-3 z-40"
          style={{ boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.08)" }}
        >
          {/* SUMMARY CARD */}
          <div className="bg-white rounded-2xl border border-[#E0E0E0] mb-3">
            <button
              onClick={() => setShowSummaryDetails(!showSummaryDetails)}
              className="w-full p-3.5 flex items-center text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[#757575] leading-[16px]">Coins to pay now</p>
                <p className="text-[18px] font-extrabold text-[#6200EE] leading-[24px] truncate">
                  {routeEstimateReady ? `${reserveAmount} Coins` : "Calculating…"}
                </p>
              </div>
              <div className="text-right ml-2 shrink-0">
                <p className="text-[12px] text-[#757575] leading-[16px]">Items total</p>
                <p className="text-[16px] font-semibold text-[#121212] leading-[22px]">
                  ₹{Math.trunc(itemsTotal)}
                </p>
              </div>
              <svg
                className={`w-6 h-6 ml-2 shrink-0 transition-transform ${
                  showSummaryDetails ? "rotate-180" : ""
                }`}
                style={{ color: C.textSecondary }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
              </svg>
            </button>

            {showSummaryDetails && (
              <div className="px-3.5 pb-3.5">
                <div className="h-px bg-[#E0E0E0] my-2.5" />

                <SummaryRow
                  label="Items total"
                  value={`₹${Math.trunc(itemsTotal)}`}
                  labelColor={C.textSecondary}
                  valueColor={C.textPrimary}
                  valueWeight="font-medium"
                />
                <div className="h-1.5" />
                <SummaryRow
                  label="Coins you'll earn"
                  value={`+${earnableCoins} coins`}
                  labelColor={C.textSecondary}
                  valueColor={C.accent}
                  valueWeight="font-bold"
                />
                <div className="h-1.5" />
                <SummaryRow
                  label="Route fee (10 coins per km)"
                  value={`${coinsToSpend} Coins`}
                  labelColor={C.textSecondary}
                  valueColor={C.textPrimary}
                  valueWeight="font-medium"
                />

                {alreadyPaidCoins > 0 && (
                  <>
                    <div className="h-1.5" />
                    <SummaryRow
                      label="Already paid (active pickups)"
                      value={`-${alreadyPaidCoins} Coins`}
                      labelColor={C.textSecondary}
                      valueColor={C.error}
                      valueWeight="font-medium"
                    />
                  </>
                )}

                <div className="h-px bg-[#E0E0E0] my-2.5" />
                <SummaryRow
                  label="Coins to pay now"
                  value={routeEstimateReady ? `${reserveAmount} Coins` : "Calculating…"}
                  labelColor={C.textPrimary}
                  valueColor={C.primary}
                  valueWeight="font-bold"
                  boldLabel
                  size="lg"
                />
              </div>
            )}
          </div>

          {/* CHECKOUT BUTTON */}
          <button
            onClick={handleCheckout}
            disabled={isCheckingOut}
            className="w-full h-[50px] bg-[#6200EE] text-white rounded-2xl font-bold text-[16px] flex items-center justify-center disabled:opacity-75"
          >
            {isCheckingOut ? (
              <span
                className="w-[22px] h-[22px] rounded-full animate-spin"
                style={{ border: "2.5px solid white", borderTopColor: "transparent" }}
              />
            ) : (
              "Proceed to Reserve"
            )}
          </button>
        </div>
      )}

      {/* ============ SUCCESS DIALOG ============ */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col items-center text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: C.secondary20 }}
            >
              <svg className="w-10 h-10" style={{ color: C.accent }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-[22px] font-bold text-[#6200EE] mb-2">Pickup Confirmed! 🎉</h2>
            <p className="text-[15px] font-medium text-[#121212] mb-4 leading-[22px]">
              You successfully arrived at the shop and picked up your items.
            </p>
            <div
              className="rounded-xl p-3 w-full mb-6"
              style={{ backgroundColor: C.secondary10 }}
            >
              <p className="text-[28px] leading-[36px]">🪙</p>
              <p className="text-[14px] font-bold leading-[20px] mt-1" style={{ color: C.accent }}>
                {refundIncluded
                  ? "Product Coins Earned & Route Coins Refunded!"
                  : "Product Coins Earned!"}
              </p>
              <p className="text-[16px] font-extrabold text-[#6200EE] leading-[22px] mt-1">
                +{earnedCoins} Total Coins Added
              </p>
            </div>
            <button
              onClick={() => setShowSuccess(false)}
              className="w-full h-12 bg-[#6200EE] text-white rounded-xl font-bold text-[16px]"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* ============ INSUFFICIENT COINS DIALOG ============ */}
      {showInsufficientCoins && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-2xl font-bold mb-2" style={{ color: C.error }}>
              Insufficient Coins
            </h2>
            <p className="text-sm text-[#121212] leading-[20px] mb-6">
              You need {reserveAmount} Coins for this reservation based on the route distance. Would you like to buy more coins?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowInsufficientCoins(false)}
                className="px-4 py-2 text-[15px] font-semibold"
                style={{ color: C.textSecondary }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowInsufficientCoins(false);
                  alert("Go to buy coins placeholder");
                }}
                className="bg-[#6200EE] text-white px-4 py-2 rounded-lg font-semibold text-[15px]"
              >
                Buy Coins
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ NAVIGATION CONSENT DIALOG ============ */}
      {showNavConsentDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-[20px] font-bold text-black mb-3 leading-[26px]">Share your location?</h2>
            <p className="text-sm text-[#121212] leading-[20px] mb-2">
              When you navigate to shops, your live location will be shared with store owners to help them know you're on your way.
            </p>
            <p className="text-sm text-[#757575] leading-[20px] mb-2">
              A small fee of 10 coins per km is deducted from your account to cover the route. Your location sharing will stop automatically when you reach the shops or cancel navigation.
            </p>
            <p className="text-sm font-semibold text-[#121212] leading-[20px] mb-6">
              Do you agree to share your location and pay the route fee?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowNavConsentDialog(false)}
                className="px-4 py-2 font-bold text-[15px]"
                style={{ color: C.error }}
              >
                Deny
              </button>
              <button
                onClick={() => {
                  setShowNavConsentDialog(false);
                  alert("Map Navigation Placeholder (Skipped)");
                }}
                className="bg-[#6200EE] text-white px-5 py-2 rounded-lg font-bold text-[15px]"
              >
                Agree
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

/* ---------- Summary row helper (matches CartSummaryRow) ---------- */
function SummaryRow({
  label,
  value,
  labelColor,
  valueColor,
  valueWeight,
  boldLabel = false,
  size = "sm",
}: {
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
  valueWeight: string;
  boldLabel?: boolean;
  size?: "sm" | "lg";
}) {
  const fontSize = size === "lg" ? "text-[15px]" : "text-[13px]";
  const lineHeight = size === "lg" ? "leading-[20px]" : "leading-[18px]";
  return (
    <div className="flex items-start justify-between gap-2">
      <span
        className={`${fontSize} ${lineHeight} flex-1 min-w-0 line-clamp-2 ${boldLabel ? "font-bold" : ""}`}
        style={{ color: labelColor }}
      >
        {label}
      </span>
      <span
        className={`${fontSize} ${lineHeight} ${valueWeight} whitespace-nowrap shrink-0`}
        style={{ color: valueColor }}
      >
        {value}
      </span>
    </div>
  );
}