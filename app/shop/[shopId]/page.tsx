"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { getShopDetails, recordShopView, askAvailability, getUserIdFromToken } from "../../../lib/api";
import { ShopDetails, Product } from "../../../lib/types";
import { addItem } from "../../../lib/cart";
import { calculateDistance, getDaysSinceUpdate } from "../../../lib/utils";

// 1. WRAP IN SUSPENSE (Fixes the Next.js 16 useParams error)
export default function ShopDetailsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="w-10 h-10 border-4 border-avPrimary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ShopDetailsContent />
    </Suspense>
  );
}

// 2. MOVE LOGIC TO INNER COMPONENT
function ShopDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const shopId = params.shopId as string;
  const userId = getUserIdFromToken();

  const [shop, setShop] = useState<ShopDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!shopId) return;
    
    const init = async () => {
      try {
        await recordShopView(shopId);
        const res = await getShopDetails(shopId);
        setShop(res.shop);
      } catch (err) {
        console.error("Failed to load shop", err);
      } finally {
        setLoading(false);
      }
    };
    init();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.log("Location denied")
      );
    }
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;

    syncIntervalRef.current = setInterval(async () => {
      try {
        const res = await getShopDetails(shopId);
        setShop((prevShop) => {
          if (JSON.stringify(prevShop) !== JSON.stringify(res.shop)) {
            return res.shop;
          }
          return prevShop;
        });
      } catch (e) {}
    }, 4000);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [shopId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="w-10 h-10 border-4 border-avPrimary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F5]">
        <p className="text-gray-500 mb-4">Couldn't load this shop.</p>
        <button onClick={() => window.location.reload()} className="text-avPrimary font-bold">Try again</button>
      </div>
    );
  }

  // Safety check if products is undefined
  const productsList = shop.products || [];
  const categoryList = Array.from(new Set(productsList.map(p => p.category).filter(Boolean))) as string[];
  const categories = ["All", ...categoryList];
  
  // 3. FIX THE toLowerCase ERROR (Safely read product_name or name)
  const filteredProducts = productsList
    .filter(p => selectedCategory === "All" || p.category === selectedCategory)
    .filter(p => {
      const pName = p.name || (p as any).product_name || "";
      return pName.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      const aSale = a.isOnSale && new Date(a.saleEndDate || 0) > new Date();
      const bSale = b.isOnSale && new Date(b.saleEndDate || 0) > new Date();
      if (aSale && !bSale) return -1;
      if (!aSale && bSale) return 1;
      if (a.inStock && !b.inStock) return -1;
      if (!a.inStock && b.inStock) return 1;
      return 0;
    });

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-20">
      <div className="sticky top-0 z-50 bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        </button>
        <div className="flex-1 flex justify-center items-center space-x-2">
          <h1 className="text-lg font-bold text-black truncate max-w-[200px]">{shop.name}</h1>
          {shop.pickups && shop.pickups >= 3 && (
            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded border border-green-300 flex items-center">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              VERIFIED
            </span>
          )}
        </div>
        <button className="p-2 -mr-2">
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex justify-between items-center">
          <span className="font-bold text-avPrimary">Distance</span>
          <div className="flex items-center text-avPrimary font-bold">
            <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
            {userLocation ? (
              (() => {
                const dist = calculateDistance(userLocation.lat, userLocation.lng, shop.latitude, shop.longitude);
                return dist < 1 ? `${(dist * 1000).toFixed(0)} m` : `${dist.toFixed(1)} km`;
              })()
            ) : "Unknown"}
          </div>
        </div>

        {shop.description && (
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-gray-500 tracking-wider">ABOUT THIS SHOP</h3>
              {shop.mobile_number && (
                <a href={`tel:${shop.mobile_number}`} className="text-avPrimary text-sm font-semibold flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
                  {shop.mobile_number}
                </a>
              )}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{shop.description}</p>
          </div>
        )}

        <div className="bg-[#E0E0E0] rounded-full px-4 py-2.5 flex items-center">
          <svg className="w-5 h-5 text-black mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input 
            type="text" 
            placeholder="Search in shop..." 
            className="bg-transparent w-full outline-none text-sm text-black placeholder-gray-600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex overflow-x-auto no-scrollbar space-x-2 pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border ${
                selectedCategory === cat 
                  ? 'bg-avPrimary text-white border-avPrimary' 
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            {searchQuery ? `No items match '${searchQuery}'` : "No items found."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-10">
            {filteredProducts.map((product) => (
              <ShopProductCard key={product.id} product={product} shop={shop} userId={userId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 4. INNER PRODUCT CARD SAFE RENDERING
function ShopProductCard({ product, shop, userId }: { product: Product, shop: ShopDetails, userId: string | null }) {
  const daysSinceUpdate = getDaysSinceUpdate(product.last_updated);
  const isOutOfStock = !product.inStock;
  const isStale = !isOutOfStock && daysSinceUpdate >= 3;
  const showNotifyButton = isOutOfStock || isStale;

  const [lastAsked, setLastAsked] = useState<number>(0);
  useEffect(() => {
    const prefs = localStorage.getItem(`ask_cooldown_${product.id}`);
    if (prefs) setLastAsked(parseInt(prefs));
  }, [product.id]);

  const millisSinceAsked = product.last_asked_at ? new Date().getTime() - new Date(product.last_asked_at).getTime() : -1;
  const askedByAnyone = millisSinceAsked >= 0 && millisSinceAsked < 5 * 60 * 60 * 1000;
  const canAsk = (new Date().getTime() - lastAsked > 5 * 60 * 60 * 1000) && !askedByAnyone;

  const handleAddToCart = () => {
    if (!userId) {
      alert("Please log in to add items.");
      return;
    }
    const pName = product.name || (product as any).product_name || "Item";
    addItem(userId, product, shop._id || "", shop.name, shop.latitude, shop.longitude, shop.pickups, shop.reports);
    alert(`${pName} added!`);
  };

  const handleAskAvailability = async () => {
    if (!userId || !canAsk) return;
    try {
      await askAvailability(product.id, userId);
      const now = new Date().getTime();
      setLastAsked(now);
      localStorage.setItem(`ask_cooldown_${product.id}`, now.toString());
      alert("Request sent! Owner notified.");
    } catch (e) {
      alert("Failed to send request.");
    }
  };

  const currentlyOnSale = product.isOnSale && product.saleEndDate && new Date(product.saleEndDate) > new Date();
  // Safely get display name
  const displayName = product.name || (product as any).product_name || "Unknown Product";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      <div className="h-32 relative p-2 bg-white flex justify-center items-center">
        <img src={product.imageUrl} alt={displayName} className={`object-contain w-full h-full ${isOutOfStock ? 'opacity-60' : ''}`} />
        <div className="absolute top-2 right-2 bg-avSecondary rounded-full px-2 py-0.5 text-[9px] font-bold text-black">+3 coins</div>
        {currentlyOnSale ? (
          <div className="absolute top-0 left-0 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-br-lg">SALE</div>
        ) : isOutOfStock ? (
          <div className="absolute top-2 left-2 bg-avError text-white text-[9px] font-bold px-2 py-0.5 rounded">SOLD OUT</div>
        ) : null}
      </div>
      <div className="w-full h-[1px] bg-gray-100"></div>
      <div className="p-3 flex flex-col flex-grow">
        <p className="text-[13px] font-semibold text-black truncate">{displayName}</p>
        <p className="text-[11px] text-gray-500">{product.unit?.replace("_", " ") || ""}</p>
        <div className="flex items-center mt-1 space-x-1">
          {currentlyOnSale && product.salePrice ? (
            <>
              <span className="text-[13px] font-bold text-black">₹{product.salePrice}</span>
              <span className="text-[11px] text-gray-400 line-through">₹{product.price}</span>
            </>
          ) : (
            <span className="text-[13px] font-bold text-black">₹{product.price}</span>
          )}
        </div>
        {!isOutOfStock && daysSinceUpdate >= 0 && (
          <p className="text-[10px] text-green-600 mt-1">Updated {daysSinceUpdate === 0 ? "today" : `${daysSinceUpdate} days ago`}</p>
        )}
        <div className="mt-auto pt-2">
          {showNotifyButton ? (
            <button onClick={handleAskAvailability} disabled={!canAsk} className={`w-full py-1.5 rounded text-xs font-bold border ${canAsk ? 'border-avPrimary text-avPrimary bg-transparent' : 'border-gray-300 text-gray-400 bg-gray-50'}`}>
              {canAsk ? "Notify Me" : "Sent"}
            </button>
          ) : (
            <button onClick={handleAddToCart} className="w-full py-1.5 rounded text-xs font-bold border border-avPrimary text-avPrimary bg-transparent hover:bg-purple-50">
              ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );
}