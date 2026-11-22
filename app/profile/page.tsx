"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserIdFromToken, getUserDetails, getMyFinds } from "../../lib/api";
import { UserDetails, LiveFind } from "../../lib/types";
import UserLevelProgressBar from "../../components/UserLevelProgressBar";

export default function ProfileDashboardPage() {
  const router = useRouter();
  const userId = getUserIdFromToken();
  
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [myFinds, setMyFinds] = useState<LiveFind[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock Level Info (you can update this with actual API response if you add it)
  const levelInfo = { level: 2, level_name: "Local Finder", progress: 0.6, posts: 5, views: 30, likes: 5 };

  useEffect(() => {
    if (!userId) {
      router.push("/login");
      return;
    }
    
    const fetchData = async () => {
      try {
        const [u, f] = await Promise.all([
          getUserDetails(userId),
          getMyFinds()
        ]);
        if (u) setUserDetails(u);
        if (f && f.posts) setMyFinds(f.posts);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [userId, router]);

  if (isLoading) return <div className="min-h-screen bg-[#F6F6F6] flex items-center justify-center"><div className="w-10 h-10 border-4 border-avPrimary border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#F6F6F6] pb-10">
      {/* HEADER */}
      <div className="bg-white px-4 py-4 flex items-center shadow-sm sticky top-0 z-50">
        <button onClick={() => router.back()} className="p-2 -ml-2 mr-2">
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        </button>
        <h1 className="text-[18px] font-bold text-black">Profile Dashboard</h1>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* USER INFO CARD */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center">
          <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
            <svg className="w-8 h-8 text-avPrimary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div className="ml-4 flex-1">
            <h2 className="text-[18px] font-bold text-gray-800 leading-tight">{userDetails?.fullName || "User"}</h2>
            <p className="text-[13px] text-gray-500">{userDetails?.email || ""}</p>
            <div className="flex items-center space-x-2 mt-0.5">
              <p className="text-[13px] text-gray-500">{userDetails?.city || ""}</p>
              <span className="bg-[#03DAC5] text-black text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                {userDetails?.role || "customer"}
              </span>
            </div>
            <div className="flex items-center mt-1.5 text-avPrimary">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <span className="text-[14px] font-bold">{userDetails?.coins || 0} Coins</span>
            </div>
          </div>
        </div>

        {/* LEVEL PROGRESS */}
        <UserLevelProgressBar levelInfo={levelInfo} />

        {/* MY FINDS SECTION */}
        <h3 className="text-[18px] font-bold text-gray-800 pt-2">My Finds</h3>
        
        {myFinds.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
            <p className="text-sm text-gray-500">You haven't posted any Live Finds yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {myFinds.map((post, index) => (
              <div 
                key={post.id} 
                onClick={() => router.push(`/profile/finds?start=${index}`)}
                className="aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer bg-gray-100"
              >
                <img src={post.image_url} alt="Find" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}