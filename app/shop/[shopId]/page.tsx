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
        <div className="w-10 h-10 border-4 border-[#6200EE] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ShopDetailsContent />
    </Suspense>
  );
}

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
  const [showMenu, setShowMenu] = useState(false);
  
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
        <div className="w-10 h-10 border-4 border-[#6200EE] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F5]">
        <p className="text-gray-500 mb-4">Couldn't load this shop.</p>
        <button onClick={() => window.location.reload()} className="text-[#6200EE] font-bold hover:underline">Try again</button>
      </div>
    );
  }

  // Safety check if products is undefined
  const productsList = shop.products || [];
  // Get unique categories and sort by count (most items first)
  const categoryCounts = productsList.reduce((acc, p) => {
    if (p.category) acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const categoryList = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]);
  const categories = ["All", ...categoryList];
  
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

  const distanceText = userLocation ? (
    (() => {
      const dist = calculateDistance(userLocation.lat, userLocation.lng, shop.latitude, shop.longitude);
      return dist < 1 ? `${(dist * 1000).toFixed(0)} m` : `${dist.toFixed(1)} km`;
    })()
  ) : "Unknown";

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-20 font-sans">
      
      {/* TOP BAR */}
      <div className="sticky top-0 z-50 bg-white shadow-sm px-2 py-2 flex items-center justify-between">
        <button onClick={() => router.back()} className="p-2 text-black">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        </button>
        
        <div className="flex-1 flex justify-center items-center space-x-1.5 min-w-0">
          <h1 className="text-[16px] font-bold text-black truncate max-w-[200px]">{shop.name}</h1>
          {shop.pickups && shop.pickups >= 3 && (
            <span className="bg-[#10B981]/15 text-[#065F46] text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-[#10B981]/50 flex items-center tracking-wider shrink-0">
              <svg className="w-3 h-3 mr-0.5 text-[#10B981]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              VERIFIED
            </span>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-black">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
          </button>
          {showMenu && (
            <div className="absolute right-0 top-10 w-36 bg-white rounded-lg shadow-xl border border-gray-100 z-50 py-1">
              <button onClick={() => { setShowMenu(false); alert("Shop reported."); }} className="w-full text-left px-4 py-2 text-[14px] text-[#B00020] font-semibold hover:bg-red-50">Report Shop</button>
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT CONTAINER */}
      <div className="max-w-7xl mx-auto p-4 md:px-8 space-y-4">
        
        {/* DISTANCE CARD */}
        <div className="w-full bg-[#6200EE]/5 border border-[#6200EE]/10 rounded-[16px] px-4 py-4 flex justify-between items-center">
          <span className="text-[16px] font-bold text-[#6200EE]">Distance</span>
          <div className="flex items-center text-[#6200EE] font-bold">
            <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
            <span className="text-[16px]">{distanceText}</span>
          </div>
        </div>

        {/* ABOUT CARD */}
        {shop.description && (
          <AboutCard description={shop.description} phone={shop.mobile_number} />
        )}

        {/* SEARCH BAR */}
        <div className="bg-[#E0E0E0] rounded-full px-4 h-[44px] flex items-center shadow-none">
          <svg className="w-5 h-5 text-black mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input 
            type="text" 
            placeholder="Search in shop..." 
            className="bg-transparent w-full outline-none text-[14px] text-black placeholder-gray-600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="p-1">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          )}
        </div>

        {/* CATEGORIES */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2 rounded-full text-[13px] font-medium whitespace-nowrap border transition-colors ${
                selectedCategory === cat 
                  ? 'bg-[#6200EE] text-white border-transparent' 
                  : 'bg-white text-[#121212] border-[#E0E0E0]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* PRODUCT GRID */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-[#757575]">
            {searchQuery ? `No items match '${searchQuery}'` : "No items found."}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-10">
            {filteredProducts.map((product) => (
              <ShopProductCard key={product.id} product={product} shop={shop} userId={userId} shopId={shopId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- ABOUT CARD COMPONENT ---
function AboutCard({ description, phone }: { description: string, phone?: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-[16px] border border-[#E5E7EB] p-3 pb-4">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-[10px] font-semibold text-[#757575] tracking-[0.8px] uppercase">About This Shop</h3>
        {phone && (
          <a href={`tel:${phone}`} className="text-[#6200EE] text-[13px] font-semibold flex items-center hover:underline">
            <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
            {phone}
          </a>
        )}
      </div>
      
      <div className="relative">
        <p className={`text-[13px] leading-[17px] text-[#121212] ${!expanded ? 'line-clamp-2' : ''}`}>
          {description}
        </p>
        {description.length > 80 && (
          <button 
            onClick={() => setExpanded(!expanded)} 
            className="text-[#6200EE] text-[13px] font-semibold mt-1 hover:underline"
          >
            {expanded ? "Less" : "More"}
          </button>
        )}
      </div>
    </div>
  );
}

// --- PRODUCT CARD COMPONENT ---
function ShopProductCard({ product, shop, userId, shopId }: { product: Product, shop: ShopDetails, userId: string | null, shopId: string }) {
  const router = useRouter();
  const daysSinceUpdate = getDaysSinceUpdate(product.last_updated);
  const isOutOfStock = !product.inStock;
  const isStale = !isOutOfStock && daysSinceUpdate >= 3;
  const showNotifyButton = isOutOfStock || isStale;

  const [lastAsked, setLastAsked] = useState<number>(0);
  const [showZoomedImage, setShowZoomedImage] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Multi-image logic
  const allImages = [
    product.imageUrl,
    ...(product.images || []).filter(img => img !== product.imageUrl && img)
  ].filter(Boolean) as string[];
  const hasMultipleImages = allImages.length > 1;

  useEffect(() => {
    const prefs = localStorage.getItem(`ask_cooldown_${product.id}`);
    if (prefs) setLastAsked(parseInt(prefs));
  }, [product.id]);

  const millisSinceAsked = product.last_asked_at ? new Date().getTime() - new Date(product.last_asked_at).getTime() : -1;
  const askedByAnyone = millisSinceAsked >= 0 && millisSinceAsked < 5 * 60 * 60 * 1000;
  const canAsk = (new Date().getTime() - lastAsked > 5 * 60 * 60 * 1000) && !askedByAnyone;

  const handleAddToCart = () => {
    if (!userId) {
      router.push("/login");
      return;
    }
    const pName = product.name || (product as any).product_name || "Item";
    addItem(userId, product, shop._id || shopId, shop.name, shop.latitude, shop.longitude, shop.pickups, shop.reports);
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
  const displayName = product.name || (product as any).product_name || "Unknown Product";

  // Touch swipe logic for mobile image gallery
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !hasMultipleImages) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 40 && currentImageIndex < allImages.length - 1) setCurrentImageIndex(prev => prev + 1);
    if (diff < -40 && currentImageIndex > 0) setCurrentImageIndex(prev => prev - 1);
    touchStartX.current = null;
  };

  return (
    <>
      <div className="bg-white rounded-[16px] shadow-sm border border-[#E0E0E0]/50 overflow-hidden flex flex-col">
        
        {/* IMAGE AREA */}
        <div 
          className="h-[150px] relative p-1 bg-white flex justify-center items-center cursor-pointer overflow-hidden"
          onClick={() => setShowZoomedImage(true)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img 
            src={allImages[currentImageIndex]} 
            alt={displayName} 
            className={`object-contain w-full h-full transition-opacity ${isOutOfStock ? 'opacity-60' : 'opacity-100'}`} 
          />
          
          {/* Badges */}
          <div className="absolute top-2 right-2 bg-[#03DAC5] rounded-full px-2 py-0.5 text-[9px] font-bold text-black shadow-sm pointer-events-none">
            +3 coins
          </div>
          
          {currentlyOnSale ? (
            <div className="absolute top-0 left-0 bg-[#D32F2F] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br-lg pointer-events-none">SALE</div>
          ) : isOutOfStock ? (
            <div className="absolute top-2 left-2 bg-[#B00020] text-white text-[9px] font-bold px-1.5 py-0.5 rounded pointer-events-none">SOLD OUT</div>
          ) : null}

          {/* Dots for multiple images */}
          {hasMultipleImages && (
            <div className="absolute bottom-1.5 bg-black/35 rounded-lg px-1.5 py-0.5 flex gap-1 pointer-events-none">
              {allImages.map((_, idx) => (
                <div key={idx} className={`w-1.5 h-1.5 rounded-full ${idx === currentImageIndex ? 'bg-white' : 'bg-white/50'}`} />
              ))}
            </div>
          )}
        </div>

        <div className="w-full h-[1px] bg-[#EEEEEE]"></div>

        {/* DETAILS AREA */}
        <div className="p-3 flex flex-col flex-grow">
          <p className="text-[13px] font-semibold text-[#121212] line-clamp-2 leading-tight">{displayName}</p>
          <p className="text-[11px] text-[#757575] mt-0.5">{product.unit?.replace("_", " ") || ""}</p>
          
          <div className="flex items-center mt-1 space-x-1.5">
            {currentlyOnSale && product.salePrice ? (
              <>
                <span className="text-[13px] font-bold text-[#121212]">₹{product.salePrice}</span>
                <span className="text-[11px] text-[#757575] line-through">₹{product.price}</span>
              </>
            ) : (
              <span className="text-[13px] font-bold text-[#121212]">₹{product.price}</span>
            )}
          </div>

          {currentlyOnSale && product.saleDescription && (
            <p className="text-[11px] font-medium text-[#6200EE] line-clamp-1 mt-0.5">{product.saleDescription}</p>
          )}

          {!isOutOfStock && daysSinceUpdate >= 0 && (
            <p className="text-[10px] text-[#4CAF50] mt-1">
              Updated {daysSinceUpdate === 0 ? "today" : `${daysSinceUpdate} days ago`}
            </p>
          )}

          <div className="mt-auto pt-2">
            {showNotifyButton ? (
              <button 
                onClick={handleAskAvailability} 
                disabled={!canAsk} 
                className={`w-full h-[32px] rounded-[4px] text-[11px] font-bold border transition-colors ${
                  canAsk 
                    ? 'border-[#6200EE] text-[#6200EE] bg-[#F5F5F5] hover:bg-purple-50' 
                    : 'border-gray-400 text-gray-400 bg-[#F0F0F0]'
                }`}
              >
                {canAsk ? "Notify Me" : "Sent"}
              </button>
            ) : (
              <button 
                onClick={handleAddToCart} 
                className="w-full h-[32px] rounded-[4px] text-[12px] font-bold border border-[#6200EE] text-[#6200EE] bg-transparent hover:bg-purple-50 transition-colors"
              >
                ADD
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ZOOM MODAL */}
      {showZoomedImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setShowZoomedImage(false)}>
          <div className="relative w-full max-w-lg aspect-square">
            <img src={allImages[currentImageIndex]} alt={displayName} className="w-full h-full object-contain" />
            <button className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}