"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserRoleFromToken } from "../lib/api";

export default function BottomNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(getUserRoleFromToken());
  }, []);

  if (!role || pathname.includes("/login") || pathname.includes("/signup")) return null;

  const isCustomer = role === "customer";
  const isOwner = role === "owner";

  const homePath = isOwner ? "/owner" : "/";
  const items = [
    { name: "Home", path: homePath, icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  ];

  if (isOwner) {
    items.push({ name: "Shops", path: "/shops", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" });
    items.push({ name: "My Shop", path: "/myshop", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" });
  } else if (isCustomer) {
    items.push({ name: "Shops", path: "/shops", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" });
    items.push({ name: "Cart", path: "/cart", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" });
  }

  return (
    <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center h-16 z-50 pb-safe">
      {items.map((item) => {
        const isActive = pathname === item.path;
        return (
          <Link key={item.name} href={item.path} className="flex flex-col items-center justify-center w-full h-full space-y-1">
            <svg className={`w-6 h-6 ${isActive ? 'text-avPrimary' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
            </svg>
            <span className={`text-[10px] font-medium ${isActive ? 'text-avPrimary font-bold' : 'text-gray-500'}`}>
              {item.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}