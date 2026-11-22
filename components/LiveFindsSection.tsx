"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getLiveFindsFeed, toggleLiveFindLike, recordLiveFindView, deleteLiveFind, getUserIdFromToken, getNearbyShops, createLiveFind } from "../lib/api";
import { LiveFind, Shop } from "../lib/types";
import { timeAgo } from "../lib/utils";

const LEVEL_COLORS = ["#059669", "#0284C7", "#7C3AED", "#EA580C", "#CA8A04"];

export default function LiveFindsSection({ lat, lng }: { lat: number, lng: number }) {
  const router = useRouter();
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [posts, setPosts] = useState<LiveFind[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUserId = getUserIdFromToken();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capturedImage, setCapturedImage] = useState<File | null>(null);
  const [showCreationModal, setShowCreationModal] = useState(false);

  useEffect(() => {
    if (lat && lng) fetchFeed(lat, lng);
  }, [lat, lng]);

  const fetchFeed = async (latitude: number, longitude: number) => {
    setLoading(true);
    try {
      const res = await getLiveFindsFeed(latitude, longitude);
      if (res && res.posts) setPosts(res.posts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const isLiked = p.liked_by?.includes(currentUserId || "");
        const newLikes = isLiked ? p.likes_count - 1 : p.likes_count + 1;
        const newLikedBy = isLiked 
          ? p.liked_by?.filter(id => id !== currentUserId) 
          : [...(p.liked_by || []), currentUserId || ""];
        return { ...p, likes_count: newLikes, liked_by: newLikedBy };
      }
      return p;
    }));
    await toggleLiveFindLike(postId);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Remove this Live Find?")) return;
    const success = await deleteLiveFind(postId);
    if (success) setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleView = async (postId: string) => {
    await recordLiveFindView(postId);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCapturedImage(e.target.files[0]);
      setShowCreationModal(true);
    }
    // Reset the input value so the same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- MOBILE CAMERA FIX ---
  const handleAddClick = () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Directly trigger the native camera on mobile
      fileInputRef.current?.click();
    } else {
      // Use the webcam modal on desktop
      setShowCameraModal(true);
    }
  };

  if (loading) {
    return (
      <div className="mb-6">
        <div className="px-4 mb-3"><h3 className="text-[18px] font-bold text-black">Live Finds</h3></div>
        <div className="flex space-x-3 overflow-x-hidden px-4">
          {[1, 2, 3].map(i => <div key={i} className="w-[220px] h-72 bg-gray-200 rounded-xl animate-pulse shrink-0"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="px-4 mb-3 flex justify-between items-center">
        <h3 className="text-[18px] font-bold text-black">Live Finds</h3>
        <button onClick={handleAddClick} className="text-[#6200EE] p-1 transition-transform active:scale-95">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
        </button>
        {/* Hidden file input used for both mobile camera and desktop fallback */}
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
        />
      </div>

      {posts.length === 0 ? (
        <p className="px-4 text-xs text-gray-500">No active Live Finds nearby. Be the first to post!</p>
      ) : (
        <div className="flex space-x-3 overflow-x-auto no-scrollbar px-4 pb-2 items-stretch">
          {posts.map(post => (
            <LiveFindCard 
              key={post.id} 
              post={post} 
              currentUserId={currentUserId} 
              onLike={() => handleLike(post.id)}
              onDelete={() => handleDelete(post.id)}
              onShopClick={() => router.push(`/shop/${post.shop_id}`)}
              onView={() => handleView(post.id)}
            />
          ))}
        </div>
      )}

      {/* Desktop Webcam Modal */}
      {showCameraModal && (
        <CameraCaptureModal 
          onCapture={(file) => {
            setShowCameraModal(false);
            setCapturedImage(file);
            setShowCreationModal(true);
          }}
          onClose={() => setShowCameraModal(false)}
          fallbackToFile={() => {
            setShowCameraModal(false);
            fileInputRef.current?.click();
          }}
        />
      )}

      {/* Creation Modal */}
      {showCreationModal && capturedImage && (
        <LiveFindCreationModal 
          imageFile={capturedImage} 
          lat={lat} 
          lng={lng} 
          onClose={() => setShowCreationModal(false)} 
          onSuccess={() => {
            setShowCreationModal(false);
            setCapturedImage(null);
            fetchFeed(lat, lng);
          }} 
        />
      )}
    </div>
  );
}

// --- INNER COMPONENT: LiveFindCard ---
function LiveFindCard({ 
  post, currentUserId, onLike, onDelete, onShopClick, onView 
}: { 
  post: LiveFind, currentUserId: string | null, onLike: () => void, onDelete: () => void, onShopClick: () => void, onView: () => void 
}) {
  const [showMenu, setShowMenu] = useState(false);
  const isLiked = post.liked_by?.includes(currentUserId || "");
  
  useEffect(() => {
    onView();
  }, [post.id]);

  const level = post.user_level || 1;
  const levelName = post.user_level_name || "Explorer";
  const levelColor = LEVEL_COLORS[Math.min(level - 1, 4)];

  return (
    <div className="w-[220px] flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
      <div className="p-3 pb-1 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div 
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
            style={{ backgroundColor: ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6"][(post.user_name.charCodeAt(0) + post.user_name.length) % 5] }}
          >
            {post.user_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-[13px] font-bold text-gray-900 leading-tight truncate max-w-[120px]">{post.user_name}</p>
            <div className="flex items-center text-[10px] text-gray-500">
              {timeAgo(post.created_at)}
              <span className="text-gray-300 px-1">•</span>
              <div className="w-[5px] h-[5px] rounded-full mr-1" style={{ backgroundColor: levelColor }} />
              <span className="font-semibold tracking-wide" style={{ color: levelColor }}>{levelName}</span>
            </div>
          </div>
        </div>
        {post.is_own && (
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="text-gray-400 p-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-6 w-24 bg-white rounded shadow-lg border border-gray-100 z-10">
                <button onClick={onDelete} className="w-full text-left px-3 py-1.5 text-xs text-red-500 font-bold hover:bg-red-50">Remove</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-1.5 py-1">
        <div className="relative aspect-square rounded overflow-hidden" onClick={onShopClick}>
          <img src={post.image_url} alt="Live Find" className="w-full h-full object-cover cursor-pointer hover:opacity-95" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        </div>
      </div>

      <div className="p-3 pt-1 flex flex-col flex-grow">
        <p className="text-[13px] text-gray-500 mb-1">
          Found at <span className="text-[#6200EE] font-semibold cursor-pointer hover:underline" onClick={onShopClick}>{post.shop_name}</span>
        </p>
        <div className="h-[28px] overflow-hidden">
          {post.description && <p className="text-[12px] text-gray-800 leading-tight line-clamp-2">{post.description}</p>}
        </div>
        
        <div className="mt-auto pt-2 flex items-center space-x-1.5 cursor-pointer" onClick={onLike}>
          <svg className={`w-5 h-5 transition-transform ${isLiked ? 'text-red-500 scale-110' : 'text-gray-400'}`} fill={isLiked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className={`text-[12px] font-semibold ${isLiked ? 'text-red-500' : 'text-gray-500'}`}>{post.likes_count}</span>
        </div>
      </div>
    </div>
  );
}

// --- DESKTOP WEBCAM MODAL ---
function CameraCaptureModal({ onCapture, onClose, fallbackToFile }: { onCapture: (file: File) => void, onClose: () => void, fallbackToFile: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        activeStream = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err) {
        setError("Could not access camera.");
      }
    };
    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
          onCapture(file);
        }
      }, 'image/jpeg', 0.8);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col">
      <div className="p-4 flex justify-between items-center text-white bg-black/50 absolute top-0 w-full z-10">
        <button onClick={onClose} className="p-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        <span className="font-bold">Take Photo</span>
        <div className="w-10"></div>
      </div>
      
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error ? (
           <div className="text-white text-center p-6">
             <p className="mb-4">{error}</p>
             <button onClick={fallbackToFile} className="bg-white text-black px-4 py-2 rounded-lg font-bold">Open File Explorer</button>
           </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        )}
      </div>

      <div className="h-32 bg-black flex items-center justify-center pb-8">
        <button onClick={handleCapture} className="w-16 h-16 rounded-full border-4 border-white bg-white/20 active:bg-white/50 transition-colors"></button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// --- INNER COMPONENT: LiveFindCreationModal ---
function LiveFindCreationModal({ imageFile, lat, lng, onClose, onSuccess }: { imageFile: File, lat: number, lng: number, onClose: () => void, onSuccess: () => void }) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [description, setDescription] = useState("");
  const [expiry, setExpiry] = useState(24);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    getNearbyShops(lat, lng).then(res => {
      if (res && res.shops) setShops(res.shops);
      setLoadingShops(false);
    }).catch(() => setLoadingShops(false));
  }, [lat, lng]);

  const handleSubmit = async () => {
    if (!selectedShopId) return alert("Please select a shop");
    setIsSubmitting(true);
    const res = await createLiveFind(imageFile, selectedShopId, null, description || null, expiry, lat, lng);
    setIsSubmitting(false);
    if (res) {
      onSuccess();
    } else {
      alert("Failed to post Live Find");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-[24px] sm:rounded-[24px] p-6 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-black">New Live Find</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-1"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>
        
        <div className="overflow-y-auto space-y-4 pb-4 no-scrollbar">
          {imageUrl && <img src={imageUrl} alt="Preview" className="w-full h-48 object-cover rounded-xl bg-gray-100" />}
          
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Shop</label>
            <select 
              value={selectedShopId} 
              onChange={e => setSelectedShopId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none bg-white focus:border-[#6200EE] transition-colors"
            >
              <option value="" disabled>Select a nearby shop</option>
              {loadingShops ? (
                <option disabled>Finding shops...</option>
              ) : (
                shops.map(s => (
                  <option key={s._id} value={s._id}>
                    {s.name} {s.distance !== undefined ? (s.distance < 1 ? `(${(s.distance * 1000).toFixed(0)}m)` : `(${s.distance.toFixed(1)}km)`) : ""}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="What did you find?"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none resize-none focus:border-[#6200EE] transition-colors"
              rows={2}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-2 block">Expires in:</label>
            <div className="flex space-x-2">
              {[1, 3, 6, 12, 24].map(h => (
                <button 
                  key={h} 
                  onClick={() => setExpiry(h)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${expiry === h ? 'bg-[#6200EE]/10 border-[#6200EE] text-[#6200EE] font-bold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <button 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          className="w-full py-3.5 bg-[#6200EE] text-white rounded-xl font-bold text-[15px] flex justify-center items-center mt-2 transition-transform active:scale-[0.98] disabled:opacity-75"
        >
          {isSubmitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Post"}
        </button>
      </div>
    </div>
  );
}