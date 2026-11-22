"use client";

import { HomeProduct } from "../lib/types";
import { getSaleTimeDetails } from "../lib/utils";
import Link from "next/link";
import { useState, useEffect } from "react";

interface ProductCardProps {
  product: HomeProduct;
  sectionType: "DEALS" | "TRENDING" | "BEST_PRICE" | "DISTANCE";
}

export default function ProductCard({ product, sectionType }: ProductCardProps) {
  const priceText = product.isOnSale && product.salePrice ? `₹${product.salePrice.toFixed(0)}` : `₹${product.price.toFixed(0)}`;
  const originalPriceText = `₹${product.price.toFixed(0)}`;
  const distanceTextRaw = product.distance !== undefined ? (product.distance < 1 ? `${(product.distance * 1000).toFixed(0)} mts` : `${product.distance.toFixed(1)} km`) : "";
  const viewsCount = 5 + (product.sold_count || 0);

  return (
    <Link href={`/shop/${product.shop_id}`} className="block w-[180px] flex-shrink-0">
      <div className="bg-white rounded-[20px] shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full transition-transform active:scale-[0.98]">
        {/* Larger Image Area */}
        <div className="h-[170px] bg-white relative p-2 flex justify-center items-center">
           <img src={product.imageUrl} alt={product.product_name} className="object-contain w-full h-full" />
           <div className="absolute top-3 right-3 bg-[#06B6D4] rounded-full px-2.5 py-1 text-[11px] font-bold text-black shadow-sm">
             +3 coins
           </div>
        </div>
        
        <div className="w-full h-px bg-gray-100"></div>
        
        {/* Spacious Content Area */}
        <div className="p-3.5 flex flex-col flex-grow">
          <p className="text-[14px] font-semibold text-[#111827] truncate leading-tight">
            {product.product_name}
          </p>
          
          <div className="flex items-center flex-wrap gap-x-1.5 mt-1.5">
             <span className={`${sectionType === "BEST_PRICE" ? "text-[17px] font-extrabold text-[#6200EE]" : "text-[14px] font-bold text-[#111827]"}`}>
               {priceText}
             </span>
             
             {sectionType === "DEALS" && product.isOnSale && product.salePrice && product.price > product.salePrice && (
                <span className="text-[12px] text-gray-400 line-through truncate">{originalPriceText}</span>
             )}
             
             {sectionType === "BEST_PRICE" && product.discountPercentage && product.discountPercentage > 0 && (
                <span className="text-[12px] font-bold text-[#6200EE] ml-1">{product.discountPercentage}% off</span>
             )}
             
             {sectionType === "DEALS" && <SaleTimerText endDateStr={product.saleEndDate} />}
          </div>

          {sectionType === "DEALS" && product.saleDescription && (
             <p className="text-[12px] font-bold text-[#6200EE] line-clamp-2 leading-tight mt-1.5">{product.saleDescription}</p>
          )}

          {sectionType === "TRENDING" && (
             <div className="flex items-center text-[#6200EE] mt-1.5">
                <svg className="w-[13px] h-[13px] mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                <span className="text-[12px] font-bold">{viewsCount} views</span>
             </div>
          )}

          <div className="mt-auto pt-3 w-full min-w-0">
            <div className={`flex items-center w-full min-w-0 ${sectionType === "DISTANCE" ? 'text-black font-semibold' : 'text-gray-500 font-normal'}`}>
              <span className="truncate flex-1 min-w-0 mr-1" style={{ fontSize: sectionType === "DISTANCE" ? "13px" : "11px" }}>
                {product.shop_name}
              </span>
              {distanceTextRaw && (
                <div className="flex items-center shrink-0">
                  <svg className="mr-0.5 opacity-70" style={{ width: sectionType === "DISTANCE" ? "13px" : "11px", height: sectionType === "DISTANCE" ? "13px" : "11px" }} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                  <span className="whitespace-nowrap" style={{ fontSize: sectionType === "DISTANCE" ? "13px" : "11px" }}>{distanceTextRaw}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SaleTimerText({ endDateStr }: { endDateStr?: string }) {
  const [tick, setTick] = useState(0); 
  
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const timeRes = getSaleTimeDetails(endDateStr);
  if (!timeRes.text || timeRes.text === "Expired") return null;

  const timeColorClass = timeRes.isLessThanOneHour ? "text-red-500" : timeRes.isLessThan24Hours ? "text-orange-500" : "text-gray-500";

  return (
    <span className={`text-[11px] font-semibold whitespace-nowrap ${timeColorClass}`}>
      ⏱️ {timeRes.text}
    </span>
  );
}