"use client";

import { useRouter } from "next/navigation";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2C4AFF] to-[#001540] flex flex-col relative text-white">
      
      {/* TOP RIGHT GUEST BUTTON */}
      <div className="absolute top-8 right-6 z-50">
        <button 
          onClick={() => router.push("/")}
          className="bg-white/10 hover:bg-white/20 border border-white/30 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
        >
          Guest
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center mt-10">
        {/* LOGO PLACEHOLDER */}
        <div className="w-24 h-24 bg-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-lg border border-white/20">
          <span className="text-4xl font-bold">T</span>
        </div>

        <h1 className="text-4xl font-bold mb-3 tracking-tight">Tegami</h1>
        <p className="text-white/80 text-base font-medium">
          Know what's nearby before you go.
        </p>
      </div>

      <div className="px-8 pb-16 space-y-6 w-full max-w-md mx-auto">
        <button 
          onClick={() => router.push("/login")}
          className="w-full bg-white text-[#2C4AFF] font-bold text-lg py-4 rounded-2xl shadow-lg hover:bg-gray-50 transition-all"
        >
          Continue as Customer
        </button>

        <div className="text-center space-y-1">
          <p className="text-white/70 text-sm">Own or manage a shop?</p>
          <button 
            onClick={() => router.push("/owner/login")}
            className="text-white font-semibold text-base underline underline-offset-4 decoration-white/30 hover:decoration-white transition-all"
          >
            Manage My Shop
          </button>
        </div>
      </div>
    </div>
  );
}