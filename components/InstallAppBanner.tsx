"use client";

import { useEffect, useState } from "react";

// After the customer taps X, show the banner again after this many hours.
// Set to 0 to show it on every page load (X then hides it only until refresh).
const SHOW_AGAIN_AFTER_HOURS = 24;

// Set to false to see the banner on desktop while testing.
const ANDROID_ONLY = true;

export default function InstallAppBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (ANDROID_ONLY && !/Android/i.test(navigator.userAgent)) return;

    let closedAt = 0;
    try {
      closedAt = parseInt(localStorage.getItem("install_banner_closed_at") || "0", 10) || 0;
    } catch (e) {}

    const hoursPassed = (Date.now() - closedAt) / (1000 * 60 * 60);
    if (!closedAt || hoursPassed >= SHOW_AGAIN_AFTER_HOURS) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="w-full bg-[#6200EE] text-white px-4 py-2.5 flex items-center justify-between">
      <p className="text-[13px] font-medium pr-3">
        Get the AV app for a better experience
      </p>
      <div className="flex items-center space-x-3 shrink-0">
        <a
          href="https://play.google.com/store/apps/details?id=com.av.projectav"
          className="bg-white text-[#6200EE] text-[12px] font-bold px-3 py-1.5 rounded-[8px]"
        >
          Install
        </a>
        <button
          onClick={() => {
            try {
              localStorage.setItem("install_banner_closed_at", String(Date.now()));
            } catch (e) {}
            setShow(false);
          }}
          className="text-white text-[18px] leading-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}