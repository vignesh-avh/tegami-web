"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function WelcomeScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  // Mimicking Android's LaunchedEffect for AnimatedVisibility
  useEffect(() => {
    setVisible(true);
  }, []);

  return (
    <div className="h-[100dvh] w-full bg-gradient-to-b from-[#2C4AFF] to-[#001540] flex justify-center overflow-hidden font-sans">
      
      {/* MAIN CONTAINER - Centers everything on desktop, fits perfectly on mobile */}
      <div className="w-full max-w-md h-full flex flex-col px-8 py-10 relative text-white">
        
        {/* TOP RIGHT GUEST BUTTON - Kept inside the container so it aligns perfectly on desktop */}
        <div className="absolute top-8 right-8 z-50">
          <button 
            onClick={() => router.push("/")}
            className="bg-white/10 hover:bg-white/20 border border-white/30 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
          >
            Guest
          </button>
        </div>

        {/* TOP SPACER (Pushes logo to the perfect vertical center) */}
        <div className="flex-1" />

        {/* LOGO, TITLE & SUBTITLE */}
        <div 
          className={`flex flex-col items-center transition-all duration-1000 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          {/* Logo Placeholder matching 100dp size */}
          <div className="w-[100px] h-[100px] bg-white/10 rounded-2xl flex items-center justify-center shadow-lg border border-white/20">
            <span className="text-5xl font-bold">T</span>
          </div>

          {/* Tighter spacing keeps symbol and name visually connected (18dp) */}
          <div className="h-[18px]" />

          <h1 className="text-[30px] font-bold tracking-tight text-center">
            Tegami
          </h1>

          {/* Spacer 10dp */}
          <div className="h-[10px]" />

          <p className="text-base text-white/80 text-center font-normal">
            Know what's nearby before you go.
          </p>
        </div>

        {/* BOTTOM SPACER (Pushes buttons to the bottom area) */}
        <div className="flex-1" />

        {/* BUTTONS SECTION */}
        <div 
          className={`flex flex-col items-center w-full pb-4 transition-all duration-1000 ease-out delay-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          {/* Primary Path: Customer Button (Thicker, highly clickable, matching Android padding) */}
          <button 
            onClick={() => router.push("/signup")}
            className="w-full min-h-[60px] bg-white text-[#2C4AFF] font-semibold text-[16px] py-4 rounded-[16px] shadow-lg hover:bg-gray-50 transition-all active:scale-[0.98] flex items-center justify-center"
          >
            Continue as Customer
          </button>

          {/* Spacer 28dp */}
          <div className="h-[28px]" />

          {/* Secondary Path: Shop Owner */}
          <div className="flex flex-col items-center text-center">
            <p className="text-white/70 text-sm">
              Own or manage a shop?
            </p>
            
            {/* Spacer 4dp */}
            <div className="h-[4px]" />
            
            <button 
              onClick={() => router.push("/owner/signup")}
              className="text-white font-semibold text-[15px] underline underline-offset-4 decoration-white/30 hover:decoration-white transition-all px-3 py-2"
            >
              Manage My Shop
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}