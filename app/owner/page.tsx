"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUserIdFromToken, getDashboardMetrics, getShopPerformance, getShopDetails, getToken } from "../../lib/api";
import { DashboardMetrics, PerformanceData, ShopDetails } from "../../lib/types";
import ProfileSidebar from "../../components/ProfileSidebar";
import BottomNav from "../../components/BottomNav";

export default function OwnerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [performance, setPerformance] = useState<PerformanceData[]>([]);
  const [shop, setShop] = useState<ShopDetails | null>(null);
  const [showQrDialog, setShowQrDialog] = useState(false);

  const ownerId = getUserIdFromToken();
  const token = getToken();

  useEffect(() => {
    // Only redirect if we are SURE there is no token AND we are not currently logging out
    if (!ownerId && !token) {
      router.push("/owner/login");
      return;
    }

    const fetchData = async () => {
      try {
        const [m, p, s] = await Promise.all([
          getDashboardMetrics(ownerId || ""),
          getShopPerformance(ownerId || ""),
          getShopDetails(ownerId || "")
        ]);
        if (m) setMetrics(m);
        if (p) setPerformance(p.performance || []);
        if (s) setShop(s.shop);
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
        <div className="w-10 h-10 border-4 border-avPrimary border-t-transparent rounded-full animate-spin"></div>
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

  const statusBgColor = isLowVisibility ? "bg-red-50" : isVerified ? "bg-green-50" : "bg-orange-50";
  const statusBorderColor = isLowVisibility ? "border-red-200" : isVerified ? "border-green-300" : "border-orange-300";
  const statusTextColor = isLowVisibility ? "text-red-600" : isVerified ? "text-green-600" : "text-orange-600";

  return (
    <div className="min-h-screen bg-[#F6F6F6] pb-24">
      <ProfileSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* HEADER */}
      <div className="px-4 py-3 flex justify-between items-center bg-[#F6F6F6] sticky top-0 z-50">
        <div>
          <h1 className="text-2xl font-bold text-black">Owner Dashboard</h1>
          <p className="text-sm font-medium text-gray-500">
            {shop?.name ? `Hello, ${shop.name}` : "Hello, here's today's overview."}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
          </button>
          <button onClick={() => setIsSidebarOpen(true)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-black">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </button>
        </div>
      </div>

      <div className="px-4 space-y-4 mt-2">
        {/* STATUS BANNER */}
        <div className={`${statusBgColor} border ${statusBorderColor} rounded-xl p-3 flex items-center justify-between`}>
          <div className="flex items-center space-x-2">
            <svg className={`w-5 h-5 ${statusTextColor}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className={`text-xs ${statusTextColor} opacity-80`}>Status</p>
              <p className={`text-sm font-bold ${statusTextColor}`}>{statusText}</p>
            </div>
          </div>
          <button className="bg-avPrimary text-white text-xs font-bold px-3 py-1.5 rounded-lg">Contact</button>
        </div>

        {/* MAP PLACEHOLDER */}
        <div className="w-full h-64 bg-gray-300 rounded-xl flex items-center justify-center shadow-sm">
          <p className="text-gray-500 font-medium">Live Map (Skipped)</p>
        </div>

        {/* PERFORMANCE CHART */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-base font-bold text-black mb-4">Performance (Last 30 Days)</h3>
          <div className="w-full h-48 bg-gray-50 rounded-lg flex items-end justify-between p-2">
            {performance.length > 0 ? (
              performance.slice(-10).map((d, i) => (
                <div key={i} className="flex flex-col items-center flex-1 mx-0.5">
                  <div className="w-full bg-avPrimary/20 rounded-t-sm relative group flex justify-center">
                     <div className="w-1/2 bg-avPrimary rounded-t-sm" style={{ height: `${Math.min(d.sales * 2, 100)}px` }}></div>
                     <div className="w-1/2 bg-green-400 rounded-t-sm" style={{ height: `${Math.min(d.views * 2, 100)}px` }}></div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 w-full text-center mb-16">Not enough data to display chart.</p>
            )}
          </div>
        </div>

        {/* SHARE QR BUTTON */}
        <button 
          onClick={() => setShowQrDialog(true)}
          className="w-full bg-white rounded-xl p-4 flex items-center justify-between shadow-sm border border-gray-100"
        >
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6 text-avPrimary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
            <span className="text-base font-medium text-black">Share my shop</span>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
        </button>

        {/* METRICS ROW 1 */}
        <div className="flex space-x-3">
          <MetricCard title="Today's Views" value={performance[performance.length - 1]?.views?.toString() || "0"} icon="views" />
          <MetricCard title="No Stock" value={metrics?.noStockItems?.toString() || "0"} icon="stock" isError={Number(metrics?.noStockItems) > 0} />
        </div>

        {/* METRICS ROW 2 */}
        <div className="flex space-x-3">
          <MetricCard title="Active Promotions" value={metrics?.activePromotions?.toString() || "0"} icon="promo" />
          <MetricCard title="Referral Cash" value={`₹0`} icon="cash" />
        </div>
      </div>

      {/* QR DIALOG */}
      {showQrDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col items-center">
            <h2 className="text-xl font-bold mb-4">Share My Shop</h2>
            <img 
              src={`https://api.avapp.in/shop/generate-qr/${ownerId}`} 
              alt="Shop QR Code" 
              className="w-48 h-48 border p-2 rounded-lg"
            />
            <p className="text-xs text-center text-gray-500 mt-4 mb-6">
              Scan to open the shop directly. Share this link with your customers.
            </p>
            <div className="flex justify-between w-full space-x-3">
              <button onClick={() => setShowQrDialog(false)} className="flex-1 py-3 text-gray-500 font-bold">Close</button>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`https://avapp.in/shop/${ownerId}`);
                  alert("Link copied to clipboard!");
                }} 
                className="flex-1 bg-avPrimary text-white rounded-xl font-bold py-3 flex items-center justify-center"
              >
                Share Link
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

function MetricCard({ title, value, icon, isError = false }: { title: string, value: string, icon: string, isError?: boolean }) {
  return (
    <div className="flex-1 bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col justify-center">
      <div className="flex items-center space-x-2 mb-1">
        {icon === "views" && <svg className="w-5 h-5 text-avPrimary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>}
        {icon === "stock" && <svg className={`w-5 h-5 ${isError ? 'text-red-500' : 'text-avPrimary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>}
        {icon === "promo" && <svg className="w-5 h-5 text-avPrimary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>}
        {icon === "cash" && <svg className="w-5 h-5 text-avPrimary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>}
        <span className={`text-2xl font-extrabold ${isError ? 'text-red-500' : 'text-black'}`}>{value}</span>
      </div>
      <p className={`text-xs font-medium ${isError ? 'text-red-500' : 'text-gray-500'}`}>{title}</p>
    </div>
  );
}