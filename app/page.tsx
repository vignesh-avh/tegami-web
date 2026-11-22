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

const FALLBACK_LOCATION = { lat: 17.3850, lng: 78.4867 };

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

  // User & Consent states
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [consentDenied, setConsentDenied] = useState(false);
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [currentAddress, setCurrentAddress] = useState("Locating...");

  // Cart Bubble state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [shopCount, setShopCount] = useState(5);

  // Categories
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Referral State
  const [showReferral, setShowReferral] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralLoading, setReferralLoading] = useState(false);

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

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            setCoords({ lat, lng });
            fetchData(lat, lng);

            // REAL REVERSE GEOCODING
            try {
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
              const data = await res.json();
              if (data && data.address) {
                const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.state_district;
                const state = data.address.state;
                const postcode = data.address.postcode;
                const addrParts = [city, state, postcode].filter(Boolean);
                setCurrentAddress(addrParts.length > 0 ? addrParts.join(", ") : "Near you");
              } else {
                setCurrentAddress("Near you");
              }
            } catch {
              setCurrentAddress("Near you");
            }
          },
          () => {
            setCoords(FALLBACK_LOCATION);
            setCurrentAddress("Near you");
            fetchData(FALLBACK_LOCATION.lat, FALLBACK_LOCATION.lng);
          },
          { timeout: 5000, enableHighAccuracy: true }
        );
      } else {
        setCoords(FALLBACK_LOCATION);
        setCurrentAddress("Near you");
        fetchData(FALLBACK_LOCATION.lat, FALLBACK_LOCATION.lng);
      }
      setRoleChecked(true);
    };

    initialize();
  }, [router]);

  const fetchData = async (latitude: number, longitude: number, category?: string) => {
    setLoading(true);
    try {
      const [d, t, b, e, s] = await Promise.all([
        getDeals(latitude, longitude, category).catch(() => ({ products: [] })),
        getTrendingProducts(latitude, longitude, category).catch(() => ({ products: [] })),
        getBestPriceProducts(latitude, longitude, category).catch(() => ({ products: [] })),
        getExtendedDeals(latitude, longitude, category).catch(() => ({ products: [] })),
        getNearbyShops(latitude, longitude, category).catch(() => null)
      ]);
      setDeals(d.products);
      setTrending(t.products);
      setBestPrice(b.products);
      setExtended(e.products);
      if (s && s.shops) setPopularShops(s.shops);
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    if (coords) {
      fetchData(coords.lat, coords.lng, category === "All" ? undefined : category);
    }
  };

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
        {/* FIXED TOP AREA: header, subtitle, search, categories (pinned like Android) */}
        <div className="sticky top-0 z-50 bg-[#F6F6F6]">
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
              <div className="w-2 shrink-0"></div>
            </div>
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
              
              <ProductSection title="Deals Near You" description="Offers ending today in shops around you" products={deals} sectionType="DEALS" seeAllLink="/deals" isLoading={loading} />
              <ProductSection title="Trending Near You" description="Most viewed products in the last 1 hour" products={trending} sectionType="TRENDING" seeAllLink="/trending" isLoading={loading} />
              <ProductSection title="Best Price Nearby" description="Cheapest options available around you" products={bestPrice} sectionType="BEST_PRICE" seeAllLink="/best-price" isLoading={loading} />
              <ProductSection title="Worth the Distance" description="People travel a bit extra for these deals" products={extended} sectionType="DISTANCE" seeAllLink="/extended" isLoading={loading} />

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