"use client";

import { useState } from "react";
import { LevelInfo } from "../lib/types";

const LEVEL_COLORS = ["#059669", "#0284C7", "#7C3AED", "#EA580C", "#CA8A04"];
const LEVEL_NAMES = ["Explorer", "Local Finder", "Local Insider", "Trusted Finder", "Local Icon"];

export default function UserLevelProgressBar({ levelInfo }: { levelInfo: LevelInfo | null }) {
  const level = levelInfo?.level || 1;
  const levelName = levelInfo?.level_name || "Explorer";
  const progress = Math.min(Math.max(levelInfo?.progress || 0, 0), 1);
  const [showInfo, setShowInfo] = useState(false);

  const levelColor = LEVEL_COLORS[Math.min(level - 1, 4)];

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm p-4 w-full">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: levelColor }} />
            <div>
              <p className="text-[9px] font-bold text-gray-400 tracking-wider">YOUR STANDING</p>
              <p className="text-[14px] font-bold text-gray-800 leading-tight">{levelName}</p>
            </div>
            <button onClick={() => setShowInfo(true)} className="ml-2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </button>
          </div>
          {level < 5 ? (
            <p className="text-[11px] text-gray-500 font-medium">Next: {LEVEL_NAMES[level]}</p>
          ) : (
            <p className="text-[11px] font-bold" style={{ color: levelColor }}>Top standing</p>
          )}
        </div>

        <div className="relative w-full h-2.5 mt-4 mb-2">
          <div className="flex w-full h-full rounded-full overflow-hidden space-x-0.5">
            {LEVEL_COLORS.map((c, i) => (
              <div key={i} className="flex-1 h-full" style={{ backgroundColor: c, opacity: i < level ? 1 : 0.45 }} />
            ))}
          </div>
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 shadow-sm transition-all duration-300"
            style={{ 
              left: `calc(${progress * 100}% - ${progress * 16}px)`,
              borderColor: levelColor 
            }}
          />
        </div>

        <div className="flex justify-between text-[9px] text-gray-500 mt-1">
          <span>Explorer</span>
          <span>Local Icon</span>
        </div>
      </div>

      {showInfo && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-2">How your standing works</h3>
            <p className="text-[13px] text-gray-600 mb-4 leading-relaxed">
              Your standing reflects how much your Live Finds are seen and liked by others. Each tier unlocks once you meet ANY 2 of its 3 targets below.
            </p>
            <div className="space-y-2 mb-4">
              {[
                { n: 1, name: "Explorer", req: "2 posts · 10 views · 2 likes" },
                { n: 2, name: "Local Finder", req: "5 posts · 30 views · 5 likes" },
                { n: 3, name: "Local Insider", req: "10 posts · 75 views · 15 likes" },
                { n: 4, name: "Trusted Finder", req: "15 posts · 200 views · 40 likes" },
                { n: 5, name: "Local Icon", req: "30 posts · 500 views · 100 likes" },
              ].map(l => (
                <div key={l.n} className="flex items-center justify-between text-xs">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: LEVEL_COLORS[l.n - 1] }} />
                    <span className="font-semibold text-gray-800">{l.name}</span>
                  </div>
                  <span className="text-gray-500 text-[10px]">{l.req}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mb-4">Views only count once per unique viewer, so genuine reach moves you forward.</p>
            <button onClick={() => setShowInfo(false)} className="w-full py-2.5 bg-avPrimary text-white rounded-xl font-bold">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}