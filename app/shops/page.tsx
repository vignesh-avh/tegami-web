"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getNearbyShops, searchShops } from "../../lib/api";
import { Shop } from "../../lib/types";
import BottomNav from "../../components/BottomNav";

// --- ICONS (SVG Paths matching Material Icons) ---
const Icons = {
  Search: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Close: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
  Location: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>,
  Verified: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
  SearchOff: <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4l16 16" /></svg>,
  
  // Category Icons
  All: <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  Kirana: <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>,
  Snacks: <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Dairy: <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  Drinks: <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Fruits: <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Tech: <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Stat: <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Others: <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
};

const PLACEHOLDERS = [
  "Search for products...",
  "Find 'Amul Butter'...",
  "Find 'Lays Chips'...",
  "Find 'Fresh Apples'..."
];

const CATEGORIES = [
  { id: "All", label: "All", icon: Icons.All },
  { id: "Kirana", label: "Kirana", icon: Icons.Kirana },
  { id: "Snacks", label: "Snacks", icon: Icons.Snacks },
  { id: "Dairy", label: "Dairy", icon: Icons.Dairy },
  { id: "Drinks", label: "Drinks", icon: Icons.Drinks },
  { id: "Fruits & vegetables", label: "Fruits & Veg", icon: Icons.Fruits },
  { id: "TechTools", label: "TechTools", icon: Icons.Tech },
  { id: "Stat.", label: "Stat.", icon: Icons.Stat },
  { id: "Others", label: "Others", icon: Icons.Others },
];

// Fallback location (Hyderabad) if browser blocks location on HTTP
const FALLBACK_LOCATION = { lat: 17.3850, lng: 78.4867 };

export default function ShopsScreen() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [shops, setShops] = useState<Shop[]>([]);
  const [nearbyShops, setNearbyShops] = useState<Shop[]>([]);
  
  const [uiState, setUiState] = useState<"INITIAL" | "LOADING" | "SUCCESS" | "EMPTY_RESULT" | "ERROR">("INITIAL");
  const [nearbyState, setNearbyState] = useState<"LOADING" | "LOADED" | "EMPTY" | "ERROR" | "NO_LOCATION">("LOADING");
  
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Dynamic Placeholder Animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Location & Initial Nearby Shops
  const requestLocation = () => {
    setNearbyState("LOADING");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          fetchNearby(lat, lng);
        },
        (error) => {
          console.warn("Geolocation blocked/failed. Using fallback location.");
          setLocation(FALLBACK_LOCATION);
          fetchNearby(FALLBACK_LOCATION.lat, FALLBACK_LOCATION.lng);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    } else {
      console.warn("Geolocation not supported. Using fallback.");
      setLocation(FALLBACK_LOCATION);
      fetchNearby(FALLBACK_LOCATION.lat, FALLBACK_LOCATION.lng);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const fetchNearby = async (lat: number, lng: number) => {
    setNearbyState("LOADING");
    try {
      const res = await getNearbyShops(lat, lng);
      if (res && res.shops) {
        setNearbyShops(res.shops);
        setNearbyState(res.shops.length === 0 ? "EMPTY" : "LOADED");
      } else {
        setNearbyState("ERROR");
      }
    } catch {
      setNearbyState("ERROR");
    }
  };

  // 3. Search Logic with 300ms Debounce
  const handleQueryChange = (val: string) => {
    setQuery(val);
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!val.trim()) {
      setUiState("INITIAL");
      setShops([]);
      return;
    }

    setUiState("LOADING");
    
    searchTimeoutRef.current = setTimeout(async () => {
      // Use fallback if location is somehow still null
      const lat = location?.lat || FALLBACK_LOCATION.lat;
      const lng = location?.lng || FALLBACK_LOCATION.lng;

      try {
        const res = await searchShops(val.trim(), lat, lng);
        if (res && res.shops) {
          setShops(res.shops);
          setUiState(res.shops.length === 0 ? "EMPTY_RESULT" : "SUCCESS");
        } else {
          setUiState("ERROR");
        }
      } catch {
        setUiState("ERROR");
      }
    }, 300);
  };

  const handleCategoryClick = (categoryId: string) => {
    if (categoryId === "All") {
      handleQueryChange("");
    } else {
      handleQueryChange(categoryId);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-24 text-black font-sans flex flex-col">
      
      {/* Responsive Container: max-w-7xl for wide screens, centered */}
      <div className="w-full max-w-7xl mx-auto flex flex-col flex-1 px-0 md:px-6 lg:px-8">
        
        {/* HEADER SECTION */}
        <div className="px-4 md:px-0 pt-4 pb-2 bg-[#F5F5F5]">
          <h1 className="text-[22px] font-bold text-[#121212] leading-[28px]">Explore Market</h1>
          <p className="text-[12px] text-[#757575] mb-3">Find shops and products around you.</p>

          {/* SEARCH BAR */}
          <div 
            className="bg-[#E0E0E0] rounded-full px-4 h-[44px] flex items-center shadow-none relative overflow-hidden cursor-text"
            onClick={() => document.getElementById('search-input')?.focus()}
          >
            <div className="text-black mr-2 shrink-0">{Icons.Search}</div>
            
            <div className="relative flex-1 h-full flex items-center">
              {/* Animated Placeholder */}
              {query.length === 0 && (
                <span 
                  key={placeholderIndex}
                  className="absolute text-[14px] text-gray-700 animate-[fadeInOut_2.5s_ease-in-out_infinite] whitespace-nowrap pointer-events-none"
                >
                  {PLACEHOLDERS[placeholderIndex]}
                </span>
              )}
              
              <input
                id="search-input"
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                className="w-full h-full bg-transparent outline-none text-[14px] text-black relative z-10"
              />
            </div>

            {query.length > 0 && (
              <button onClick={() => handleQueryChange("")} className="text-gray-700 p-1 ml-2 shrink-0 hover:bg-gray-300 rounded-full transition-colors">
                {Icons.Close}
              </button>
            )}
          </div>
        </div>

        {/* CATEGORY SECTION */}
        <div className="py-2">
          <h3 className="text-[16px] font-bold text-[#121212] px-4 md:px-0 mb-2">Categories</h3>
          <div className="flex overflow-x-auto no-scrollbar px-4 md:px-0 space-x-2 pb-2">
            {CATEGORIES.map((cat) => {
              const isSelected = cat.id === "All" ? query === "" : query.toLowerCase() === cat.id.toLowerCase();
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`flex flex-col items-center justify-center min-w-[76px] min-h-[56px] rounded-[12px] border px-1.5 py-1 transition-all ${
                    isSelected 
                      ? "bg-[#6200EE]/10 border-[#6200EE]/40 text-[#6200EE]" 
                      : "bg-white border-[#E0E0E0]/50 text-[#757575]"
                  }`}
                >
                  <div className={isSelected ? "text-[#6200EE]" : "text-[#757575]/70"}>{cat.icon}</div>
                  <span 
                    className={`text-[10px] mt-0.5 text-center leading-[12px] line-clamp-2 ${
                      isSelected ? "font-semibold text-[#6200EE]" : "font-medium text-[#757575]"
                    }`}
                  >
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTENT SWITCHER */}
        <div className="mt-1 flex-1">
          {query.trim().length > 0 ? (
            // --- SEARCH RESULTS ---
            <>
              {uiState === "LOADING" && <ShopListSkeleton />}
              {uiState === "EMPTY_RESULT" && (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-gray-500">
                  <div className="text-gray-300 mb-4">{Icons.SearchOff}</div>
                  <p className="text-[14px]">No shops found for "{query.trim()}".</p>
                </div>
              )}
              {uiState === "ERROR" && (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                  <div className="text-[#B00020] mb-4">{Icons.SearchOff}</div>
                  <p className="text-[14px] text-gray-500 mb-4">Error loading shops.</p>
                  <button onClick={() => handleQueryChange(query)} className="text-[#6200EE] font-bold">Try Again</button>
                </div>
              )}
              {uiState === "SUCCESS" && (
                <div className="px-4 md:px-0 pb-4">
                  <p className="text-[12px] font-bold text-[#6200EE] mb-2">{shops.length} Shops Found</p>
                  {/* Responsive Grid: 1 col mobile, 2 col tablet, 3 col desktop, 4 col large desktop */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {shops.map((shop) => (
                      <ShopListItem key={shop._id} shop={shop} isSearchResult />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            // --- NEARBY SHOPS (INITIAL) ---
            <div className="px-4 md:px-0 pb-4">
              <h3 className="text-[16px] font-bold text-[#121212] mb-2">Shops Around You</h3>
              
              {nearbyState === "LOADING" && <ShopListSkeleton />}
              
              {(nearbyState === "EMPTY" || nearbyState === "ERROR" || nearbyState === "NO_LOCATION") && (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <p className="text-[14px] text-[#757575] mb-3 text-center">
                    {nearbyState === "EMPTY" ? "No shops found nearby." : 
                     nearbyState === "NO_LOCATION" ? "Location access required to find nearby shops." : 
                     "Error loading nearby shops."}
                  </p>
                  <button onClick={requestLocation} className="text-[#6200EE] font-bold hover:underline">
                    Try Again
                  </button>
                </div>
              )}

              {nearbyState === "LOADED" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {nearbyShops.map((shop) => (
                    <ShopListItem key={shop._id} shop={shop} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
      
      {/* Custom CSS for placeholder fade animation */}
      <style jsx global>{`
        @keyframes fadeInOut {
          0%, 100% { opacity: 0; transform: translateY(4px); }
          10%, 90% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// --- SHOP LIST ITEM COMPONENT ---
function ShopListItem({ shop, isSearchResult = false }: { shop: Shop, isSearchResult?: boolean }) {
  const router = useRouter();
  const isVerified = shop.pickups !== undefined && shop.pickups >= 3;
  
  // Distance formatting (exactly matching Android logic)
  const distText = shop.distance !== undefined 
    ? shop.distance < 1.0 
      ? `${Math.round(shop.distance * 1000)} m` 
      : `${shop.distance.toFixed(1)} km`
    : null;

  // Safely extract product names from the backend string format
  const cleanProductName = (raw: string) => {
    if (raw.includes("name=")) {
      return raw.substringAfter("name=").substringBefore(",").trim();
    }
    return raw;
  };

  return (
    <div 
      onClick={() => router.push(`/shop/${shop._id}`)}
      className="bg-white rounded-[16px] border border-[#E0E0E0]/50 p-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)] cursor-pointer hover:shadow-md transition-all active:scale-[0.99] flex flex-col"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5 flex-1 min-w-0">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-[#6200EE]/15 flex items-center justify-center shrink-0">
            <span className="text-[14px] font-bold text-[#6200EE]">{shop.name.charAt(0).toUpperCase()}</span>
          </div>
          
          <div className="flex items-center min-w-0 flex-1">
            <h3 className="text-[16px] font-bold text-[#121212] truncate">{shop.name}</h3>
            
            {/* Verified Badge */}
            {isVerified && (
              <span className="ml-1.5 flex items-center bg-[#10B981]/15 border border-[#10B981]/50 px-1 py-[1px] rounded-[4px] shrink-0">
                <span className="text-[#10B981] scale-75 flex items-center justify-center">{Icons.Verified}</span>
                <span className="text-[8px] font-extrabold text-[#065F46] ml-0.5 uppercase tracking-wider">Verified</span>
              </span>
            )}
          </div>
        </div>

        {/* Distance */}
        {distText && (
          <div className="flex items-center text-[#757575] ml-2 shrink-0">
            <span className="text-[#6200EE] mr-0.5 flex items-center justify-center">{Icons.Location}</span>
            <span className="text-[11px] font-medium">{distText}</span>
          </div>
        )}
      </div>

      {/* PREVIEW STRIP */}
      <div className="mt-2">
        {shop.preview_images && shop.preview_images.length > 0 ? (
          <div className="flex space-x-2.5 overflow-x-auto no-scrollbar">
            {shop.preview_images.slice(0, 4).map((img, idx) => (
              <div key={idx} className="flex flex-col items-center w-[64px] shrink-0">
                <div className="w-[64px] h-[64px] rounded-[10px] bg-[#E0E0E0]/30 overflow-hidden relative">
                  <img src={img} alt="Product" className="w-full h-full object-cover" />
                </div>
                {isSearchResult && shop.products && shop.products[idx] && (
                  <p className="text-[10px] text-[#757575] mt-1.5 text-center leading-tight line-clamp-1 w-full">
                    {cleanProductName(shop.products[idx])}
                  </p>
                )}
              </div>
            ))}
            {/* +MORE BOX */}
            <div className="flex flex-col items-center w-[64px] shrink-0">
              <div className="w-[64px] h-[64px] rounded-[10px] bg-[#E0E0E0]/40 flex items-center justify-center">
                <span className="text-[11px] font-bold text-[#757575]">+More</span>
              </div>
            </div>
          </div>
        ) : shop.products && shop.products.length > 0 ? (
          // Fallback if no images
          <div className="flex flex-wrap gap-1.5">
            {shop.products.slice(0, 4).map((prod, idx) => (
              <span key={idx} className="bg-[#E0E0E0]/50 text-[#757575] text-[11px] px-2 py-1 rounded-[6px]">
                {cleanProductName(prod)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// --- SKELETON LOADER ---
function ShopListSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 px-4 md:px-0 pb-4">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="bg-white rounded-[16px] border border-[#E0E0E0]/30 p-2 animate-pulse flex flex-col">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#E0E0E0]"></div>
            <div className="flex-1 h-[18px] bg-[#E0E0E0] rounded-[4px] w-1/2"></div>
            <div className="w-[50px] h-[12px] bg-[#E0E0E0] rounded-[4px]"></div>
          </div>
          <div className="mt-2 flex space-x-2.5">
            {[1, 2, 3].map((j) => (
              <div key={j} className="w-[64px] h-[64px] rounded-[10px] bg-[#E0E0E0] shrink-0"></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Helper to replicate Kotlin's substringAfter/Before
declare global {
  interface String {
    substringAfter(delimiter: string): string;
    substringBefore(delimiter: string): string;
  }
}
String.prototype.substringAfter = function(delimiter) {
  const idx = this.indexOf(delimiter);
  return idx === -1 ? this.toString() : this.substring(idx + delimiter.length);
};
String.prototype.substringBefore = function(delimiter) {
  const idx = this.indexOf(delimiter);
  return idx === -1 ? this.toString() : this.substring(0, idx);
};