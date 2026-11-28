"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUserIdFromToken, getDashboardMetrics, getShopPerformance, getShopDetails, getToken, getUserDetails } from "../../lib/api";
import { DashboardMetrics, PerformanceData, ShopDetails, UserDetails, ShopLocationMapData } from "../../lib/types";
import ProfileSidebar from "../../components/ProfileSidebar";
import BottomNav from "../../components/BottomNav";
import OwnerLiveMap from "../../components/OwnerLiveMap"

export default function OwnerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [performance, setPerformance] = useState<PerformanceData[]>([]);
  const [shop, setShop] = useState<ShopDetails | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [allShopLocations, setAllShopLocations] = useState<ShopLocationMapData[]>([]);

  const ownerId = getUserIdFromToken();
  const token = getToken();

  useEffect(() => {
    if (!ownerId && !token) {
      router.push("/owner/login");
      return;
    }

    const fetchData = async () => {
      try {
        const [m, p, s, u] = await Promise.all([
          getDashboardMetrics(ownerId || ""),
          getShopPerformance(ownerId || ""),
          getShopDetails(ownerId || ""),
          getUserDetails(ownerId || "")
        ]);
        if (m) setMetrics(m);
        if (p) setPerformance(p.performance || []);
        if (s) setShop(s.shop);
        if (u) setUserDetails(u);
      } catch (err) {
        console.error("Failed to fetch owner data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ownerId, token, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F6F6]">
        <div className="w-10 h-10 border-4 border-[#6200EE] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const pickups = shop?.pickups || 0;
  const reports = shop?.reports || 0;
  const isLowVisibility = reports > 5;
  const isVerified = pickups >= 3;

  const statusText = isLowVisibility 
    ? "Low visibility" 
    : isVerified 
      ? "Verified" 
      : `Need ${3 - pickups} more pickups to get verified`;

  const statusBgColor = isLowVisibility ? "bg-[#FEF2F2]" : isVerified ? "bg-[#F0FDF4]" : "bg-[#FFF7ED]";
  const statusBorderColor = isLowVisibility ? "border-[#FCA5A5]" : isVerified ? "border-[#86EFAC]" : "border-[#FDBA74]";
  const statusTextColor = isLowVisibility ? "text-[#DC2626]" : isVerified ? "text-[#059669]" : "text-[#D97706]";
  const contactColor = isLowVisibility ? "bg-[#B00020]" : "bg-[#6200EE]";

  return (
    <div className="min-h-screen bg-[#F6F6F6] pb-32">
      <ProfileSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="w-full max-w-4xl mx-auto flex flex-col">
        
        {/* HEADER */}
        <div className="px-4 pt-4 pb-2 flex justify-between items-center bg-[#F6F6F6] sticky top-0 z-50">
          <div className="flex-1 pr-2">
            <h1 className="text-[24px] font-bold text-black leading-tight truncate">Owner Dashboard</h1>
            <p className="text-[14px] font-medium text-gray-500 truncate">
              {shop?.name ? `Hello, ${shop.name}` : "Hello, here's today's overview."}
            </p>
          </div>
          
          <div className="flex items-center space-x-3 shrink-0 -translate-y-2">
            {/* NOTIFICATION BELL */}
            <Link href="/notifications" className="w-[34px] h-[34px] bg-white rounded-full flex items-center justify-center shadow-sm text-[#6B7280]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            </Link>
            
            {/* PROFILE */}
            <button onClick={() => setIsSidebarOpen(true)} className="w-[38px] h-[38px] bg-white rounded-full flex items-center justify-center shadow-sm text-black">
              <svg className="w-[32px] h-[32px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </button>
          </div>
        </div>

        <div className="px-4 space-y-3 mt-2">
          {/* STATUS BANNER */}
          <div className={`${statusBgColor} border ${statusBorderColor} rounded-[12px] p-2.5 flex items-center justify-between shadow-sm`}>
            <div className="flex items-center space-x-2.5">
              {isLowVisibility ? (
                <svg className={`w-[22px] h-[22px] ${statusTextColor}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              ) : isVerified ? (
                <svg className={`w-[22px] h-[22px] ${statusTextColor}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              ) : (
                <svg className={`w-[22px] h-[22px] ${statusTextColor}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
              )}
              <div className="flex flex-col justify-center">
                <p className={`text-[12px] ${statusTextColor} opacity-80 leading-tight`}>Status</p>
                <p className={`text-[14px] font-bold ${statusTextColor} leading-tight mt-0.5`}>{statusText}</p>
              </div>
            </div>
            
            <a href="tel:+910000000000" className={`${contactColor} text-white text-[12px] font-bold px-3 h-[36px] rounded-[8px] flex items-center shrink-0`}>
               <svg className="w-[16px] h-[16px] mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
               Contact
            </a>
          </div>

          {/* LIVE TRACKING MAP */}
          {ownerId && shop && (
            <OwnerLiveMap ownerId={ownerId} shop={shop} allShops={allShopLocations} />
          )}

          {/* PERFORMANCE CHART */}
          <div className="bg-white rounded-[16px] p-4 shadow-sm border border-[#F3F4F6]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[16px] font-bold text-black">Performance (Last 30 Days)</h3>
              {performance.length > 0 && (
                <div className="flex space-x-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-[#2ECC71] mr-1"></div>
                    <span className="text-[10px] text-gray-500 font-medium">Sales</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-[#3498DB] mr-1"></div>
                    <span className="text-[10px] text-gray-500 font-medium">Views</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="w-full h-[220px] bg-transparent overflow-hidden flex">
              {performance.length > 0 ? (
                <PerformanceLineChart data={performance} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-[14px] text-gray-400">Not enough data to display chart.</p>
                </div>
              )}
            </div>
          </div>

          {/* SHARE QR BUTTON */}
          <button 
            onClick={() => setShowQrDialog(true)}
            className="w-full bg-white rounded-[12px] p-4 flex items-center shadow-sm border border-[#F3F4F6] transition-transform active:scale-[0.99]"
          >
            <svg className="w-[24px] h-[24px] text-[#6200EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
            <span className="text-[16px] font-medium text-black ml-4">Share my shop</span>
            <svg className="w-[24px] h-[24px] text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
          </button>

          {/* METRICS ROW 1 */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard 
              title="Today's Views" 
              value={performance[performance.length - 1]?.views?.toString() || "0"} 
              icon="views" 
            />
            <MetricCard 
              title="No Stock" 
              value={metrics?.noStockItems?.toString() || "0"} 
              icon="stock" 
              isError={Number(metrics?.noStockItems) > 0} 
              onClick={() => router.push("/myshop?section=no_stock")}
            />
          </div>

          {/* METRICS ROW 2 */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard 
              title="Active Promotions" 
              value={metrics?.activePromotions?.toString() || "0"} 
              icon="promo" 
              onClick={() => router.push("/myshop?section=promotion")}
            />
            <MetricCard 
              title="Referral Cash" 
              value={`₹${userDetails?.referral_earnings?.toFixed(0) || 0}`} 
              icon="cash" 
              onClick={() => alert("Referral page coming soon")} 
            />
          </div>
        </div>
      </div>

      {/* QR DIALOG */}
      {showQrDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-[16px] p-6 w-full max-w-sm flex flex-col items-center">
            <h2 className="text-[20px] font-bold mb-4 text-black">Share My Shop</h2>
            <img 
              src={`https://api.avapp.in/shop/generate-qr/${ownerId}`} 
              alt="Shop QR Code" 
              className="w-[200px] h-[200px] object-contain"
            />
            <p className="text-[12px] text-center text-gray-500 mt-4 mb-6 leading-relaxed">
              Scan to open the shop directly. Share this link with your customers.
            </p>
            <div className="flex justify-between w-full items-center">
              <button onClick={() => setShowQrDialog(false)} className="text-[14px] text-gray-500 font-bold px-2 py-1">Close</button>
              <button
                onClick={async () => {
                  const shopUrl = `https://avapp.in/shop/${ownerId}`;
                  const shareText = `Hey! 👋 Check out my local store on Tegami!\n\nTap the link below to explore my shop and grab the best deals right in our neighborhood:\n\n👉 ${shopUrl}`;

                  try {
                    // Try native Web Share API with text only
                    if (navigator.share && navigator.canShare({ text: shareText })) {
                      await navigator.share({
                        title: 'Check out my shop on Tegami!',
                        text: shareText,
                      });
                    } else {
                      // Fallback: Copy to clipboard
                      await navigator.clipboard.writeText(shareText);
                      alert("Link and message copied to clipboard!");
                    }
                  } catch (err) {
                    console.error('Error sharing:', err);
                    alert("Error sharing. Please try again.");
                  }
                }}
                className="bg-[#6200EE] text-white rounded-[8px] font-bold text-[14px] px-4 py-2 flex items-center justify-center"
              >
                <svg className="w-[16px] h-[16px] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                Share Shop Link
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

function MetricCard({ title, value, icon, isError = false, onClick }: { title: string, value: string, icon: string, isError?: boolean, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-[12px] p-4 shadow-sm border border-[#F3F4F6] flex flex-col justify-center ${onClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
    >
      <div className="flex items-center space-x-2 mb-1">
        {icon === "views" && <svg className="w-[20px] h-[20px] text-[#6200EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>}
        {icon === "stock" && <svg className={`w-[20px] h-[20px] ${isError ? 'text-[#B00020]' : 'text-[#6200EE]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>}
        {icon === "promo" && <svg className="w-[20px] h-[20px] text-[#6200EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>}
        {icon === "cash" && <svg className="w-[20px] h-[20px] text-[#6200EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>}
        <span className={`text-[24px] font-extrabold ${isError ? 'text-[#B00020]' : 'text-black'}`}>{value}</span>
      </div>
      <p className={`text-[12px] font-medium ${isError ? 'text-[#B00020]' : 'text-gray-500'}`}>{title}</p>
    </div>
  );
}

function PerformanceLineChart({ data }: { data: PerformanceData[] }) {
  const chartData = data; 
  const height = 150;
  const padding = 10;
  const pointSpacing = 40; // Space between days
  const width = Math.max(chartData.length * pointSpacing, 300);
  
  const maxVal = Math.max(
    ...chartData.map(d => Math.max(d.sales, d.views)),
    10 
  );

  const getSmoothPath = (key: 'sales' | 'views') => {
    const points = chartData.map((d, i) => {
      const x = padding + (i * pointSpacing);
      const y = height - padding - ((d[key] / maxVal) * (height - padding * 2));
      return { x, y };
    });

    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const midX = (p0.x + p1.x) / 2;
      path += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  return (
    <div className="flex w-full h-full">
      {/* Y-AXIS LABELS (Exactly like Kotlin) */}
      <div className="w-16 shrink-0 h-full flex flex-col justify-between py-2 text-[9px] font-bold text-gray-500 text-right pr-2">
        <span>Excellent</span>
        <span>Super</span>
        <span>Good</span>
      </div>

      {/* SCROLLABLE CHART AREA */}
      <div className="flex-1 overflow-x-auto no-scrollbar relative">
        <div style={{ width: `${width}px` }} className="h-full relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
            {/* Grid lines */}
            <line x1="0" y1={height * 0.15} x2={width} y2={height * 0.15} stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />
            <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />
            <line x1="0" y1={height * 0.85} x2={width} y2={height * 0.85} stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />

            {/* Views Line (Blue) */}
            <path d={getSmoothPath('views')} fill="none" stroke="#3498DB" strokeWidth="2.5" />
            {/* Sales Line (Green) */}
            <path d={getSmoothPath('sales')} fill="none" stroke="#2ECC71" strokeWidth="3.5" />
            
            {/* Data Dots for Sales */}
            {chartData.map((d, i) => {
              const x = padding + (i * pointSpacing);
              const y = height - padding - ((d.sales / maxVal) * (height - padding * 2));
              return <circle key={i} cx={x} cy={y} r="3" fill="#2ECC71" />
            })}
          </svg>
          
          {/* X-Axis Labels (Positioned under dots) */}
          <div className="absolute bottom-0 left-0 w-full flex">
            {chartData.map((d, i) => (
              <div key={i} style={{ width: `${pointSpacing}px` }} className="flex justify-center mt-1">
                <span className="text-[9px] text-gray-400 font-medium whitespace-nowrap">
                  {d.date.slice(-5).replace("-", "/")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}