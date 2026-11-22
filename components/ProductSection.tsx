"use client";

import { HomeProduct } from "../lib/types";
import ProductCard from "./ProductCard";
import Link from "next/link";
import { useState, useRef } from "react";

interface ProductSectionProps {
  title: string;
  description: string;
  products: HomeProduct[];
  sectionType: "DEALS" | "TRENDING" | "BEST_PRICE" | "DISTANCE";
  seeAllLink: string;
  isLoading?: boolean;
  isPaginating?: boolean;
  onLoadMore?: () => void;
  viewsResetDate?: string | null;
}

export default function ProductSection({ 
  title, description, products, sectionType, seeAllLink, 
  isLoading = false, isPaginating = false, onLoadMore, viewsResetDate 
}: ProductSectionProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollWidth - target.scrollLeft - target.clientWidth < 100 && !isPaginating && !isLoading) {
      onLoadMore?.();
    }
  };

  if (!isLoading && products.length === 0 && (sectionType === "DEALS" || sectionType === "DISTANCE")) {
    return null;
  }

  return (
    <div className="mb-5">
      {/* HEADER */}
      <div className="flex justify-between items-end px-4 mb-2">
        <div>
          <div className="flex items-center space-x-1">
            <h3 className="text-[18px] font-bold text-black leading-tight">{title}</h3>
            {sectionType === "TRENDING" && (
              <div className="relative flex items-center pb-1">
                <button 
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </button>
                {showTooltip && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-800 text-white text-[11px] leading-tight p-2 rounded-lg shadow-lg z-50 text-center">
                    {viewsResetDate ? `Views are updated periodically.\nLast reset: ${viewsResetDate}` : "Views are refreshed every two months to reflect recent activity."}
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-[12px] text-gray-500 mt-0.5">{description}</p>
        </div>
        <Link href={seeAllLink} className="text-[12px] font-semibold text-[#6200EE] mb-1">
          See All
        </Link>
      </div>
      
      {/* CONTENT */}
      {isLoading ? (
        <div className="flex space-x-3 overflow-x-hidden px-4 pb-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-[160px] flex-shrink-0 animate-pulse">
              <div className="bg-gray-200 h-[150px] rounded-[16px] mb-2"></div>
              <div className="bg-gray-200 h-4 w-3/4 rounded mb-1"></div>
              <div className="bg-gray-200 h-3 w-1/2 rounded"></div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        // Compact Empty State (Matching Android)
        <div className="mx-4 bg-white rounded-[16px] border border-gray-100 p-4 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-[#6200EE]" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/></svg>
          </div>
          <div>
            <h4 className="text-[14px] font-bold text-black leading-tight">Curating fresh inventory</h4>
            <p className="text-[12px] text-gray-500 leading-tight mt-0.5">Local shops are updating their catalogs. Top picks will appear here shortly.</p>
          </div>
        </div>
      ) : (
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex space-x-3 overflow-x-auto no-scrollbar px-4 pb-2"
        >
          {products.map(p => (
            <ProductCard key={p._id} product={p} sectionType={sectionType} />
          ))}
          {isPaginating && (
            <div className="w-16 flex-shrink-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#6200EE] border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}