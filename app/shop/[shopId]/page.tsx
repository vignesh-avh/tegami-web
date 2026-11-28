export const dynamic = 'force-dynamic';
import { Suspense } from "react";
import ShopDetailsClient from "./ShopDetailsClient";

// Fetch shop data for server-side rendering (SEO)
async function getShopData(shopId: string) {
  try {
    const res = await fetch(`https://api.avapp.in/public/shops/${shopId}`, {
      next: { revalidate: 3600 } // Revalidate every hour
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

export default async function ShopDetailsPage({ params }: { params: Promise<{ shopId: string }> }) {
  const awaitedParams = await params;
  const shopData = await getShopData(awaitedParams.shopId);
  const shop = shopData?.shop;

  return (
    <main>
      {shop && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "name": shop.name,
              "description": shop.description,
              "telephone": shop.mobile_number,
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Boduppal",
                "addressRegion": "Hyderabad",
                "addressCountry": "IN"
              },
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": shop.latitude,
                "longitude": shop.longitude
              },
              "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "Products",
                "itemListElement": (shop.products || []).slice(0, 50).map((p: any) => ({
                  "@type": "Product",
                  "name": (p as any).product_name || p.name,
                  "image": p.imageUrl,
                  "offers": {
                    "@type": "Offer",
                    "price": p.isOnSale ? (p.salePrice || p.price) : p.price,
                    "priceCurrency": "INR",
                    "availability": p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
                  }
                }))
              }
            })
          }}
        />
      )}
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
          <div className="w-10 h-10 border-4 border-[#6200EE] border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        {shop ? (
          <ShopDetailsClient initialShop={shop} shopId={awaitedParams.shopId} />
        ) : (
          <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F5]">
            <p className="text-gray-500 mb-4">Couldn't load this shop.</p>
            <a href="." className="text-[#6200EE] font-bold hover:underline">Try again</a>
          </div>
        )}
      </Suspense>
    </main>
  );
}
