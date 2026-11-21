"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDeals, getTrendingProducts, getBestPriceProducts, getExtendedDeals, getNearbyShops, getUserRoleFromToken } from "../lib/api";
import { HomeProduct, Shop } from "../lib/types";
import ProductSection from "../components/ProductSection";
import BottomNav from "../components/BottomNav";
import ProfileSidebar from "../components/ProfileSidebar";

export default function CustomerHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [roleChecked, setRoleChecked] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  
  const [deals, setDeals] = useState<HomeProduct[]>([]);
  const [trending, setTrending] = useState<HomeProduct[]>([]);
  const [bestPrice, setBestPrice] = useState<HomeProduct[]>([]);
  const [extended, setExtended] = useState<HomeProduct[]>([]);
  const [popularShops, setPopularShops] = useState<Shop[]>([]);

  useEffect(() => {
    const userRole = getUserRoleFromToken();
    setRole(userRole);

    if (userRole === "owner") {
      router.replace("/owner");
      return;
    }

    setRoleChecked(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => fetchData(position.coords.latitude, position.coords.longitude),
        () => fetchData(17.3850, 78.4867)
      );
    } else {
      fetchData(17.3850, 78.4867);
    }
  }, [router]);

  const fetchData = async (latitude: number, longitude: number) => {
    setLoading(true);
    try {
      const [d, t, b, e, s] = await Promise.all([
        getDeals(latitude, longitude).catch(() => ({ products: [] })),
        getTrendingProducts(latitude, longitude).catch(() => ({ products: [] })),
        getBestPriceProducts(latitude, longitude).catch(() => ({ products: [] })),
        getExtendedDeals(latitude, longitude).catch(() => ({ products: [] })),
        getNearbyShops(latitude, longitude).catch(() => null)
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

  if (!roleChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="w-10 h-10 border-4 border-avPrimary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-24 text-black">
      <ProfileSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* HEADER */}
      <div className="px-4 py-2 flex justify-between items-center bg-white shadow-sm sticky top-0 z-50">
        <div className="flex items-center">
          <h1 className="text-2xl font-semibold tracking-tighter text-black">Tegami</h1>
        </div>
        <div className="flex items-center space-x-3">
           
           {/* Are you an owner? (Only show if not logged in) */}
           {!role && (
             <Link href="/owner/login" className="text-sm font-bold text-avPrimary">
               Are you an owner?
             </Link>
           )}

           {/* Profile Icon (Always show) */}
           <button 
             onClick={() => {
               if (role) {
                 setIsSidebarOpen(true);
               } else {
                 router.push("/login");
               }
             }} 
             className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center"
           >
             <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
           </button>
        </div>
      </div>

      <div className="px-4 mt-2">
        <h2 className="text-sm font-medium text-gray-700">Find what's available nearby — instantly.</h2>
        <div className="flex items-center mt-1">
          <div className="w-2 h-2 rounded-full bg-green-700 animate-pulse mr-2"></div>
          <p className="text-sm font-medium text-gray-700">5 shops changed prices in the last 30 minutes</p>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="px-4 mt-4">
        <div className="bg-[#E0E0E0] rounded-full px-4 py-2.5 flex items-center cursor-pointer">
          <svg className="w-5 h-5 text-black mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <span className="text-sm italic text-gray-700">Search for products near you</span>
        </div>
      </div>

      {/* CATEGORY ROW */}
      <div className="mt-4 px-4 overflow-x-auto no-scrollbar flex space-x-2">
        {["All", "Kirana", "Snacks", "Dairy", "Drinks", "Fruits & vegetables", "TechTools", "Stat.", "Others"].map((cat, i) => (
          <button key={cat} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border ${i === 0 ? 'bg-avPrimary/80 text-white border-transparent' : 'bg-[#F5F5F5] text-[#424242] border-gray-200'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-10 h-10 border-4 border-avPrimary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            <ProductSection title="Deals Near You" description="Offers ending today in shops around you" products={deals} sectionType="DEALS" seeAllLink="/deals" />
            <ProductSection title="Trending Near You" description="Most viewed products in the last 1 hour" products={trending} sectionType="TRENDING" seeAllLink="/trending" />
            <ProductSection title="Best Price Nearby" description="Cheapest options available around you" products={bestPrice} sectionType="BEST_PRICE" seeAllLink="/best-price" />
            <ProductSection title="Worth the Distance" description="People travel a bit extra for these deals" products={extended} sectionType="DISTANCE" seeAllLink="/extended" />

            {/* POPULAR SHOPS */}
            {popularShops.length > 0 && (
              <div className="mb-8">
                <h3 className="text-[18px] font-bold text-black px-4 mb-3">Popular Shops Near You</h3>
                <div className="flex space-x-3 overflow-x-auto no-scrollbar px-4 pb-2">
                  {popularShops.map((shop) => (
                    <Link href={`/shop/${shop._id}`} key={shop._id} className="block w-[220px] flex-shrink-0">
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex items-center">
                        <div className="w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center mr-3">
                          <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-[14px] font-bold text-black truncate">{shop.name}</p>
                          <div className="flex items-center text-[12px] text-gray-500 mt-0.5">
                            <span>{shop.distance && shop.distance < 1 ? `${(shop.distance * 1000).toFixed(0)} mts` : `${shop.distance?.toFixed(1)} km`}</span>
                            <span className="mx-1">•</span>
                            <span className="text-avAccent font-medium">{shop.total_views || 0} views</span>
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
      <BottomNav />
    </div>
  );
}