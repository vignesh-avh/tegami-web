"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUserIdFromToken } from "../../lib/api";
import { 
  getOwnerProducts, deleteProduct, updateProduct, updateStock, 
  setPromotion, removePromotion, getStoreDescription, saveStoreDescription 
} from "../../lib/api";
import { Product } from "../../lib/types";
import BottomNav from "../../components/BottomNav";

// Helper functions translated from Kotlin
const isSaleActive = (dateStr?: string) => {
  if (!dateStr) return false;
  try { return new Date(dateStr) > new Date(); } catch { return false; }
};

const getUpdatedLabel = (dateStr?: string) => {
  if (!dateStr) return "";
  try {
    const diff = new Date().getTime() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days <= 0) return " · updated today";
    if (days === 1) return " · updated yesterday";
    return ` · updated ${days} days ago`;
  } catch { return ""; }
};

function MyShopContent() {
  const router = useRouter();
  const userId = getUserIdFromToken();
  const searchParams = useSearchParams();
  const initialSection = searchParams.get("section") || "in_stock";

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [currentSection, setCurrentSection] = useState(initialSection);

  // FIX: Listen for URL changes so clicking dashboard metrics updates the tab
  useEffect(() => {
    const sectionParam = searchParams.get("section");
    if (sectionParam && sectionParam !== currentSection) {
      setCurrentSection(sectionParam);
    }
  }, [searchParams]);

  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Highlight state for recently updated products
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Editing state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", price: "", unit: "", category: "" });

  // Modal states
  const [productToPromote, setProductToPromote] = useState<Product | null>(null);
  const [promoForm, setPromoForm] = useState({ salePrice: "", saleDescription: "", durationDays: "7" });
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  
  // Image Zoom State
  const [zoomGallery, setZoomGallery] = useState<{ images: string[], index: number } | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });
  const touchStartX = useRef<number | null>(null);
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartScale = useRef<number>(1);
  const panStart = useRef<{ x: number, y: number } | null>(null);
  const panStartPos = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const lastTap = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const clampScale = (s: number) => Math.max(1, Math.min(4, s));

  // Mirror of zoom state in a ref so native wheel handler always reads fresh values
  const zoomStateRef = useRef({ scale: 1, pos: { x: 0, y: 0 } });
  useEffect(() => {
    zoomStateRef.current = { scale: zoomScale, pos: zoomPos };
  }, [zoomScale, zoomPos]);

  // Native (non-passive) wheel listener — React's onWheel is passive, so
  // e.preventDefault() inside it does NOT work. Attach directly on the element.
  useEffect(() => {
    if (!zoomGallery) return;
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const { scale, pos } = zoomStateRef.current;
      const delta = e.deltaY > 0 ? -0.25 : 0.25;
      const newScale = Math.max(1, Math.min(4, scale + delta));
      if (newScale === scale) return;
      if (newScale === 1) {
        setZoomScale(1); setZoomPos({ x: 0, y: 0 });
      } else {
        const r = newScale / scale;
        setZoomPos({ x: cx * (1 - r) + pos.x * r, y: cy * (1 - r) + pos.y * r });
        setZoomScale(newScale);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomGallery]);

  // Store Description State
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false);
  const [storeDescription, setStoreDescription] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [initialPhone, setInitialPhone] = useState("");
  const [isSavingDesc, setIsSavingDesc] = useState(false);
  const [phoneError, setPhoneError] = useState(false);

  // Camera Consent State
  const [showCameraConsentDialog, setShowCameraConsentDialog] = useState(false);
  const [cameraConsentGiven, setCameraConsentGiven] = useState(false);

  // 1. Initial Load
  useEffect(() => {
    if (!userId) {
      router.push("/login");
      return;
    }
    fetchProducts();
    loadStoreDesc();
    
    // Check local storage for camera consent
    const consent = localStorage.getItem(`camera_consent_${userId}`);
    if (consent === "true") setCameraConsentGiven(true);
  }, [userId, router]);

  const fetchProducts = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const res = await getOwnerProducts(userId);
      
      const mappedProducts = (res.products || []).map((p: any) => ({
        ...p,
        id: p._id || p.id || p.product_id,
        name: p.product_name || p.name || "Unknown Product",
        price: p.price || 0,
        unit: p.unit || "per_piece",
        category: p.category || "Others",
        inStock: p.inStock ?? true,
        imageUrl: p.imageUrl || (p.images && p.images.length > 0 ? p.images[0] : ""),
      }));

      setAllProducts(mappedProducts);
      setError(null);
    } catch (err) {
      setError("Failed to load products.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadStoreDesc = async () => {
    const res = await getStoreDescription();
    if (res) {
      setStoreDescription(res.description || "");
      setOwnerPhone(res.phone || "");
      setInitialPhone(res.phone || "");
    }
  };

  // 2. Filtering Logic
  useEffect(() => {
    let result = allProducts;
    const query = searchQuery.toLowerCase();

    if (query) {
      result = result.filter(p => p.name.toLowerCase().includes(query));
    }

    result = result.filter(p => {
      const isCurrentlyOnSale = p.isOnSale === true && isSaleActive(p.saleEndDate);
      if (currentSection === "in_stock") return p.inStock && !isCurrentlyOnSale;
      if (currentSection === "no_stock") return !p.inStock && !isCurrentlyOnSale;
      if (currentSection === "promotion") return isCurrentlyOnSale;
      return true;
    });

    setFilteredProducts(result);
  }, [allProducts, currentSection, searchQuery]);

  // 3. Handlers
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) return;
    
    const match = allProducts.find(p => p.name.toLowerCase().includes(val.toLowerCase()));
    if (match) {
      const isCurrentlyOnSale = match.isOnSale === true && isSaleActive(match.saleEndDate);
      if (isCurrentlyOnSale) setCurrentSection("promotion");
      else if (match.inStock) setCurrentSection("in_stock");
      else setCurrentSection("no_stock");
    }
  };

  const triggerHighlight = (id: string) => {
    setRecentlyUpdated(prev => new Set(prev).add(id));
    setTimeout(() => {
      setRecentlyUpdated(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2000);
  };

  const handleDelete = async () => {
    if (!productToDelete || !productToDelete.id) return;
    const original = [...allProducts];
    const idToDelete = productToDelete.id;
    
    setAllProducts(prev => prev.filter(p => p.id !== idToDelete));
    setProductToDelete(null);

    const success = await deleteProduct(idToDelete);
    if (!success) {
      setAllProducts(original);
      alert("Failed to delete product");
    }
  };

  const handleEditSubmit = async () => {
    if (!editingProductId) return;
    const original = [...allProducts];
    const idToUpdate = editingProductId;
    
    setAllProducts(prev => prev.map(p => 
      p.id === idToUpdate ? { ...p, name: editForm.name, price: parseFloat(editForm.price) || 0, unit: editForm.unit, category: editForm.category, last_updated: new Date().toISOString() } : p
    ));
    setEditingProductId(null);
    triggerHighlight(idToUpdate);

    const success = await updateProduct(idToUpdate, {
      product_name: editForm.name,
      price: parseFloat(editForm.price) || 0,
      unit: editForm.unit,
      category: editForm.category
    });

    if (!success) {
      setAllProducts(original);
      alert("Failed to update product");
    }
  };

  const handleToggleStock = async (product: Product) => {
    if (!product.id) return;
    const newStatus = !product.inStock;
    const original = [...allProducts];
    const idToUpdate = product.id;

    setAllProducts(prev => prev.map(p => p.id === idToUpdate ? { ...p, inStock: newStatus, last_updated: new Date().toISOString() } : p));
    triggerHighlight(idToUpdate);

    const success = await updateStock(idToUpdate, newStatus);
    if (!success) {
      setAllProducts(original);
      alert("Failed to update stock");
    }
  };

  const handlePromotionSubmit = async () => {
    if (!productToPromote || !productToPromote.id) return;
    const salePrice = parseFloat(promoForm.salePrice);
    if (isNaN(salePrice) || salePrice <= 0 || salePrice >= productToPromote.price) {
      alert("Sale price must be valid and less than original price");
      return;
    }

    const success = await setPromotion(productToPromote.id, {
      salePrice,
      saleDescription: promoForm.saleDescription,
      durationDays: parseInt(promoForm.durationDays) || 7
    });

    if (success) {
      setProductToPromote(null);
      fetchProducts(); 
    } else {
      alert("Failed to set promotion");
    }
  };

  const handleRemovePromotion = async () => {
    if (!productToPromote || !productToPromote.id) return;
    const success = await removePromotion(productToPromote.id);
    if (success) {
      setProductToPromote(null);
      fetchProducts();
    } else {
      alert("Failed to remove promotion");
    }
  };

  const handleSaveDesc = async () => {
    const digits = ownerPhone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 12) {
      setPhoneError(true);
      return;
    }
    setPhoneError(false);
    setIsSavingDesc(true);
    
    const phoneToSend = digits !== initialPhone ? digits : undefined;
    const success = await saveStoreDescription({ description: storeDescription, phone: phoneToSend });
    
    setIsSavingDesc(false);
    if (success) {
      setShowDescriptionDialog(false);
      if (phoneToSend) setInitialPhone(phoneToSend);
    } else {
      alert("Failed to save description");
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice typing is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setStoreDescription(prev => (prev + " " + speechToText).trim().slice(0, 300));
    };
    recognition.start();
  };

  const handleAddProductClick = () => {
    if (cameraConsentGiven) {
      router.push("/myshop/add-product");
    } else {
      setShowCameraConsentDialog(true);
    }
  };

  const acceptCameraConsent = () => {
    localStorage.setItem(`camera_consent_${userId}`, "true");
    setCameraConsentGiven(true);
    setShowCameraConsentDialog(false);
    router.push("/myshop/add-product");
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]"><div className="w-10 h-10 border-4 border-[#6200EE] border-t-transparent rounded-full animate-spin"></div></div>;

  const inStockCount = allProducts.filter(p => p.inStock && !(p.isOnSale && isSaleActive(p.saleEndDate))).length;
  const promoCount = allProducts.filter(p => p.isOnSale && isSaleActive(p.saleEndDate)).length;
  const noStockCount = allProducts.filter(p => !p.inStock && !(p.isOnSale && isSaleActive(p.saleEndDate))).length;

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-32 relative font-sans">
      
      <div className="w-full max-w-4xl mx-auto flex flex-col">
        {/* HEADER */}
        <div className="px-4 pt-4 pb-2 bg-[#F5F5F5] sticky top-0 z-50">
          <h1 className="text-[22px] font-bold text-black leading-tight">My Shop</h1>
          <p className="text-[12px] text-[#757575]">{filteredProducts.length} products found</p>
        </div>

        {/* SEARCH */}
        <div className="px-4 mb-4">
          <div className="bg-[#F1F2F4] rounded-full px-4 h-[44px] flex items-center">
            <svg className="w-5 h-5 text-black mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              placeholder="Search products in your shop..." 
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="bg-transparent w-full outline-none text-[14px] text-black placeholder-gray-600"
            />
          </div>
        </div>

        {/* CUSTOM TABS (Folder style) */}
        <div className="px-4 flex border-b border-[#E0E0E0]">
          {[
            { key: "in_stock", label: `In Stock`, count: inStockCount },
            { key: "promotion", label: `Promotion`, count: promoCount },
            { key: "no_stock", label: `No Stock`, count: noStockCount }
          ].map(tab => {
            const isSelected = currentSection === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setCurrentSection(tab.key)}
                className={`flex-1 py-2.5 text-[11px] font-bold text-center rounded-t-[12px] transition-colors relative flex justify-center ${
                  isSelected ? 'text-[#6200EE]' : 'text-[#757575]'
                }`}
              >
                <span>{tab.label} ({tab.count})</span>
                {isSelected && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#6200EE]" />
                )}
              </button>
            )
          })}
        </div>

        {/* PRODUCT LIST */}
        <div className="p-4 space-y-3">
          {error && allProducts.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[#B00020] mb-2">{error}</p>
              <button onClick={fetchProducts} className="text-[#6200EE] font-bold">Try again</button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <p className="text-center text-[#757575] py-10">
              {searchQuery ? "No products match your search." : "No products found in this section."}
            </p>
          ) : (
            filteredProducts.map((product, index) => {
              const isEditing = editingProductId === product.id;
              const currentlyOnSale = product.isOnSale && isSaleActive(product.saleEndDate);
              const isNoStock = !product.inStock;
              const isHighlighted = product.id ? recentlyUpdated.has(product.id) : false;
              const updatedLabel = getUpdatedLabel(product.last_updated);

              if (isEditing) {
                return (
                  <div key={product.id || index} className="bg-white rounded-[12px] p-4 shadow-sm border border-[#E0E0E0]">
                    <h3 className="text-[14px] font-bold text-[#6200EE] mb-3">Editing Product</h3>
                    <div className="space-y-3">
                      <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-[8px] p-2 text-[14px] outline-none" placeholder="Name" />
                      <input value={editForm.price} onChange={e => setEditForm({...editForm, price: e.target.value})} type="number" className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-[8px] p-2 text-[14px] outline-none" placeholder="Price" />
                      <div className="flex space-x-2">
                        <select value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})} className="w-1/2 bg-[#F5F5F5] border border-[#E0E0E0] rounded-[8px] p-2 text-[14px] outline-none">
                          <option value="per_kg">per kg</option>
                          <option value="per_100g">per 100g</option>
                          <option value="per_piece">per piece</option>
                        </select>
                        <select value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} className="w-1/2 bg-[#F5F5F5] border border-[#E0E0E0] rounded-[8px] p-2 text-[14px] outline-none">
                          {["Kirana", "Snacks", "Dairy", "Drinks", "Fruits & vegetables", "TechTools", "Stat.", "Others"].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex space-x-2 pt-2">
                        <button onClick={() => setEditingProductId(null)} className="flex-1 py-2 border border-[#E0E0E0] rounded-[8px] text-[14px] font-bold text-[#757575]">Cancel</button>
                        <button onClick={handleEditSubmit} className="flex-1 py-2 bg-[#6200EE] text-white rounded-[8px] text-[14px] font-bold">Save</button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={product.id || index} className={`bg-white rounded-[12px] p-2 shadow-none border transition-colors duration-500 flex items-center ${isHighlighted ? 'border-[#6200EE]/50 bg-[#6200EE]/15' : 'border-[#E0E0E0]/50'}`}>
                  
                                   {/* IMAGE */}
                  <div 
                    className="w-[72px] h-[72px] bg-[#F5F5F5] rounded-[8px] overflow-hidden flex-shrink-0 border border-[#E0E0E0]/50 cursor-pointer relative"
                    onClick={() => {
                      const imgs = (product.images && product.images.length > 0) ? product.images : (product.imageUrl ? [product.imageUrl] : []);
                      if (imgs.length > 0) setZoomGallery({ images: imgs, index: 0 });
                    }}
                  >
                    {product.imageUrl ? (
                      <>
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        {/* NEW: Multiple Image Dots */}
                        {product.images && product.images.length > 1 && (
                          <div className="absolute bottom-1 left-0 right-0 flex justify-center space-x-1 z-10">
                            {product.images.map((_, i) => (
                              <div key={i} className="w-1.5 h-1.5 bg-white rounded-full shadow-sm opacity-90" />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      </div>
                    )}
                  </div>

                  {/* INFO */}
                  <div className="flex-1 ml-2.5 overflow-hidden flex flex-col gap-0.5">
                    <p className="text-[14px] font-semibold text-black truncate leading-tight">{product.name}</p>
                    <p className="text-[11px] text-[#757575] truncate leading-tight">
                      {product.category || "Others"}{updatedLabel}
                    </p>
                    
                    <div className="flex items-center mt-0.5">
                      {currentlyOnSale && product.salePrice ? (
                        <>
                          <span className="text-[14px] font-bold text-[#6200EE]">₹{product.salePrice.toFixed(0)}</span>
                          <span className="text-[11px] text-[#757575] line-through ml-1.5">₹{product.price.toFixed(0)}</span>
                        </>
                      ) : (
                        <span className="text-[14px] font-medium text-black">₹{product.price.toFixed(0)} / {product.unit.replace("_", " ")}</span>
                      )}
                    </div>

                    <div className="mt-1">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${isNoStock ? 'bg-[#B00020]/10 text-[#B00020]' : 'bg-[#10B981]/10 text-[#10B981]'}`}>
                        {isNoStock ? "Out of Stock" : "In Stock"}
                      </span>
                    </div>
                  </div>

                  {/* MENU */}
                  <div className="relative">
                    <button 
                      onClick={() => setOpenMenuId(openMenuId === product.id ? null : (product.id || null))} 
                      className="p-2 text-[#757575] hover:bg-gray-50 rounded-full"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                    </button>
                    {openMenuId === product.id && (
                      <div className="absolute right-0 top-10 w-40 bg-white rounded-[8px] shadow-xl border border-[#E0E0E0] z-50 flex flex-col overflow-hidden py-1">
                        <button onClick={() => {
                          setOpenMenuId(null);
                          setEditingProductId(product.id);
                          setEditForm({ name: product.name, price: product.price.toString(), unit: product.unit, category: product.category || "Others" });
                        }} className="text-left px-4 py-2 text-[14px] text-black hover:bg-gray-50">Edit</button>
                        
                        <button onClick={() => {
                          setOpenMenuId(null);
                          setProductToPromote(product);
                          setPromoForm({ salePrice: product.salePrice?.toString() || "", saleDescription: product.saleDescription || "", durationDays: "7" });
                        }} className="text-left px-4 py-2 text-[14px] text-black hover:bg-gray-50">
                          {currentlyOnSale ? "Edit Sale" : "Promote"}
                        </button>
                        
                        <button onClick={() => {
                          setOpenMenuId(null);
                          handleToggleStock(product);
                        }} className="text-left px-4 py-2 text-[14px] text-black hover:bg-gray-50">
                          {product.inStock ? "Stock Out" : "Stock In"}
                        </button>
                        
                        <div className="h-px bg-[#E0E0E0] w-full my-1"></div>
                        <button onClick={() => {
                          setOpenMenuId(null);
                          setProductToDelete(product);
                        }} className="text-left px-4 py-2 text-[14px] text-[#B00020] font-bold hover:bg-red-50">Delete</button>
                      </div>
                    )}
                  </div>
              </div>
            );
          })
        )}
      </div>
      </div>

      {/* FLOATING ACTION BUTTONS */}
      <div className="fixed bottom-20 right-4 flex flex-col space-y-4 z-40">
        <button onClick={() => setShowDescriptionDialog(true)} className="w-[48px] h-[48px] bg-[#E0D4F5] text-[#6200EE] rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        </button>
        <button onClick={handleAddProductClick} className="w-[56px] h-[56px] bg-[#03DAC5] text-black rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
        </button>
      </div>

      {/* IMAGE ZOOM MODAL */}
      {zoomGallery && (
        <div 
          className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center touch-none select-none"
          onTouchStart={(e) => {
            if (e.touches.length === 2) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              pinchStartDist.current = Math.hypot(dx, dy);
              pinchStartScale.current = zoomScale;
              touchStartX.current = null;
            } else if (e.touches.length === 1) {
              const x = e.touches[0].clientX;
              const y = e.touches[0].clientY;
              if (zoomScale > 1) {
                panStart.current = { x, y };
                panStartPos.current = { ...zoomPos };
              } else {
                touchStartX.current = x;
              }
              const now = Date.now();
              if (now - lastTap.current < 300) {
                if (zoomScale > 1) { setZoomScale(1); setZoomPos({ x: 0, y: 0 }); }
                else { setZoomScale(2.5); }
                touchStartX.current = null;
                lastTap.current = 0;
              } else {
                lastTap.current = now;
              }
            }
          }}
          onTouchMove={(e) => {
            if (e.touches.length === 2 && pinchStartDist.current) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const dist = Math.hypot(dx, dy);
              const newScale = clampScale(pinchStartScale.current * (dist / pinchStartDist.current));
              setZoomScale(newScale);
              if (newScale === 1) setZoomPos({ x: 0, y: 0 });
            } else if (e.touches.length === 1 && panStart.current && zoomScale > 1) {
              const dx = e.touches[0].clientX - panStart.current.x;
              const dy = e.touches[0].clientY - panStart.current.y;
              setZoomPos({ x: panStartPos.current.x + dx, y: panStartPos.current.y + dy });
            }
          }}
          onTouchEnd={(e) => {
            if (e.touches.length < 2) pinchStartDist.current = null;
            if (touchStartX.current !== null && zoomScale === 1) {
              const touchEndX = e.changedTouches[0].clientX;
              const distance = touchStartX.current - touchEndX;
              if (distance > 50 && zoomGallery.index < zoomGallery.images.length - 1) {
                setZoomGallery({ ...zoomGallery, index: zoomGallery.index + 1 });
                setZoomScale(1); setZoomPos({ x: 0, y: 0 });
              } else if (distance < -50 && zoomGallery.index > 0) {
                setZoomGallery({ ...zoomGallery, index: zoomGallery.index - 1 });
                setZoomScale(1); setZoomPos({ x: 0, y: 0 });
              }
            }
            panStart.current = null;
            touchStartX.current = null;
          }}
        >
          {/* Header / Close */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
            <span className="text-white text-sm font-bold">
              {zoomGallery.images.length > 1 ? `${zoomGallery.index + 1} / ${zoomGallery.images.length}` : ''}
            </span>
            <button onClick={() => { setZoomGallery(null); setZoomScale(1); setZoomPos({ x: 0, y: 0 }); }} className="w-10 h-10 bg-black/50 text-white rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>

          {/* Image Container (pinch / pan / wheel / drag) */}
          <div 
            ref={containerRef}
            className={`relative w-full h-full max-w-4xl flex items-center justify-center overflow-hidden ${zoomScale > 1 ? 'cursor-grab' : ''}`}
            onMouseDown={(e) => {
              if (zoomScale > 1) {
                panStart.current = { x: e.clientX, y: e.clientY };
                panStartPos.current = { ...zoomPos };
              }
            }}
            onMouseMove={(e) => {
              if (panStart.current && zoomScale > 1) {
                const dx = e.clientX - panStart.current.x;
                const dy = e.clientY - panStart.current.y;
                setZoomPos({ x: panStartPos.current.x + dx, y: panStartPos.current.y + dy });
              }
            }}
            onMouseUp={() => { panStart.current = null; }}
            onMouseLeave={() => { panStart.current = null; }}
          >
            <img 
              src={zoomGallery.images[zoomGallery.index]} 
              alt="Zoomed" 
              className="max-w-full max-h-full object-contain transition-transform duration-100 ease-out"
              style={{ transform: `translate(${zoomPos.x}px, ${zoomPos.y}px) scale(${zoomScale})` }}
              draggable={false}
              onClick={(e) => e.stopPropagation()} 
            />
          </div>

          {/* Navigation Arrows (Desktop) - hidden while zoomed so swipe/pan isn't blocked */}
          {zoomGallery.images.length > 1 && zoomScale === 1 && (
            <>
              {zoomGallery.index > 0 && (
                <button onClick={() => { setZoomGallery({ ...zoomGallery, index: zoomGallery.index - 1 }); setZoomScale(1); setZoomPos({ x: 0, y: 0 }); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 text-white rounded-full flex items-center justify-center z-50 hover:bg-black/80">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
              )}
              {zoomGallery.index < zoomGallery.images.length - 1 && (
                <button onClick={() => { setZoomGallery({ ...zoomGallery, index: zoomGallery.index + 1 }); setZoomScale(1); setZoomPos({ x: 0, y: 0 }); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 text-white rounded-full flex items-center justify-center z-50 hover:bg-black/80">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* PROMOTION DIALOG */}
      {productToPromote && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-[16px] p-6 w-full max-w-sm">
            <h2 className="text-[20px] font-bold text-black mb-1">Manage Promotion</h2>
            <p className="text-[14px] text-[#757575] mb-4">for {productToPromote.name}</p>
            
            <div className="space-y-3">
              <input type="number" placeholder={`Sale Price (Original: ₹${productToPromote.price.toFixed(0)})`} value={promoForm.salePrice} onChange={e => setPromoForm({...promoForm, salePrice: e.target.value})} className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-[8px] p-3 text-[14px] outline-none" />
              <input placeholder="Offer Description" value={promoForm.saleDescription} onChange={e => setPromoForm({...promoForm, saleDescription: e.target.value})} className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-[8px] p-3 text-[14px] outline-none" />
              <input type="number" placeholder="Duration (Days)" value={promoForm.durationDays} onChange={e => setPromoForm({...promoForm, durationDays: e.target.value})} className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-[8px] p-3 text-[14px] outline-none" />
            </div>

            <div className="mt-6 space-y-2">
              <button onClick={handlePromotionSubmit} className="w-full py-3 bg-[#6200EE] text-white rounded-[8px] font-bold text-[14px]">
                {productToPromote.isOnSale ? "Update Promotion" : "Start Promotion"}
              </button>
              {productToPromote.isOnSale && (
                <button onClick={handleRemovePromotion} className="w-full py-3 bg-[#B00020] text-white rounded-[8px] font-bold text-[14px]">Remove Promotion</button>
              )}
              <button onClick={() => setProductToPromote(null)} className="w-full py-3 border border-[#E0E0E0] text-[#757575] rounded-[8px] font-bold text-[14px]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE DIALOG */}
      {productToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-[16px] p-6 w-full max-w-sm text-center">
            <h2 className="text-[20px] font-bold text-black mb-2">Delete Product</h2>
            <p className="text-[14px] text-[#757575] mb-6">Are you sure you want to delete '{productToDelete.name}'? This action cannot be undone.</p>
            <div className="flex space-x-3">
              <button onClick={() => setProductToDelete(null)} className="flex-1 py-3 border border-[#E0E0E0] rounded-[8px] font-bold text-[#757575]">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-3 bg-[#B00020] text-white rounded-[8px] font-bold">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* STORE DESCRIPTION DIALOG */}
      {showDescriptionDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-[16px] p-6 w-full max-w-sm">
            <h2 className="text-[20px] font-bold text-black mb-4">About your store</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[12px] text-[#757575] ml-1 mb-1 block">Mobile number</label>
                <input 
                  value={ownerPhone} 
                  onChange={e => {
                    setOwnerPhone(e.target.value.replace(/\D/g, '').slice(0,12));
                    setPhoneError(false);
                  }} 
                  className={`w-full bg-[#F5F5F5] border rounded-[8px] p-3 text-[14px] outline-none ${phoneError ? 'border-[#B00020]' : 'border-[#E0E0E0]'}`} 
                />
                {phoneError && <p className="text-[#B00020] text-[11px] ml-1 mt-1">Phone must be 10-12 digits.</p>}
              </div>
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="text-[12px] text-[#757575] ml-1">Description</label>
                  <button onClick={startVoiceInput} className="text-[#6200EE] text-[12px] font-bold flex items-center">
                    <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
                    Speak
                  </button>
                </div>
                <textarea 
                  value={storeDescription} 
                  onChange={e => setStoreDescription(e.target.value.slice(0, 300))} 
                  rows={4}
                  placeholder="Tell customers about your store..."
                  className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-[8px] p-3 text-[14px] outline-none resize-none" 
                />
                <p className="text-right text-[11px] text-[#757575] mt-1">{storeDescription.length} / 300</p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowDescriptionDialog(false)} className="flex-1 py-3 border border-[#E0E0E0] rounded-[8px] font-bold text-[#757575]">Cancel</button>
              <button onClick={handleSaveDesc} disabled={isSavingDesc} className="flex-1 py-3 bg-[#6200EE] text-white rounded-[8px] font-bold disabled:opacity-50">
                {isSavingDesc ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMERA CONSENT DIALOG */}
      {showCameraConsentDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-6">
          <div className="bg-white rounded-[16px] p-6 w-full max-w-sm text-center">
            <h2 className="text-[20px] font-bold text-black mb-3">Camera Access Required</h2>
            <p className="text-[14px] text-[#121212] mb-2 text-left leading-relaxed">
              We need to use your camera to take photos of the products you want to add.
            </p>
            <p className="text-[14px] text-[#121212] mb-6 text-left font-semibold">
              Do you agree to allow camera access?
            </p>
            <div className="flex space-x-3">
              <button onClick={() => setShowCameraConsentDialog(false)} className="flex-1 py-3 border border-[#E0E0E0] rounded-[8px] font-bold text-[#B00020]">Deny</button>
              <button onClick={acceptCameraConsent} className="flex-1 py-3 bg-[#6200EE] text-white rounded-[8px] font-bold">Agree</button>
            </div>
          </div>
        </div>
      )}
      
      <BottomNav />
    </div>
  );
}

export default function MyShopScreen() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]"><div className="w-10 h-10 border-4 border-[#6200EE] border-t-transparent rounded-full animate-spin"></div></div>}>
      <MyShopContent />
    </Suspense>
  );
}