"use client";

import { useRouter } from "next/navigation";
import { clearToken, getUserRoleFromToken } from "../lib/api";
import { useEffect, useState } from "react";

export default function ProfileSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const role = getUserRoleFromToken() || "customer";
      setUser({ 
        name: role === "owner" ? "Shop Owner" : "Customer", 
        email: role === "owner" ? "owner@tegami.com" : "customer@tegami.com", 
        role 
      });
    }
  }, [isOpen]);

  const handleLogout = () => {
    clearToken();
    onClose();
    // FORCE HARD RELOAD to /welcome
    window.location.href = "/welcome";
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] transition-opacity" onClick={onClose} />
      )}

      <div className={`fixed top-0 left-0 h-full w-[80%] max-w-[320px] bg-[#F9FAFB] z-[101] transform transition-transform duration-300 ease-in-out rounded-r-3xl shadow-2xl flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="p-6 flex items-center space-x-4">
          <div className="w-16 h-16 bg-avPrimary/10 rounded-full flex items-center justify-center">
            <svg className="w-9 h-9 text-avPrimary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div className="flex-1 overflow-hidden">
            <h2 className="text-xl font-extrabold text-gray-900 truncate">{user?.name}</h2>
            <p className="text-sm text-gray-500 truncate">{user?.email}</p>
            {user?.role && (
              <span className="inline-block mt-1 bg-avSecondary text-black text-[10px] font-black tracking-widest px-2 py-0.5 rounded-full">
                {user.role.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="w-full h-[1px] bg-gray-200"></div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <button className="w-full bg-white border border-gray-200 rounded-xl p-3 flex items-center shadow-sm">
             <svg className="w-5 h-5 text-gray-700 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
             <span className="text-sm font-semibold text-gray-700 flex-1 text-left">Profile Settings</span>
          </button>
        </div>

        <div className="p-6 border-t border-gray-200">
          <button onClick={handleLogout} className="w-full flex items-center p-2 text-red-500 font-bold">
            <svg className="w-6 h-6 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            <span className="text-base">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}