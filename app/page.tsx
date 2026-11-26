"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDeals, getTrendingProducts, getBestPriceProducts, getExtendedDeals, getNearbyShops, getUserRoleFromToken, getUserDetails, recordConsent, getUserIdFromToken, applyReferral, skipReferral } from "../lib/api";
import { getCart, removeItem } from "../lib/cart";
import { HomeProduct, Shop, UserDetails, CartItem } from "../lib/types";
import ProductSection from "../components/ProductSection";
import CategoryScrollRow from "../components/CategoryScrollRow";
import LiveFindsSection from "../components/LiveFindsSection";
import BottomNav from "../components/BottomNav";
import ProfileSidebar from "../components/ProfileSidebar";
import InstallAppBanner from "../components/InstallAppBanner";
const FALLBACK_LOCATION = { lat: 17.3850, lng: 78.4867 };

type LatLng = { lat: number; lng: number };

function getPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  );
}

function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function loadSavedLocation(): { lat: number; lng: number; address?: string } | null {
  try {
    const raw = localStorage.getItem("av_last_location");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveLocation(loc: { lat: number; lng: number; address?: string }) {
  try {
    localStorage.setItem("av_last_location", JSON.stringify(loc));
  } catch (e) {}
}

// Tries two free services so the place name almost always appears
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.state_district;
        const parts = [city, data.address.state, data.address.postcode].filter(Boolean);
        if (parts.length > 0) return parts.join(", ");
      }
    }
  } catch (e) {}

  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    if (res.ok) {
      const d = await res.json();
      const parts = [d.locality || d.city, d.principalSubdivision, d.postcode].filter(Boolean);
      if (parts.length > 0) return parts.join(", ");
    }
  } catch (e) {}

  return null;
}
// Same rotating placeholders as Android SearchSection
const SEARCH_PLACEHOLDERS = ["Search for products near you", "Search bananas", "Search what's nearby"];

export default function CustomerHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [roleChecked, setRoleChecked] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Data states
  const [deals, setDeals] = useState<HomeProduct[]>([]);
  const [trending, setTrending] = useState<HomeProduct[]>([]);
  const [bestPrice, setBestPrice] = useState<HomeProduct[]>([]);
  const [extended, setExtended] = useState<HomeProduct[]>([]);
  const [popularShops, setPopularShops] = useState<Shop[]>([]);

  // Pagination States
  const ITEMS_LIMIT = 8;
  const [dealsSkip, setDealsSkip] = useState(0);
  const [trendingSkip, setTrendingSkip] = useState(0);
  const [bestPriceSkip, setBestPriceSkip] = useState(0);
  const [extendedSkip, setExtendedSkip] = useState(0);

  const [dealsHasMore, setDealsHasMore] = useState(true);
  const [trendingHasMore, setTrendingHasMore] = useState(true);
  const [bestPriceHasMore, setBestPriceHasMore] = useState(true);
  const [extendedHasMore, setExtendedHasMore] = useState(true);

  const [dealsPaginating, setDealsPaginating] = useState(false);
  const [trendingPaginating, setTrendingPaginating] = useState(false);
  const [bestPricePaginating, setBestPricePaginating] = useState(false);
  const [extendedPaginating, setExtendedPaginating] = useState(false);

  // User & Consent states
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [consentDenied, setConsentDenied] = useState(false);
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [currentAddress, setCurrentAddress] = useState("Locating...");
  const [locationFailed, setLocationFailed] = useState(false);
  // Cart Bubble state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [shopCount, setShopCount] = useState(5);

  // Categories
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Referral State
  const [showReferral, setShowReferral] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralLoading, setReferralLoading] = useState(false);

  // Remember that the customer has seen the Home page in this tab
  useEffect(() => {
    try {
      sessionStorage.setItem("av_visited_home", "1");
    } catch (e) {}
  }, []);

  // Search placeholder rotation (Android: every 3 seconds)
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPlaceholderIndex(i => (i + 1) % SEARCH_PLACEHOLDERS.length), 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const userRole = getUserRoleFromToken();
    const uid = getUserIdFromToken();
    setRole(userRole);
    setUserId(uid);

    if (userRole === "owner") {
      router.replace("/owner");
      return;
    }

    const seed = Math.floor(Date.now() / (1000 * 60 * 30));
    setShopCount((seed % 8) + 2);

    if (uid) setCartItems(getCart(uid));

    const initialize = async () => {
      if (uid) {
        const details = await getUserDetails(uid).catch(() => null);
        if (details) {
          setUserDetails(details);
          if (details.hasEnteredReferral === false) {
            setShowReferral(true);
          }
          if (details.locationConsentAccepted === false) {
            setShowConsentDialog(true);
            setRoleChecked(true);
            return;
          }
        }
      }

      setRoleChecked(true);

      // 1. Show the last known location instantly (if we have one)
      const saved = loadSavedLocation();
      let current = (saved ? { lat: saved.lat, lng: saved.lng } : null) as LatLng | null;
      let currentAddr = saved?.address;

      if (saved) {
        setCoords({ lat: saved.lat, lng: saved.lng });
        setCurrentAddress(saved.address || "Near you");
        fetchData(saved.lat, saved.lng);
      }

      // 2. Use a fresh location: reload products only if customer moved 300m+
      const applyLocation = async (lat: number, lng: number) => {
        const moved = !current || distanceMeters(current, { lat, lng }) > 300;
        if (moved) {
          current = { lat, lng };
          currentAddr = undefined;
          setCoords({ lat, lng });
          fetchData(lat, lng);
        }
        if (!currentAddr || currentAddr === "Near you") {
          const address = await reverseGeocode(lat, lng);
          if (address) {
            currentAddr = address;
            setCurrentAddress(address);
          } else if (moved) {
            setCurrentAddress("Near you");
          }
        }
        saveLocation({ lat, lng, address: currentAddr });
      };

      let denied = !navigator.geolocation;

      // Fast location first (wifi / mobile network)
      if (!denied) {
        try {
          const quick = await getPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 });
          await applyLocation(quick.coords.latitude, quick.coords.longitude);
        } catch (err: any) {
          if (err && err.code === 1) denied = true;
        }
      }

      // Then precise GPS location (gets 15 seconds, not 5)
      if (!denied) {
        try {
          const precise = await getPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
          await applyLocation(precise.coords.latitude, precise.coords.longitude);
        } catch (err) {}
      }

      // 3. Nothing worked and nothing saved -> default area, with a Retry button
      if (!current) {
        setCoords(FALLBACK_LOCATION);
        setCurrentAddress("Location unavailable");
        setLocationFailed(true);
        fetchData(FALLBACK_LOCATION.lat, FALLBACK_LOCATION.lng);
      }
    };

    initialize();
  }, [router]);

  const fetchData = async (latitude: number, longitude: number, category?: string, attempt = 0) => {
    setLoading(true);
    
    // Reset pagination on fresh load (e.g., category change or location change)
    setDealsSkip(0);
    setTrendingSkip(0);
    setBestPriceSkip(0);
    setExtendedSkip(0);
    setDealsHasMore(true);
    setTrendingHasMore(true);
    setBestPriceHasMore(true);
    setExtendedHasMore(true);

    let failed = false as boolean;
    let retrying = false as boolean;
    try {
      const [d, t, b, e, s] = await Promise.all([
        getDeals(latitude, longitude, category, ITEMS_LIMIT, 0).catch(() => { failed = true; return { products: [] }; }),
        getTrendingProducts(latitude, longitude, category, ITEMS_LIMIT, 0).catch(() => { failed = true; return { products: [] }; }),
        getBestPriceProducts(latitude, longitude, category, ITEMS_LIMIT, 0).catch(() => { failed = true; return { products: [] }; }),
        getExtendedDeals(latitude, longitude, category, ITEMS_LIMIT, 0).catch(() => { failed = true; return { products: [] }; }),
        getNearbyShops(latitude, longitude, category).catch(() => { failed = true; return null; })
      ]);
      // Helper to remove duplicates from the array based on _id
      const dedupe = (list: any[]) => {
        if (!list) return [];
        return Array.from(new Map(list.map(item => [item._id, item])).values());
      };

      setDeals(dedupe(d.products));
      setTrending(dedupe(t.products));
      setBestPrice(dedupe(b.products));
      setExtended(dedupe(e.products));
      if (s && s.shops) {
        // Dedupe shops by _id so React keys are unique
        const uniqueShops = Array.from(new Map(s.shops.map((sh: Shop) => [sh._id, sh])).values());
        setPopularShops(uniqueShops);
      }

      // Check if there are more items to load
      if (!d.products || d.products.length < ITEMS_LIMIT) setDealsHasMore(false);
      if (!t.products || t.products.length < ITEMS_LIMIT) setTrendingHasMore(false);
      if (!b.products || b.products.length < ITEMS_LIMIT) setBestPriceHasMore(false);
      if (!e.products || e.products.length < ITEMS_LIMIT) setExtendedHasMore(false);

      // If something failed, try again (up to 2 more times)
      if (failed && attempt < 2) {
        retrying = true;
        setTimeout(() => fetchData(latitude, longitude, category, attempt + 1), 2000);
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      if (!retrying) setLoading(false);
    }
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    if (coords) {
      fetchData(coords.lat, coords.lng, category === "All" ? undefined : category);
    }
  };

  // --- PAGINATION LOAD MORE FUNCTIONS ---
  const loadMoreDeals = async () => {
    if (!coords || dealsPaginating || !dealsHasMore) return;
    setDealsPaginating(true);
    try {
      const res = await getDeals(coords.lat, coords.lng, selectedCategory === "All" ? undefined : selectedCategory, ITEMS_LIMIT, dealsSkip + ITEMS_LIMIT);
      if (res.products && res.products.length > 0) {
        setDeals(prev => {
          // Dedupe against prev AND within the incoming batch by _id
          const combined = [...prev, ...res.products];
          return Array.from(new Map(combined.map((p: any) => [p._id, p])).values());
        });
        setDealsSkip(prev => prev + ITEMS_LIMIT);
        if (res.products.length < ITEMS_LIMIT) setDealsHasMore(false);
      } else {
        setDealsHasMore(false);
      }
    } catch (e) {} finally { setDealsPaginating(false); }
  };

  const loadMoreTrending = async () => {
    if (!coords || trendingPaginating || !trendingHasMore) return;
    setTrendingPaginating(true);
    try {
      const res = await getTrendingProducts(coords.lat, coords.lng, selectedCategory === "All" ? undefined : selectedCategory, ITEMS_LIMIT, trendingSkip + ITEMS_LIMIT);
      if (res.products && res.products.length > 0) {
        setTrending(prev => {
          const combined = [...prev, ...res.products];
          return Array.from(new Map(combined.map((p: any) => [p._id, p])).values());
        });
        setTrendingSkip(prev => prev + ITEMS_LIMIT);
        if (res.products.length < ITEMS_LIMIT) setTrendingHasMore(false);
      } else {
        setTrendingHasMore(false);
      }
    } catch (e) {} finally { setTrendingPaginating(false); }
  };

  const loadMoreBestPrice = async () => {
    if (!coords || bestPricePaginating || !bestPriceHasMore) return;
    setBestPricePaginating(true);
    try {
      const res = await getBestPriceProducts(coords.lat, coords.lng, selectedCategory === "All" ? undefined : selectedCategory, ITEMS_LIMIT, bestPriceSkip + ITEMS_LIMIT);
      if (res.products && res.products.length > 0) {
        setBestPrice(prev => {
          const combined = [...prev, ...res.products];
          return Array.from(new Map(combined.map((p: any) => [p._id, p])).values());
        });
        setBestPriceSkip(prev => prev + ITEMS_LIMIT);
        if (res.products.length < ITEMS_LIMIT) setBestPriceHasMore(false);
      } else {
        setBestPriceHasMore(false);
      }
    } catch (e) {} finally { setBestPricePaginating(false); }
  };

  const loadMoreExtended = async () => {
    if (!coords || extendedPaginating || !extendedHasMore) return;
    setExtendedPaginating(true);
    try {
      const res = await getExtendedDeals(coords.lat, coords.lng, selectedCategory === "All" ? undefined : selectedCategory, ITEMS_LIMIT, extendedSkip + ITEMS_LIMIT);
      if (res.products && res.products.length > 0) {
        setExtended(prev => {
          const combined = [...prev, ...res.products];
          return Array.from(new Map(combined.map((p: any) => [p._id, p])).values());
        });
        setExtendedSkip(prev => prev + ITEMS_LIMIT);
        if (res.products.length < ITEMS_LIMIT) setExtendedHasMore(false);
      } else {
        setExtendedHasMore(false);
      }
    } catch (e) {} finally { setExtendedPaginating(false); }
  };
  // -------------------------------------

  const handleAcceptConsent = async () => {
    setShowConsentDialog(false);
    if (userId) await recordConsent(userId, "location", true);
    window.location.reload(); 
  };

  const handleDenyConsent = () => {
    setShowConsentDialog(false);
    setConsentDenied(true);
  };

  const handleRemoveCartItem = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) return;
    removeItem(userId, productId);
    setCartItems(getCart(userId));
  };

  const handleApplyReferral = async () => {
    if (!userId || !referralCode) return;
    setReferralLoading(true);
    const res = await applyReferral(userId, referralCode);
    setReferralLoading(false);
    if (res) {
      setShowReferral(false);
      alert("Referral Applied! You earned 1000 coins.");
    } else {
      alert("Invalid code or network error.");
    }
  };

  const handleSkipReferral = async () => {
    if (!userId) return;
    setReferralLoading(true);
    await skipReferral(userId);
    setReferralLoading(false);
    setShowReferral(false);
  };

  if (!roleChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F6F6]">
        <div className="w-10 h-10 border-4 border-[#6200EE] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F6] pb-32 text-black relative font-sans">
      <style>{`
        @keyframes avLivePulse { from { opacity: 0.5; } to { opacity: 1; } }
        @keyframes avPlaceholderIn { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <ProfileSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* CONSENT DIALOG */}
      {showConsentDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-6">
          <div className="bg-white rounded-[16px] p-6 w-full max-w-sm text-center">
            <h2 className="text-[22px] font-bold text-black mb-3">Location Consent</h2>
            <p className="text-[14px] text-[#444444] mb-6 leading-5">
              Your current location will be used every time you are on the home page to show products available in your neighborhood. This helps you find the best deals nearby.
            </p>
            <div className="flex space-x-3">
              <button onClick={handleDenyConsent} className="flex-1 h-10 border border-[#79747E] rounded-full text-[14px] font-medium text-[#6200EE]">Deny</button>
              <button onClick={handleAcceptConsent} className="flex-1 h-10 bg-[#6200EE] text-white rounded-full text-[14px] font-medium">Agree</button>
            </div>
          </div>
        </div>
      )}

      {/* REFERRAL DIALOG */}
      {showReferral && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-black mb-1">Referral Code</h2>
            <p className="text-sm text-gray-600 mb-4">Enter a code to earn 1000 coins!</p>
            <input 
              type="text" 
              placeholder="Enter code" 
              value={referralCode} 
              onChange={e => setReferralCode(e.target.value)} 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none mb-4"
            />
            {referralLoading ? (
              <div className="flex justify-center py-2"><div className="w-6 h-6 border-2 border-[#6200EE] border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
              <div className="flex space-x-3">
                <button onClick={handleSkipReferral} className="flex-1 py-2.5 border border-gray-300 rounded-lg font-bold text-gray-700">Skip</button>
                <button onClick={handleApplyReferral} className="flex-1 py-2.5 bg-[#6200EE] text-white rounded-lg font-bold">Apply</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="w-full max-w-7xl mx-auto flex flex-col">
        <InstallAppBanner />
        {/* SCROLLABLE HEADER SECTION */}
        <div className="bg-[#F6F6F6]">
          {/* HEADER */}
          <div className="px-4 pt-2 pb-[2px] flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-[24px] font-semibold tracking-[-0.8px] text-black">Tegami</h1>
            </div>
            <div className="flex items-center space-x-3">
              {role && userDetails && (
                <Link href="/coins" className="flex items-center bg-transparent rounded-full px-1 py-[2px]">
                  <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center mr-1.5 shadow-[0_2px_4px_rgba(255,215,0,0.5)]" style={{ background: "linear-gradient(135deg, #FFDF00, #D4AF37)" }}>
                    <span className="text-[12px] font-extrabold text-white">₹</span>
                  </div>
                  <span className="text-[17px] font-bold text-black">{userDetails.coins || 0}</span>
                </Link>
              )}
              {!role && <Link href="/owner/login" className="text-sm font-bold text-[#6200EE]">Are you an owner?</Link>}
              <button 
                onClick={() => { if (role) setIsSidebarOpen(true); else router.push("/login"); }} 
                className="w-[38px] h-[38px] bg-white rounded-full flex items-center justify-center shadow-sm"
              >
                <svg className="w-[32px] h-[32px] text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM7.07 18.28c.43-.9 3.05-1.78 4.93-1.78s4.51.88 4.93 1.78C15.57 19.36 13.86 20 12 20s-3.57-.64-4.93-1.72zm11.29-1.45c-1.43-1.74-4.9-2.33-6.36-2.33s-4.93.59-6.36 2.33C4.62 15.49 4 13.82 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8c0 1.82-.62 3.49-1.64 4.83zM12 6c-1.94 0-3.5 1.56-3.5 3.5S10.06 13 12 13s3.5-1.56 3.5-3.5S13.94 6 12 6zm0 5c-.83 0-1.5-.67-1.5-1.5S11.17 8 12 8s1.5.67 1.5 1.5S12.83 11 12 11z"></path></svg>
              </button>
            </div>
          </div>

          <div className="px-4">
            <h2 className="text-[14px] font-medium text-[#424242] whitespace-nowrap overflow-hidden">Find what's available nearby — instantly.</h2>
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-[#047857] mr-2 shrink-0" style={{ animation: "avLivePulse 0.8s ease-in-out infinite alternate" }}></div>
              <p className="flex-1 min-w-0 text-[14px] font-medium text-[#424242] whitespace-nowrap overflow-hidden">{shopCount} shops changed prices in the last 30 minutes</p>
            </div>
          </div>
        </div>

        {/* STICKY AREA: Search Bar & Categories */}
        <div className="sticky top-0 z-50 bg-[#F6F6F6]">
          {/* SEARCH BAR */}
          <div className="px-4 py-1">
            <div onClick={() => router.push("/shops")} className="bg-[#E0E0E0] rounded-full px-4 h-[44px] flex items-center cursor-pointer">
              <svg className="w-[24px] h-[24px] text-black mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <div className="flex-1 min-w-0 overflow-hidden h-[20px]">
                <span key={placeholderIndex} className="block text-[14px] leading-[20px] italic text-[#444444] truncate" style={{ animation: "avPlaceholderIn 0.4s ease-out" }}>{SEARCH_PLACEHOLDERS[placeholderIndex]}</span>
              </div>
            </div>
          </div>

          {/* CATEGORY ROW */}
          <CategoryScrollRow selected={selectedCategory} onSelect={handleCategorySelect} />
        </div>

        {/* LOCATION ROW */}
        {!consentDenied && coords && (
          <div className="px-4 mb-1">
            <div className="flex items-center">
              <svg className="w-[16px] h-[16px] text-[#FF0000] mr-1 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
              <span className="flex-1 min-w-0 text-[14px] font-semibold text-black truncate leading-[15px] border-b border-black pb-[2px]">
                {currentAddress === "Locating..." ? "Near you" : currentAddress}
              </span>
              {locationFailed ? (
                <button onClick={() => window.location.reload()} className="ml-2 text-[13px] font-bold text-[#6200EE] shrink-0">
                  Retry
                </button>
              ) : (
                <div className="w-2 shrink-0"></div>
              )}            </div>
          </div>
        )}

        {/* MAIN CONTENT AREA */}
        <div>
          {consentDenied ? (
             <div className="flex flex-col items-center justify-center p-4 gap-4 text-center">
               <svg className="w-12 h-12 text-[#6200EE]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
               <h3 className="text-[16px] font-bold text-black">Location Required</h3>
               <p className="text-[14px] text-gray-500 px-4">We need your location to show products and shops near you. Please agree to continue.</p>
               <button onClick={() => { setConsentDenied(false); setShowConsentDialog(true); }} className="bg-[#6200EE] text-white h-10 px-6 rounded-full text-[14px] font-medium">Agree</button>
             </div>
          ) : !coords ? (
            <div className="flex justify-center py-10">
              <div className="w-10 h-10 border-4 border-[#6200EE] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              <LiveFindsSection lat={coords.lat} lng={coords.lng} />
              
              <ProductSection 
                title="Deals Near You" 
                description="Offers ending today in shops around you" 
                products={deals} 
                sectionType="DEALS" 
                seeAllLink="/deals" 
                isLoading={loading} 
                isPaginating={dealsPaginating} 
                onLoadMore={loadMoreDeals} 
              />
              <ProductSection 
                title="Trending Near You" 
                description="Most viewed products in the last 1 hour" 
                products={trending} 
                sectionType="TRENDING" 
                seeAllLink="/trending" 
                isLoading={loading} 
                isPaginating={trendingPaginating} 
                onLoadMore={loadMoreTrending} 
              />
              <ProductSection 
                title="Best Price Nearby" 
                description="Cheapest options available around you" 
                products={bestPrice} 
                sectionType="BEST_PRICE" 
                seeAllLink="/best-price" 
                isLoading={loading} 
                isPaginating={bestPricePaginating} 
                onLoadMore={loadMoreBestPrice} 
              />
              <ProductSection 
                title="Worth the Distance" 
                description="People travel a bit extra for these deals" 
                products={extended} 
                sectionType="DISTANCE" 
                seeAllLink="/extended" 
                isLoading={loading} 
                isPaginating={extendedPaginating} 
                onLoadMore={loadMoreExtended} 
              />

              {/* POPULAR SHOPS */}
              {!loading && popularShops.length > 0 && (
                <div className="mb-8">
                  <div className="px-4 mb-3">
                    <h3 className="text-[18px] font-bold text-black">Popular Shops Near You</h3>
                  </div>
                  <div className="flex space-x-3 overflow-x-auto no-scrollbar px-4 pb-2">
                    {popularShops.map((shop) => (
                      <Link href={`/shop/${shop._id}`} key={shop._id} className="block w-[220px] flex-shrink-0">
                        <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 p-3 flex items-center">
                          <div className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center mr-3 shrink-0">
                            <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[14px] font-bold text-black truncate">{shop.name}</p>
                            <div className="flex items-center text-[12px] text-gray-500 mt-0.5">
                              <span>{shop.distance && shop.distance < 1 ? `${(shop.distance * 1000).toFixed(0)} mts` : `${shop.distance?.toFixed(1)} km`}</span>
                              <span className="mx-1">•</span>
                              <span className="text-[#018786] font-medium">{shop.total_views || 0} views</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* SHOPPING BUBBLE DOCK */}
      {cartItems.length > 0 && !consentDenied && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-gray-200 h-[60px] z-40 flex items-center justify-between overflow-hidden">
          
          {/* SCROLLING ITEM PREVIEWS */}
          <div className="flex overflow-x-auto no-scrollbar space-x-2 pl-3 flex-1 py-2">
            {cartItems.map((item, idx) => (
              <div key={`${item.shop_id}_${item.product_id}_${idx}`} className="relative w-9 h-9 shrink-0">
                 <div className="w-9 h-9 rounded-full bg-white border border-gray-200 overflow-hidden shadow-sm">
                   {item.image_url ? (
                     <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                   ) : (
                     <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                       <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                     </div>
                   )}
                 </div>
                 {/* Remove Button */}
                 <button 
                   onClick={(e) => handleRemoveCartItem(item.product_id, e)}
                   className="absolute -top-1 -right-1 w-4 h-4 bg-[#B00020] rounded-full border border-white flex items-center justify-center cursor-pointer"
                 >
                   <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                 </button>
              </div>
            ))}
          </div>

          {/* VIEW CART BUTTON */}
          <button 
            onClick={() => router.push('/cart')}
            className="flex items-center px-4 h-full shrink-0 border-l border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <span className="text-[13px] font-bold text-black whitespace-nowrap">
              {cartItems.reduce((a, b) => a + b.quantity, 0)} Item{cartItems.reduce((a, b) => a + b.quantity, 0) > 1 ? 's' : ''} • View Cart
            </span>
            <svg className="w-3.5 h-3.5 text-black ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  );
}