"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as maplibregl from "maplibre-gl";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getUserIdFromToken, checkoutCart, markGeofencedPickup, getActivePickups, getMultiShopRoute, recordConsent, getShopDetails, getNavigationRoute, cancelNavigation, getAllShopLocations } from "../../lib/api";
import { MultiShopRouteResponse, CartItem } from "../../lib/types";
import { getCart, getPickups, increaseQuantity, decreaseQuantity, removeItem, clearCart, addPickups, savePickups, saveCart } from "../../lib/cart";
import { calculateDistance, decodePolyline, GpsKalmanFilter } from "../../lib/utils";
import BottomNav from "../../components/BottomNav";

if (typeof window !== "undefined") {
  setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).toString());
}

const C = {
  primary: "#6200EE",
  secondary: "#03DAC5",
  accent: "#018786",
  bgLight: "#F5F5F5",
  surface: "#FFFFFF",
  textPrimary: "#121212",
  textSecondary: "#757575",
  textOnSurfaceVariant: "#49454F",
  error: "#B00020",
  border: "#E0E0E0",
  border50: "#E0E0E080",
  border30: "#E0E0E04D",
  gray: "#888888",
  black: "#000000",
  primary20: "rgba(98,0,238,0.2)",
  secondary20: "rgba(3,218,197,0.2)",
  secondary10: "rgba(3,218,197,0.1)",
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
  const [multiShopRoute, setMultiShopRoute] = useState<MultiShopRouteResponse | null>(null);
  const shopArrivalTimes = useRef<Record<string, number>>({});

  const [showMap, setShowMap] = useState(false);
  const [mapData, setMapData] = useState("");
  const [isPipMode, setIsPipMode] = useState(false);

  const userId = getUserIdFromToken();

  useEffect(() => {
    if (!userId) {
      router.push("/login");
      return;
    }

    const currentCart = getCart(userId);
    const currentPickups = getPickups(userId);
    setCartItems(currentCart);
    setActivePickups(currentPickups);
    setIsInitialLoad(false);
    fetchShopDetailsForCart(currentCart, currentPickups);

    const savedStates = localStorage.getItem(`av_geofence_${userId}`);
    if (savedStates) setPickupEnableStates(JSON.parse(savedStates));
  }, [userId, router]);
 
  const fetchShopDetailsForCart = async (currentCart: CartItem[], currentPickups: CartItem[]) => {
    const allShopIds = Array.from(new Set([...currentCart, ...currentPickups].map(i => i.shop_id)));
    
    const missingShopIds = allShopIds.filter(shopId => {
      const item = currentCart.find(i => i.shop_id === shopId) || currentPickups.find(i => i.shop_id === shopId);
      return item && (item.shop_lat === undefined || item.shop_lng === undefined);
    });

    if (missingShopIds.length === 0) return;

    let cartModified = false;
    let pickupsModified = false;
    const updatedCart = [...currentCart];
    const updatedPickups = [...currentPickups];

    await Promise.all(missingShopIds.map(async (shopId) => {
      try {
        const res = await getShopDetails(shopId);
        if (res && res.shop) {
          const shopData = res.shop;
          for (let i = 0; i < updatedCart.length; i++) {
            if (updatedCart[i].shop_id === shopId) {
              updatedCart[i] = { ...updatedCart[i], shop_name: shopData.name, shop_lat: shopData.latitude, shop_lng: shopData.longitude, shop_pickups: shopData.pickups, shop_reports: shopData.reports };
              cartModified = true;
            }
          }
          for (let i = 0; i < updatedPickups.length; i++) {
            if (updatedPickups[i].shop_id === shopId) {
              updatedPickups[i] = { ...updatedPickups[i], shop_name: shopData.name, shop_lat: shopData.latitude, shop_lng: shopData.longitude, shop_pickups: shopData.pickups, shop_reports: shopData.reports };
              pickupsModified = true;
            }
          }
        }
      } catch (e) {}
    }));

    if (cartModified) { setCartItems(updatedCart); saveCart(userId!, updatedCart); }
    if (pickupsModified) { setActivePickups(updatedPickups); savePickups(userId!, updatedPickups); }
  };

  const fetchBackend = async () => {
    if (!userId) return;
    const res = await getActivePickups(userId);

    if (res && res.active_pickups) {
      setBackendActivePickups(res.active_pickups);
      const localPickups = getPickups(userId);

      if (res.active_pickups.length === 0 && localPickups.length > 0) return;

      const activeShopIds = res.active_pickups.flatMap((o: any) => o.shop_locations?.map((s: any) => s.shop_id) || []).filter(Boolean);
      
      if (userLoc && activeShopIds.length > 0) {
        fetchMultiShopRoute(userLoc.lat, userLoc.lng, activeShopIds);
      }

      if (res.active_pickups.length > 0 && activeShopIds.length > 0) {
        const staleShops = localPickups.filter(p => !activeShopIds.includes(p.shop_id)).map(p => p.shop_id);

        if (staleShops.length > 0) {
          let currentPickups = localPickups;
          staleShops.forEach(id => { currentPickups = currentPickups.filter(p => p.shop_id !== id); });
          savePickups(userId, currentPickups);
          setActivePickups(currentPickups);
        }
      }
    }
  };

  const fetchMultiShopRoute = async (lat: number, lng: number, shopIds: string[]) => {
    if (shopIds.length === 0) return;
    const uniqueShopIds = Array.from(new Set(shopIds));
    const routeRes = await getMultiShopRoute({ user_lat: lat, user_lng: lng, shop_ids: uniqueShopIds });
    if (routeRes) setMultiShopRoute(routeRes);
  };

  useEffect(() => {
    if (userId) fetchBackend();
  }, [userId]);

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

  const proceedToNavigation = () => {
    let allStopsData = "";
    const optimizedHops = multiShopRoute?.optimizedHops;
    const activeShopIds = new Set(activePickups.map(p => p.shop_id));

    const validOptimizedHops = optimizedHops?.filter(h => activeShopIds.has(h.shopId)) || [];

    if (validOptimizedHops.length === activeShopIds.size && activeShopIds.size > 0) {
      allStopsData = validOptimizedHops.map(hop => {
        const safeId = hop.shopId.replace(/,/g, "").replace(/\|/g, "").replace(/~/g, "");
        const safeName = (hop.shopName || "").replace(/,/g, " ").replace(/\|/g, " ").replace(/~/g, " ");
        const safePolyline = encodeURIComponent(hop.routePolyline || "");
        const duration = hop.durationMins || 0;
        const distance = hop.distanceMeters || 0;
        const walkable = hop.isWalkable || false;
        return `${hop.shopLat},${hop.shopLng},${safeName},${safeId},${safePolyline},${duration},${distance},${walkable}`;
      }).join("|");
    } else {
      const grouped = activePickups.reduce((acc, p) => {
        if (!acc[p.shop_id]) acc[p.shop_id] = [];
        acc[p.shop_id].push(p);
        return acc;
      }, {} as Record<string, CartItem[]>);

      allStopsData = Object.entries(grouped).map(([shopId, grp]) => {
        const sLat = grp.find(i => i.shop_lat !== undefined)?.shop_lat;
        const sLng = grp.find(i => i.shop_lng !== undefined)?.shop_lng;
        const sName = (grp[0].shop_name || "Shop").replace(/,/g, " ").replace(/\|/g, " ").replace(/~/g, " ");
        const safeShopId = shopId.replace(/,/g, "").replace(/\|/g, "").replace(/~/g, "");

        if (sLat !== undefined && sLng !== undefined) {
          return `${sLat},${sLng},${sName},${safeShopId},,0,0,false`;
        }
        return null;
      }).filter(Boolean).join("|");
    }

    setNewlyAddedShopIds(new Set());
    setMapData(encodeURIComponent(allStopsData));
    setShowMap(true);
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

      const newPickups = getPickups(userId);
      setActivePickups(newPickups);
      setCartItems([]);
      fetchShopDetailsForCart([], newPickups);

      const allActiveShopIds = getPickups(userId).map(p => p.shop_id);
      const uniqueShopIds = Array.from(new Set(allActiveShopIds));
      if (userLoc && uniqueShopIds.length > 0) {
        fetchMultiShopRoute(userLoc.lat, userLoc.lng, uniqueShopIds);
      }

      setTimeout(() => {
        fetchBackend();
      }, 4000); 
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

  // Responsive padding logic to ensure the bottom bar doesn't cover content on mobile
  const bottomPad = !showBottomBar
    ? "pb-20 lg:pb-8"
    : showSummaryDetails
    ? "pb-[420px] lg:pb-8"
    : "pb-[240px] lg:pb-8";

  return (
    <div
      className={`min-h-screen w-full overflow-x-hidden bg-[#F5F5F5] ${bottomPad}`}
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}
    >
      <div className="sticky top-0 z-50 bg-[#F5F5F5] border-b border-gray-200 lg:border-none">
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-2">
          <h1 className="text-[22px] lg:text-[28px] font-bold text-[#121212] leading-[28px] tracking-normal">
            Shopping Cart
          </h1>
          <p className="text-[12px] lg:text-[14px] text-[#49454F] leading-[16px] pb-1">
            {totalItemsCount > 0
              ? `${totalItemsCount} ${totalItemsCount === 1 ? "item" : "items"} in your cart`
              : "Review your selected items"}
          </p>
        </div>
      </div>

      {cartItems.length === 0 && activePickups.length === 0 ? (
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-8 text-center pt-10">
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
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-2 lg:pt-6 flex flex-col lg:flex-row lg:gap-10">
          
          {/* MAIN CONTENT COLUMN (Left side on desktop) */}
          <div className="flex-1 min-w-0">
            {Object.keys(groupedPickups).length > 0 && (
              <div>
                <h3 className="text-[11px] lg:text-[13px] font-bold text-[#757575] tracking-[0.8px] uppercase pt-2 pb-2">
                  To Pick Up Today
                </h3>

                <div className="bg-white rounded-2xl border border-[#E0E0E0] my-1.5 overflow-hidden shadow-sm lg:shadow-md">
                  {Object.entries(groupedPickups).map(([shopId, items], index, arr) => {
                    const isEligible = pickupEnableStates[shopId] === true;
                    const isNew = newlyAddedShopIds.has(shopId);
                    return (
                      <div key={shopId}>
                        <div className="flex justify-between items-center px-4 lg:px-6 py-3 lg:py-4">
                          <span className="text-[16px] lg:text-[18px] font-bold text-black leading-[22px] truncate flex-1 min-w-0">
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

                        {items.map((item, idx) => (
                          <div key={`${item.product_id}-${idx}`} className="flex items-center justify-between px-4 lg:px-6 py-3">
                            <div className="flex items-center flex-1 min-w-0 pr-2">
                              <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-lg bg-[#F5F5F5] overflow-hidden shrink-0 flex items-center justify-center mr-3 lg:mr-4">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.product_name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <svg
                                    className="w-6 h-6 lg:w-8 lg:h-8"
                                    style={{ color: "rgba(98,0,238,0.5)" }}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                )}
                              </div>
                              <p className="text-[14px] lg:text-[16px] font-medium text-[#121212] leading-[20px] line-clamp-2">
                                {item.quantity}x {item.product_name}
                              </p>
                            </div>
                            <span className="text-[14px] lg:text-[16px] text-[#757575] leading-[20px] whitespace-nowrap shrink-0">
                              ₹{Math.trunc(item.price * item.quantity)}
                            </span>
                          </div>
                        ))}

                        <div className="h-px bg-[#E0E0E080]" />

                        <div className="px-3 lg:px-5 py-2">
                          <button
                            onClick={() => handleMarkPickedUp(shopId)}
                            disabled={!isEligible}
                            className="w-full py-2 lg:py-3 flex items-center justify-center gap-2 rounded-md transition-colors hover:bg-gray-50"
                            style={{ color: isEligible ? C.primary : C.gray }}
                          >
                            <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-[14px] lg:text-[16px] font-bold leading-[20px]">
                              {isEligible ? "Mark as Picked Up" : "Reach shop to unlock"}
                            </span>
                          </button>
                        </div>

                        {index < arr.length - 1 && <div className="h-1 bg-[#F5F5F5]" />}
                      </div>
                    );
                  })}

                  <div className="h-px bg-[#E0E0E0]" />
                  <div className="p-4 lg:p-6">
                    <button
                      onClick={() => {
                        const consentGiven = localStorage.getItem("nav_consent_given") === "true";
                        if (consentGiven) {
                          proceedToNavigation();
                        } else {
                          setShowNavConsentDialog(true);
                        }
                      }}
                      className="w-full h-12 lg:h-14 bg-[#6200EE] text-white rounded-xl font-bold text-[16px] flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
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

            {Object.keys(groupedCart).length > 0 && (
              <div className={Object.keys(groupedPickups).length > 0 ? "mt-4 lg:mt-8" : ""}>
                <h3 className="text-[11px] lg:text-[13px] font-bold text-[#757575] tracking-[0.8px] uppercase pt-2 pb-2">
                  Your Cart
                </h3>

                <div>
                  {Object.entries(groupedCart).map(([shopId, items]) => {
                    const isUnverified = (items[0].shop_pickups || 0) < 3 || (items[0].shop_reports || 0) > 5;
                    return (
                      <div
                        key={shopId}
                        className="bg-white rounded-2xl border my-1.5 overflow-hidden shadow-sm lg:shadow-md"
                        style={{
                          borderColor: isUnverified ? "rgba(176,0,32,0.3)" : C.border,
                        }}
                      >
                        <div className="flex justify-between items-center px-4 lg:px-6 py-3 lg:py-4">
                          <span className="text-[16px] lg:text-[18px] font-bold text-black leading-[22px] truncate flex-1 min-w-0">
                            {items[0].shop_name || "Shop"}
                          </span>
                          {isUnverified && (
                            <svg
                              className="w-4 h-4 lg:w-5 lg:h-5 shrink-0 ml-2"
                              style={{ color: C.error }}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>

                        <div className="h-px bg-[#E0E0E080]" />

                        {items.map((item, idx) => (
                          <div key={`${item.product_id}-${idx}`}>
                            <div className="flex items-center px-4 lg:px-6 py-3 lg:py-4">
                              <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-lg bg-[#F5F5F5] overflow-hidden shrink-0 flex items-center justify-center">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.product_name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <svg
                                    className="w-7 h-7 lg:w-10 lg:h-10"
                                    style={{ color: "rgba(98,0,238,0.5)" }}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                )}
                              </div>

                              <div className="ml-3 lg:ml-5 flex-1 min-w-0 flex flex-col gap-1">
                                <p className="text-[16px] lg:text-[18px] font-semibold text-[#121212] leading-[22px] truncate">
                                  {item.product_name}
                                </p>
                                <p className="text-[13px] lg:text-[15px] text-[#757575] leading-[18px]">
                                  {item.quantity > 1
                                    ? `₹${Math.trunc(item.price)} × ${item.quantity} = ₹${Math.trunc(item.price * item.quantity)}`
                                    : `₹${Math.trunc(item.price)}`}
                                </p>
                                {isUnverified && (
                                  <div className="flex items-center">
                                    <svg
                                      className="w-[13px] h-[13px] lg:w-4 lg:h-4 mr-1 shrink-0"
                                      style={{ color: C.error }}
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-[11px] lg:text-[13px] leading-[15px]" style={{ color: C.error }}>
                                      New shop, not verified yet
                                    </span>
                                  </div>
                                )}

                                <div className="h-2" />

                                <div className="flex justify-between items-center">
                                  <div className="flex items-center">
                                    <button
                                      onClick={() => handleDecrease(item.product_id)}
                                      className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-[#6200EE] text-white flex items-center justify-center text-[16px] lg:text-[18px] font-bold leading-none transition-transform active:scale-95"
                                      aria-label="Decrease quantity"
                                    >
                                      −
                                    </button>
                                    <span className="text-[15px] lg:text-[17px] font-bold text-[#121212] min-w-[28px] lg:min-w-[32px] text-center px-1.5">
                                      {item.quantity}
                                    </span>
                                    <button
                                      onClick={() => handleIncrease(item.product_id)}
                                      className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-[#6200EE] text-white flex items-center justify-center text-[16px] lg:text-[18px] font-bold leading-none transition-transform active:scale-95"
                                      aria-label="Increase quantity"
                                    >
                                      +
                                    </button>
                                  </div>

                                  <button
                                    onClick={() => handleRemove(item.product_id)}
                                    className="w-9 h-9 lg:w-10 lg:h-10 flex items-center justify-center hover:bg-red-50 rounded-full transition-colors"
                                    style={{ color: C.gray }}
                                    aria-label="Remove item"
                                  >
                                    <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                            {idx < items.length - 1 && <div className="h-px mx-4 lg:mx-6 bg-[#E0E0E04D]" />}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* DESKTOP CHECKOUT SIDEBAR (Right side) */}
          {showBottomBar && (
            <div className="hidden lg:block w-[400px] shrink-0">
              <div className="sticky top-24">
                <div className="bg-white rounded-2xl border border-[#E0E0E0] mb-4 shadow-sm">
                  <button
                    onClick={() => setShowSummaryDetails(!showSummaryDetails)}
                    className="w-full p-5 flex items-center text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-[#757575] leading-[18px]">Coins to pay now</p>
                      <p className="text-[22px] font-extrabold text-[#6200EE] leading-[28px] truncate">
                        {routeEstimateReady ? `${reserveAmount} Coins` : "Calculating…"}
                      </p>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <p className="text-[14px] text-[#757575] leading-[18px]">Items total</p>
                      <p className="text-[18px] font-semibold text-[#121212] leading-[24px]">
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
                    <div className="px-5 pb-5">
                      <div className="h-px bg-[#E0E0E0] my-3" />
                      <SummaryRow
                        label="Items total"
                        value={`₹${Math.trunc(itemsTotal)}`}
                        labelColor={C.textSecondary}
                        valueColor={C.textPrimary}
                        valueWeight="font-medium"
                      />
                      <div className="h-2" />
                      <SummaryRow
                        label="Coins you'll earn"
                        value={`+${earnableCoins} coins`}
                        labelColor={C.textSecondary}
                        valueColor={C.accent}
                        valueWeight="font-bold"
                      />
                      <div className="h-2" />
                      <SummaryRow
                        label="Route fee (10 coins per km)"
                        value={`${coinsToSpend} Coins`}
                        labelColor={C.textSecondary}
                        valueColor={C.textPrimary}
                        valueWeight="font-medium"
                      />

                      {alreadyPaidCoins > 0 && (
                        <>
                          <div className="h-2" />
                          <SummaryRow
                            label="Already paid (active pickups)"
                            value={`-${alreadyPaidCoins} Coins`}
                            labelColor={C.textSecondary}
                            valueColor={C.error}
                            valueWeight="font-medium"
                          />
                        </>
                      )}

                      <div className="h-px bg-[#E0E0E0] my-3" />
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

                <button
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="w-full h-[56px] bg-[#6200EE] text-white rounded-2xl font-bold text-[18px] flex items-center justify-center disabled:opacity-75 transition-transform active:scale-[0.98]"
                >
                  {isCheckingOut ? (
                    <span
                      className="w-[24px] h-[24px] rounded-full animate-spin"
                      style={{ border: "3px solid white", borderTopColor: "transparent" }}
                    />
                  ) : (
                    "Proceed to Reserve"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MOBILE BOTTOM BAR (Hidden on Desktop) */}
      {showBottomBar && (
        <div
          className="lg:hidden fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#F5F5F5] px-4 py-3 z-40"
          style={{ boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.08)" }}
        >
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

      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col items-center text-center animate-in fade-in zoom-in duration-200">
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
              className="w-full h-12 bg-[#6200EE] text-white rounded-xl font-bold text-[16px] transition-transform active:scale-95"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {showInsufficientCoins && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold mb-2" style={{ color: C.error }}>
              Insufficient Coins
            </h2>
            <p className="text-sm text-[#121212] leading-[20px] mb-6">
              You need {reserveAmount} Coins for this reservation based on the route distance. Would you like to buy more coins?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowInsufficientCoins(false)}
                className="px-4 py-2 text-[15px] font-semibold hover:bg-gray-100 rounded-lg transition-colors"
                style={{ color: C.textSecondary }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowInsufficientCoins(false);
                  alert("Go to buy coins placeholder");
                }}
                className="bg-[#6200EE] text-white px-4 py-2 rounded-lg font-semibold text-[15px] transition-transform active:scale-95"
              >
                Buy Coins
              </button>
            </div>
          </div>
        </div>
      )}

      {showNavConsentDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
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
                className="px-4 py-2 font-bold text-[15px] hover:bg-red-50 rounded-lg transition-colors"
                style={{ color: C.error }}
              >
                Deny
              </button>
              <button
                onClick={() => {
                  setShowNavConsentDialog(false);
                  localStorage.setItem("nav_consent_given", "true");
                  if (userId) {
                    recordConsent(userId, "navigation", true);
                  }
                  proceedToNavigation();
                }}
                className="bg-[#6200EE] text-white px-5 py-2 rounded-lg font-bold text-[15px] transition-transform active:scale-95"
              >
                Agree
              </button>
            </div>
          </div>
        </div>
      )}

      {showMap && (
        <MapWidget 
          encodedData={mapData} 
          isPipMode={isPipMode} 
          setIsPipMode={setIsPipMode} 
          onClose={() => setShowMap(false)} 
        />
      )}

      <BottomNav />
    </div>
  );
}

function SummaryRow({ label, value, labelColor, valueColor, valueWeight, boldLabel = false, size = "sm" }: { label: string; value: string; labelColor: string; valueColor: string; valueWeight: string; boldLabel?: boolean; size?: "sm" | "lg"; }) {
  const fontSize = size === "lg" ? "text-[15px] lg:text-[17px]" : "text-[13px] lg:text-[15px]";
  const lineHeight = size === "lg" ? "leading-[20px] lg:leading-[24px]" : "leading-[18px] lg:leading-[20px]";
  return (
    <div className="flex items-start justify-between gap-2">
      <span className={`${fontSize} ${lineHeight} flex-1 min-w-0 line-clamp-2 ${boldLabel ? "font-bold" : ""}`} style={{ color: labelColor }}>
        {label}
      </span>
      <span className={`${fontSize} ${lineHeight} ${valueWeight} whitespace-nowrap shrink-0`} style={{ color: valueColor }}>
        {value}
      </span>
    </div>
  );
}

interface NavStop {
  lat: number; lng: number; name: string; shopId: string;
  routePolyline?: string; durationMins?: number; isWalkable?: boolean;
}

function MapWidget({ encodedData, isPipMode, setIsPipMode, onClose }: { encodedData: string, isPipMode: boolean, setIsPipMode: (v: boolean) => void, onClose: () => void }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hasCentered = useRef(false);
  const isDrawingRef = useRef(false);
  const kalmanFilterRef = useRef<GpsKalmanFilter | null>(null);
  if (!kalmanFilterRef.current) kalmanFilterRef.current = new GpsKalmanFilter();

  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(true);
  const [userLoc, setUserLoc] = useState<{ lat: number, lng: number } | null>(null);
  const [heading, setHeading] = useState(0);
  const [routeSegments, setRouteSegments] = useState<{ label: string, time: string }[]>([]);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [showFinalCancelPrompt, setShowFinalCancelPrompt] = useState(false);
  const userId = getUserIdFromToken();

  const stops: NavStop[] = useMemo(() => {
    if (!encodedData) return [];
    const parsed: NavStop[] = [];
    try {
      const decoded = decodeURIComponent(encodedData);
      decoded.split("|").forEach(p => {
        const seg = p.split(",");
        if (seg.length >= 8) {
          parsed.push({
            lat: parseFloat(seg[0]), lng: parseFloat(seg[1]), name: seg[2], shopId: seg[3],
            routePolyline: decodeURIComponent(seg[4]) || undefined,
            durationMins: parseInt(seg[5]) || 0, isWalkable: seg[7] === "true"
          });
        }
      });
    } catch (e) {}
    return parsed;
  }, [encodedData]);

  useEffect(() => {
    const timer = setTimeout(() => { if (mapRef.current) mapRef.current.resize(); }, 300);
    return () => clearTimeout(timer);
  }, [isPipMode]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY;

    const initMap = async () => {
      try {
        const styleUrl = `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${apiKey}`;
        const res = await fetch(styleUrl);
        const styleJson = await res.json();
        styleJson.layers = styleJson.layers.filter((l: any) => l.id !== "3d_model_data" && l["source-layer"] !== "3d_model");

        mapRef.current = new maplibregl.Map({
          container: mapContainerRef.current!,
          style: styleJson,
          center: [78.4867, 17.3850],
          zoom: 15,
          pitch: 0,
          validateStyle: false,
          transformRequest: (url) => {
            if (url.includes("api.olamaps.io") && !url.includes("api_key=")) {
              return { url: `${url}${url.includes("?") ? "&" : "?"}api_key=${apiKey}` };
            }
            return { url };
          },
        });

        mapRef.current.on('error', (e) => {
          console.warn("MapLibre warning (ignoring):", e.error?.message || e);
        });

        mapRef.current.on('load', async () => {
          const map = mapRef.current;
          if (!map) return;

          try {
            const makePinSvg = (color: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50"><path d="M20 0C8.95 0 0 8.95 0 20c0 15 20 30 20 30s20-15 20-30C40 8.95 31.05 0 20 0z" fill="${color}"/><text x="20" y="26" font-size="14" font-family="Arial, sans-serif" font-weight="bold" fill="white" text-anchor="middle">Te</text></svg>`;
            const arrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#ffffff" /><circle cx="20" cy="20" r="15" fill="#1A73E8" /><path d="M20 8 L28 28 L20 24 L12 28 Z" fill="#ffffff"/></svg>`;

            if (!map.hasImage('pin-blue')) {
              const img = new Image(40, 50); img.src = 'data:image/svg+xml;base64,' + btoa(makePinSvg("#1A73E8")); await new Promise(r => img.onload = r); map.addImage('pin-blue', img);
            }
            if (!map.hasImage('pin-red')) {
              const img = new Image(40, 50); img.src = 'data:image/svg+xml;base64,' + btoa(makePinSvg("#E53935")); await new Promise(r => img.onload = r); map.addImage('pin-red', img);
            }
            if (!map.hasImage('user-arrow')) {
              const img = new Image(40, 40); img.src = 'data:image/svg+xml;base64,' + btoa(arrowSvg); await new Promise(r => img.onload = r); map.addImage('user-arrow', img);
            }
          } catch (e) {
            console.warn("Map image loading error", e);
          }

          setLoading(false);
        });
      } catch (e) { setLoading(false); }
    };
    initMap();
    return () => mapRef.current?.remove();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let watchId: number;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy, speed, heading: gpsHeading } = pos.coords;
          if (accuracy > 150) return;
          if (gpsHeading !== null) setHeading(gpsHeading);

          const now = Date.now();
          const smoothed = kalmanFilterRef.current!.filter(latitude, longitude, accuracy, now, speed || 0);
          setLocating(false);
          setUserLoc(smoothed);

          if (mapRef.current) {
            const source = mapRef.current.getSource('user-location') as maplibregl.GeoJSONSource;
            if (source) {
              source.setData({ type: 'Feature', geometry: { type: 'Point', coordinates: [smoothed.lng, smoothed.lat] }, properties: { heading } });
            }
            if (!hasCentered.current) {
              hasCentered.current = true;
              mapRef.current.flyTo({ center: [smoothed.lng, smoothed.lat], zoom: 16, duration: 1500 });
            } else if (isPipMode) {
              mapRef.current.easeTo({ center: [smoothed.lng, smoothed.lat], duration: 1000 });
            }
          }

          stops.forEach((shop) => {
            if (calculateDistance(smoothed.lat, smoothed.lng, shop.lat, shop.lng) * 1000 <= 20) {
              if (shop.shopId) markGeofencedPickup({ user_id: userId, shop_id: shop.shopId, items_count: 1 });
            }
          });
        },
        console.error,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    }
    return () => navigator.geolocation.clearWatch(watchId);
  }, [userId, isPipMode, stops]);

  useEffect(() => {
    if (!mapRef.current || !stops.length) return;

    const drawMap = async () => {
      if (isDrawingRef.current) return;
      isDrawingRef.current = true;

      try {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) {
          isDrawingRef.current = false;
          return setTimeout(drawMap, 500);
        }

        const allShopsRes = await getAllShopLocations();
        const allShops = allShopsRes?.shops || [];
        const routeShopIds = new Set(stops.map(s => s.shopId));

        const bluePins = allShops.filter((s: any) => !routeShopIds.has(s._id || s.id)).map((s: any) => ({
          type: 'Feature', geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] }, properties: {}
        }));
        const redPins = stops.map((s) => ({
          type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: {}
        }));

        const segments: any[] = [];
        const newRouteSegments: { label: string, time: string }[] = [];

        for (let i = 0; i < stops.length; i++) {
          const shop = stops[i];
          let polyline = shop.routePolyline;
          const startLat = i === 0 ? (userLoc?.lat || stops[0].lat) : stops[i - 1].lat;
          const startLng = i === 0 ? (userLoc?.lng || stops[0].lng) : stops[i - 1].lng;

          if (!polyline) {
            const res = await getNavigationRoute({ user_lat: startLat, user_lng: startLng, shop_id: shop.shopId });
            if (res && res.route_polyline) polyline = res.route_polyline;
          }

          if (polyline) {
            const path = decodePolyline(polyline);
            segments.push({ path, color: "#1A73E8" });
            newRouteSegments.push({ label: `Stop ${i + 1}: ${shop.name}`, time: `${shop.durationMins || 1} min drive` });
          }
        }

        ['route-line', 'shops-blue', 'shops-red', 'user-pin'].forEach(l => { if (map.getLayer(l)) map.removeLayer(l); });
        ['routes', 'all-shops', 'route-shops', 'user-location'].forEach(s => { if (map.getSource(s)) map.removeSource(s); });

        if (segments.length > 0) {
          map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: segments.map(s => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: s.path.map((p: any) => [p.lng, p.lat]) }, properties: { color: s.color, width: 6 } })) as any } });
          map.addLayer({ id: 'route-line', type: 'line', source: 'routes', paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'] } });
        }

        map.addSource('all-shops', { type: 'geojson', data: { type: 'FeatureCollection', features: bluePins } });
        map.addLayer({ id: 'shops-blue', type: 'symbol', source: 'all-shops', layout: { 'icon-image': 'pin-blue', 'icon-size': 0.8, 'icon-anchor': 'bottom' } });

        map.addSource('route-shops', { type: 'geojson', data: { type: 'FeatureCollection', features: redPins } });
        map.addLayer({ id: 'shops-red', type: 'symbol', source: 'route-shops', layout: { 'icon-image': 'pin-red', 'icon-size': 0.9, 'icon-anchor': 'bottom' } });

        const pinLng = userLoc?.lng || stops[0].lng; const pinLat = userLoc?.lat || stops[0].lat;
        map.addSource('user-location', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: [pinLng, pinLat] }, properties: {} } });
        map.addLayer({ id: 'user-pin', type: 'symbol', source: 'user-location', layout: { 'icon-image': 'user-arrow', 'icon-size': 1, 'icon-rotate': ['coalesce', ['get', 'heading'], 0], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true } });

        setRouteSegments(newRouteSegments);
      } catch (e) {
        console.error("Map Draw Error (caught safely):", e);
      } finally {
        isDrawingRef.current = false;
      }
    };
    drawMap();
  }, [stops, userLoc]);

  return (
    <div className={`bg-white flex flex-col transition-all duration-300 ${isPipMode ? 'fixed bottom-20 right-4 w-[140px] h-[200px] rounded-2xl shadow-2xl border-2 border-gray-200 overflow-hidden z-[999]' : 'fixed inset-0 z-[1000]'}`}>
      
      {!isPipMode && (
        <div className="bg-avPrimary text-white p-4 flex items-center shadow-md z-10">
          <button onClick={() => setShowClosePrompt(true)} className="p-2 -ml-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div className="ml-2">
            <p className="text-xs text-white/80">Multi-Stop Navigation</p>
            <h1 className="text-lg font-bold leading-tight">Routing to {stops.length} Shops</h1>
          </div>
        </div>
      )}

      <div className="relative flex-1 w-full h-full">
        <div ref={mapContainerRef} className="w-full h-full" />
        
        {isPipMode && (
          <div className="absolute top-1 w-full flex justify-between px-1 z-50">
            <button 
              onClick={() => setIsPipMode(false)}
              className="w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
            </button>
            <button 
              onClick={() => setShowClosePrompt(true)}
              className="w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        )}

        {locating && !isPipMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-md flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-avPrimary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-bold text-black">Acquiring precise location...</span>
          </div>
        )}
      </div>

      {!isPipMode && !loading && (
        <div className="bg-white p-4 pb-6 rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.1)] z-10">
          <h3 className="text-sm font-bold text-black mb-3">Optimized Route Schedule</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
            {routeSegments.map((seg, i) => (
              <div key={i} className="flex justify-between items-center text-xs">
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-avPrimary mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M13 7H7v6h6V7z" /><path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" /></svg>
                  <span className="font-medium text-black truncate max-w-[200px]">{seg.label}</span>
                </div>
                <span className="bg-[#03DAC5]/20 text-[#018786] px-2 py-0.5 rounded font-bold">{seg.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showClosePrompt && (
        <div className="fixed inset-0 bg-black/50 z-[1001] flex items-end justify-center" onClick={() => setShowClosePrompt(false)}>
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 text-center animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-black mb-6">Are you still heading to the shop(s)?</h2>
            <button onClick={() => { setShowClosePrompt(false); setIsPipMode(true); }} className="w-full py-3.5 bg-[#10B981] text-white rounded-xl font-bold mb-3">✅ Yes, still going</button>
            <button onClick={() => { setShowClosePrompt(false); setShowFinalCancelPrompt(true); }} className="w-full py-3.5 border border-red-500 text-red-500 rounded-xl font-bold">❌ Cancel Navigation</button>
          </div>
        </div>
      )}

      {showFinalCancelPrompt && (
        <div className="fixed inset-0 bg-black/50 z-[1001] flex items-end justify-center" onClick={() => setShowFinalCancelPrompt(false)}>
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 text-center animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-black mb-2">Cancel Navigation?</h2>
            <p className="text-sm text-gray-500 mb-6">Your items will be safely kept in your cart so you can pick them up later.</p>
            <button onClick={() => { setShowFinalCancelPrompt(false); setIsPipMode(true); }} className="w-full py-3.5 bg-avPrimary text-white rounded-xl font-bold mb-3">Keep Navigation</button>
            <button onClick={() => { cancelNavigation(userId || ""); onClose(); }} className="w-full py-3.5 text-red-500 font-bold">Yes, Cancel Navigation</button>
          </div>
        </div>
      )}
    </div>
  );
}