"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserIdFromToken, getUserDetails, getCoinHistory } from "../../lib/api";
import { CoinTransaction } from "../../lib/types";

export default function CoinsHistoryPage() {
  const router = useRouter();
  const userId = getUserIdFromToken();
  
  const [coins, setCoins] = useState(0);
  const [history, setHistory] = useState<CoinTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"last30" | "all">("last30");

  useEffect(() => {
    if (!userId) {
      router.push("/login");
      return;
    }
    
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [u, h] = await Promise.all([
          getUserDetails(userId),
          getCoinHistory(userId, selectedTab)
        ]);
        if (u) setCoins(u.coins || 0);
        if (h) setHistory(h.transactions || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [userId, router, selectedTab]);

  return (
    <div className="min-h-screen bg-[#F3F4F6] pb-10">
      {/* HEADER */}
      <div className="bg-white px-4 py-4 flex items-center shadow-sm sticky top-0 z-50">
        <button onClick={() => router.back()} className="p-2 -ml-2 mr-2">
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        </button>
        <div className="flex items-center bg-[#03DAC5] rounded-md p-1 mr-2 shadow-sm">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
        </div>
        <h1 className="text-[18px] font-extrabold text-black">Coins History</h1>
      </div>

      <div className="max-w-md mx-auto px-4 mt-2">
        {/* BALANCE CARD */}
        <div className="bg-[#03DAC5]/10 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden mb-4">
           <div className="absolute top-0 right-0 w-48 h-48 bg-[#03DAC5]/15 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
           <div className="w-16 h-16 bg-[#03DAC5] rounded-full flex items-center justify-center shadow-lg mb-4">
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
           </div>
           <p className="text-[11px] font-bold text-gray-600 tracking-widest mb-1">TOTAL BALANCE</p>
           <div className="flex items-baseline space-x-2">
             <h2 className="text-4xl font-extrabold text-gray-900">{coins.toLocaleString()}</h2>
             <span className="text-lg font-bold text-[#03DAC5]">Coins</span>
           </div>
        </div>

        {/* TABS */}
        <div className="flex space-x-2 mb-4">
          <button 
            onClick={() => setSelectedTab("last30")}
            className={`px-4 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${selectedTab === "last30" ? 'bg-avPrimary text-white border-transparent' : 'bg-transparent text-gray-500 border-gray-200'}`}
          >
            Last 30 days
          </button>
          <button 
            onClick={() => setSelectedTab("all")}
            className={`px-4 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${selectedTab === "all" ? 'bg-avPrimary text-white border-transparent' : 'bg-transparent text-gray-500 border-gray-200'}`}
          >
            All time
          </button>
        </div>

        {/* HISTORY LIST */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-[#03DAC5] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : history.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-10">No transaction history</p>
        ) : (
          <div className="space-y-2">
            {history.map((tx, idx) => (
              <TransactionCard key={idx} transaction={tx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- TRANSACTION CARD COMPONENT ---
function TransactionCard({ transaction }: { transaction: CoinTransaction }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center text-[11px] text-gray-500 font-semibold">
          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {transaction.dateTime}
        </div>
        <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {transaction.productNames.slice(0, 2).map((prod, i) => (
          <div key={i} className="flex items-center bg-gray-50 border border-gray-100 rounded-md px-2 py-1">
            <svg className="w-3 h-3 text-gray-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
            <span className="text-[11px] font-bold text-black truncate max-w-[100px]">{prod}</span>
          </div>
        ))}
        {transaction.productNames.length > 2 && (
          <div className="bg-transparent border border-gray-200 rounded-md px-2 py-1 flex items-center justify-center">
            <span className="text-[10px] text-gray-500 font-bold">+{transaction.productNames.length - 2} more</span>
          </div>
        )}
      </div>

      <div className="h-px w-full bg-gray-100 mb-2" />

      <div className="flex justify-between items-end">
        <div>
          <p className="text-[9px] font-extrabold text-gray-400 tracking-wider">AMOUNT</p>
          <p className="text-base font-black text-black">₹{transaction.amount.toFixed(0)}</p>
        </div>
        <div className="bg-[#03DAC5]/10 border border-[#03DAC5]/30 rounded-full px-2 py-1 flex items-center">
          <svg className="w-3.5 h-3.5 text-[#03DAC5] mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span className="text-[12px] font-extrabold text-[#03DAC5]">+{transaction.coins} coins</span>
        </div>
      </div>
    </div>
  );
}