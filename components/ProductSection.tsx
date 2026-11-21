"use client";

import { HomeProduct } from "../lib/types";
import ProductCard from "./ProductCard";
import Link from "next/link";

interface ProductSectionProps {
  title: string;
  description: string;
  products: HomeProduct[];
  sectionType: "DEALS" | "TRENDING" | "BEST_PRICE" | "DISTANCE";
  seeAllLink: string;
}

export default function ProductSection({ title, description, products, sectionType, seeAllLink }: ProductSectionProps) {
  if (products.length === 0) return null; // Hide section if empty

  return (
    <div className="mb-6">
      <div className="flex justify-between items-end px-4 mb-3">
        <div>
          <h3 className="text-[18px] font-bold text-black">{title}</h3>
          <p className="text-[12px] text-gray-500">{description}</p>
        </div>
        <Link href={seeAllLink} className="text-[12px] font-semibold text-avPrimary mb-1">
          See All
        </Link>
      </div>
      
      <div className="flex space-x-3 overflow-x-auto no-scrollbar px-4 pb-2">
        {products.map(p => (
          <ProductCard key={p._id} product={p} sectionType={sectionType} />
        ))}
      </div>
    </div>
  );
}