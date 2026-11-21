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
  const [saleTime, setSaleTime] = useState({ text: "", isUrgent: false });

  useEffect(() => {
    if (sectionType === "DEALS" && product.saleEndDate) {
      const updateTime = () => {
        const details = getSaleTimeDetails(product.saleEndDate);
        if (details.text && details.text !== "Expired") {
          setSaleTime({ text: details.text, isUrgent: details.isLessThanOneHour });
        }
      };
      updateTime();
      const interval = setInterval(updateTime, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [product.saleEndDate, sectionType]);

  const priceText = product.isOnSale && product.salePrice ? `₹${product.salePrice.toFixed(0)}` : `₹${product.price.toFixed(0)}`;
  const distanceText = product.distance 
    ? product.distance < 1.0 
      ? `${(product.distance * 1000).toFixed(0)} mts` 
      : `${product.distance.toFixed(1)} km`
    : "";
  const viewsCount = 5 + (product.sold_count || 0);

  return (
    <Link href={`/shop/${product.shop_id}`} className="block w-40 flex-shrink-0">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
        {/* IMAGE AREA */}
        <div className="h-36 bg-white relative p-2 flex justify-center items-center">
          <img src={product.imageUrl} alt={product.product_name} className="object-contain w-full h-full" />
          
          {/* +3 Coins Badge */}
          <div className="absolute top-2 right-2 bg-avSecondary rounded-full px-2 py-0.5 text-[9px] font-bold text-black shadow-sm">
            +3 coins
          </div>

          {/* SALE Badge */}
          {product.isOnSale && (
            <div className="absolute top-0 left-0 bg-[#D32F2F] text-white text-[9px] font-bold px-2 py-0.5 rounded-br-lg">
              SALE
            </div>
          )}
        </div>

        <div className="w-full h-[1px] bg-gray-100"></div>

        {/* DETAILS AREA */}
        <div className="p-3 flex flex-col flex-grow">
          <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
            {product.product_name}
          </p>

          {/* PRICE ROW */}
          <div className="flex items-center mt-1 space-x-1 flex-wrap">
            <span className={`text-[13px] ${sectionType === "BEST_PRICE" ? "text-avPrimary font-extrabold text-[16px]" : "font-medium text-gray-900"}`}>
              {priceText}
            </span>
            
            {sectionType === "DEALS" && product.isOnSale && product.salePrice && product.price > product.salePrice && (
              <span className="text-[11px] text-gray-400 line-through">
                ₹{product.price.toFixed(0)}
              </span>
            )}

            {sectionType === "BEST_PRICE" && product.discountPercentage && product.discountPercentage > 0 && (
              <span className="text-[11px] font-bold text-avPrimary ml-1">
                {product.discountPercentage}% off
              </span>
            )}

            {sectionType === "DEALS" && saleTime.text && (
              <span className={`text-[10px] font-semibold ml-1 ${saleTime.isUrgent ? 'text-red-500' : 'text-gray-500'}`}>
                ⏱️ {saleTime.text}
              </span>
            )}
          </div>

          {/* DESCRIPTION / METRICS */}
          {sectionType === "DEALS" && product.saleDescription && (
            <p className="text-[10px] font-bold text-avPrimary mt-1 truncate">
              {product.saleDescription}
            </p>
          )}

          {sectionType === "TRENDING" && (
            <div className="flex items-center mt-1">
              <svg className="w-3 h-3 text-avPrimary mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
              <span className="text-[11px] font-bold text-avPrimary">{viewsCount} views</span>
            </div>
          )}

          {/* SHOP NAME & DISTANCE */}
          <div className="mt-auto pt-2 flex items-center justify-between text-[10px] text-gray-500 truncate">
            <span className="truncate flex-1">{product.shop_name}</span>
            {distanceText && (
              <span className="flex items-center ml-1 whitespace-nowrap">
                <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                {distanceText}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}