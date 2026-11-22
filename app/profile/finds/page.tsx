"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUserIdFromToken, getMyFinds, deleteLiveFind, toggleLiveFindLike } from "../../../lib/api";
import { LiveFind } from "../../../lib/types";
import { timeAgo } from "../../../lib/utils";

const LEVEL_COLORS = ["#059669", "#0284C7", "#7C3AED", "#EA580C", "#CA8A04"];

function FindsFeedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startIndex = parseInt(searchParams.get("start") || "0");
  const userId = getUserIdFromToken();
  
  const [posts, setPosts] = useState<LiveFind[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    getMyFinds().then(res => {
      if (res && res.posts) setPosts(res.posts);
      setIsLoading(false);
    });
  }, [userId]);

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    const success = await deleteLiveFind(postId);
    if (success) {
      setPosts(prev => prev.filter(p => p.id !== postId));
    }
  };

  const handleLike = async (postId: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const isLiked = p.liked_by?.includes(userId || "");
        return { 
          ...p, 
          likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1,
          liked_by: isLiked ? p.liked_by?.filter(id => id !== userId) : [...(p.liked_by || []), userId || ""]
        };
      }
      return p;
    }));
    await toggleLiveFindLike(postId);
  };

  if (isLoading) return <div className="min-h-screen bg-[#F6F6F6] flex items-center justify-center"><div className="w-10 h-10 border-4 border-avPrimary border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#F6F6F6]">
      <div className="bg-white px-4 py-4 flex items-center shadow-sm sticky top-0 z-50">
        <button onClick={() => router.back()} className="p-2 -ml-2 mr-2">
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        </button>
        <h1 className="text-[18px] font-bold text-black">My Finds</h1>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4 pb-20">
        {posts.map((post) => {
          const level = post.user_level || 1;
          const levelColor = LEVEL_COLORS[Math.min(level - 1, 4)];
          const isLiked = post.liked_by?.includes(userId || "");

          return (
            <div key={post.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
              {/* HEADER */}
              <div className="p-3 pb-1 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold" style={{ backgroundColor: ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"][(post.user_name.charCodeAt(0) + post.user_name.length) % 5] }}>
                    {post.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-gray-900 leading-tight truncate max-w-[120px]">{post.user_name}</p>
                    <div className="flex items-center text-[10px] text-gray-500">
                      {timeAgo(post.created_at)}
                      <span className="text-gray-300 px-1">•</span>
                      <div className="w-[5px] h-[5px] rounded-full mr-1" style={{ backgroundColor: levelColor }} />
                      <span className="font-semibold tracking-wide" style={{ color: levelColor }}>{post.user_level_name || "Explorer"}</span>
                    </div>
                  </div>
                </div>
                {post.is_own && (
                  <button onClick={() => handleDelete(post.id)} className="text-gray-400 p-1 hover:text-red-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                  </button>
                )}
              </div>

              {/* IMAGE */}
              <div className="px-1.5 py-1">
                <div className="relative aspect-[4/5] rounded overflow-hidden cursor-pointer" onClick={() => router.push(`/shop/${post.shop_id}`)}>
                  <img src={post.image_url} alt="Post" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                </div>
              </div>

              {/* DETAILS */}
              <div className="p-3 pt-1 flex flex-col flex-grow">
                <p className="text-[13px] text-gray-500 mb-1">
                  Found at <span className="text-avPrimary font-semibold cursor-pointer hover:underline" onClick={() => router.push(`/shop/${post.shop_id}`)}>{post.shop_name}</span>
                </p>
                <div className="min-h-[28px]">
                  {post.description && <p className="text-[12px] text-gray-800 leading-tight line-clamp-2">{post.description}</p>}
                </div>
                <div className="mt-auto pt-2 flex items-center space-x-1.5 cursor-pointer" onClick={() => handleLike(post.id)}>
                  <svg className={`w-5 h-5 transition-transform ${isLiked ? 'text-red-500 scale-110' : 'text-gray-400'}`} fill={isLiked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className={`text-[12px] font-semibold ${isLiked ? 'text-red-500' : 'text-gray-500'}`}>{post.likes_count}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FindsFeedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F6F6F6] flex items-center justify-center"><div className="w-10 h-10 border-4 border-avPrimary border-t-transparent rounded-full animate-spin"></div></div>}>
      <FindsFeedContent />
    </Suspense>
  );
}