"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
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

export default function MyShopScreen() {
  const router = useRouter();
  const userId = getUserIdFromToken();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [currentSection, setCurrentSection] = useState("in_stock");
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
  
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false);
  const [storeDescription, setStoreDescription] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [isSavingDesc, setIsSavingDesc] = useState(false);

  // 1. Initial Load
  useEffect(() => {
    if (!userId) {
      router.push("/login");
      return;
    }
    fetchProducts();
    loadStoreDesc();
  }, [userId, router]);

  const fetchProducts = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const res = await getOwnerProducts(userId);
      // Map _id to id so actions work
      const mappedProducts = (res.products || []).map((p: any) => ({
        ...p,
        id: p._id || p.id || p.product_id
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
    }
  };

  // 2. Filtering Logic (Exactly matches Kotlin)
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
    if (!val.trim()) return; // FIX: Replaced isBlank with trim()
    
    // Auto-switch tab logic from Kotlin
    const match = allProducts.find(p => p.name.toLowerCase().includes(val.toLowerCase()));
    if (match) {
      if (match.isOnSale) setCurrentSection("promotion");
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
    }, 2000); // Highlight lasts 2 seconds
  };

  const handleDelete = async () => {
    if (!productToDelete || !productToDelete.id) return;
    const original = [...allProducts];
    const idToDelete = productToDelete.id;
    
    // Optimistic update
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
    
    // Optimistic update
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

    // Optimistic update
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
    setIsSavingDesc(true);
    const success = await saveStoreDescription({ description: storeDescription, phone: ownerPhone });
    setIsSavingDesc(false);
    if (success) setShowDescriptionDialog(false);
    else alert("Failed to save description");
  };

  const startVoiceInput = () => {
    // Browser Speech API implementation for the description
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
      setStoreDescription(prev => (prev + " " + speechToText).slice(0, 300));
    };
    recognition.start();
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]"><div className="w-10 h-10 border-4 border-avPrimary border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-32 relative">
      {/* HEADER */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-black">My Products</h1>
        <p className="text-sm text-gray-500">{filteredProducts.length} products found</p>
      </div>

      {/* SEARCH */}
      <div className="px-4 mb-4">
        <div className="bg-[#F1F2F4] rounded-full px-4 py-2.5 flex items-center">
          <svg className="w-5 h-5 text-black mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input 
            type="text" 
            placeholder="Search products in your shop..." 
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="bg-transparent w-full outline-none text-sm text-black placeholder-gray-600"
          />
        </div>
      </div>

      {/* TABS */}
      <div className="px-4 flex border-b border-gray-200">
        {[
          { key: "in_stock", label: `In Stock (${allProducts.filter(p => p.inStock && !isSaleActive(p.saleEndDate)).length})` },
          { key: "promotion", label: `Promotion (${allProducts.filter(p => p.isOnSale && isSaleActive(p.saleEndDate)).length})` },
          { key: "no_stock", label: `No Stock (${allProducts.filter(p => !p.inStock && !isSaleActive(p.saleEndDate)).length})` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setCurrentSection(tab.key)}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-colors ${
              currentSection === tab.key ? 'border-avPrimary text-avPrimary' : 'border-transparent text-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* PRODUCT LIST */}
      <div className="p-4 space-y-3">
        {error && allProducts.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-red-500 mb-2">{error}</p>
            <button onClick={fetchProducts} className="text-avPrimary font-bold">Try again</button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <p className="text-center text-gray-500 py-10">
            {searchQuery ? "No products match your search." : "No products found in this section."}
          </p>
        ) : (
          filteredProducts.map((product, index) => {
            const isEditing = editingProductId === product.id;
            const currentlyOnSale = product.isOnSale && isSaleActive(product.saleEndDate);
            const isNoStock = !product.inStock;
            const isHighlighted = product.id ? recentlyUpdated.has(product.id) : false;

            if (isEditing) {
              return (
                <div key={product.id || index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <h3 className="text-sm font-bold text-avPrimary mb-3">Editing Product</h3>
                  <div className="space-y-3">
                    <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm outline-none" placeholder="Name" />
                    <input value={editForm.price} onChange={e => setEditForm({...editForm, price: e.target.value})} type="number" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm outline-none" placeholder="Price" />
                    <div className="flex space-x-2">
                      <select value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})} className="w-1/2 bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm outline-none">
                        <option value="per_kg">per kg</option>
                        <option value="per_100g">per 100g</option>
                        <option value="per_piece">per piece</option>
                      </select>
                      <select value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} className="w-1/2 bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm outline-none">
                        {["Kirana", "Snacks", "Dairy", "Drinks", "Fruits & vegetables", "TechTools", "Stat.", "Others"].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex space-x-2 pt-2">
                      <button onClick={() => setEditingProductId(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700">Cancel</button>
                      <button onClick={handleEditSubmit} className="flex-1 py-2 bg-avPrimary text-white rounded-lg text-sm font-bold">Save</button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={product.id || index} className={`bg-white rounded-xl p-3 shadow-sm border transition-colors duration-500 flex items-center ${isHighlighted ? 'border-avPrimary bg-purple-50' : 'border-gray-200'}`}>
                <div className="w-16 h-16 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 ml-3 overflow-hidden">
                  <p className="text-sm font-bold text-black truncate">{product.name}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {product.category || "Others"}{getUpdatedLabel(product.last_updated)}
                  </p>
                  <div className="flex items-center mt-1">
                    {currentlyOnSale && product.salePrice ? (
                      <>
                        <span className="text-sm font-bold text-avPrimary">₹{product.salePrice.toFixed(0)}</span>
                        <span className="text-[10px] text-gray-400 line-through ml-2">₹{product.price.toFixed(0)}</span>
                      </>
                    ) : (
                      <span className="text-sm font-medium text-black">₹{product.price.toFixed(0)} / {product.unit.replace("_", " ")}</span>
                    )}
                  </div>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${isNoStock ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                    {isNoStock ? "Out of Stock" : "In Stock"}
                  </span>
                </div>

                                {/* DROPDOWN MENU */}
                <div className="relative">
                  <button 
                    onClick={() => setOpenMenuId(openMenuId === product.id ? null : (product.id || null))} 
                    className="p-2 text-gray-500"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                  </button>
                  {openMenuId === product.id && (
                    <div className="absolute right-0 top-10 w-40 bg-white rounded-lg shadow-xl border border-gray-100 z-50 flex flex-col overflow-hidden">
                      <button onClick={() => {
                        setOpenMenuId(null);
                        setEditingProductId(product.id);
                        setEditForm({ name: product.name, price: product.price.toString(), unit: product.unit, category: product.category || "Others" });
                      }} className="text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Edit</button>
                      
                      <button onClick={() => {
                        setOpenMenuId(null);
                        setProductToPromote(product);
                        setPromoForm({ salePrice: product.salePrice?.toString() || "", saleDescription: product.saleDescription || "", durationDays: "7" });
                      }} className="text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        {currentlyOnSale ? "Edit Sale" : "Promote"}
                      </button>
                      
                      <button onClick={() => {
                        setOpenMenuId(null);
                        handleToggleStock(product);
                      }} className="text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        {product.inStock ? "Stock Out" : "Stock In"}
                      </button>
                      
                      <div className="h-px bg-gray-100 w-full my-1"></div>
                      <button onClick={() => {
                        setOpenMenuId(null);
                        setProductToDelete(product);
                      }} className="text-left px-4 py-2 text-sm text-red-500 font-bold hover:bg-red-50">Delete</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FLOATING ACTION BUTTONS */}
      <div className="fixed bottom-20 right-4 flex flex-col space-y-3 z-40">
        <button onClick={() => alert("Voice Assistant Placeholder (Skipped)")} className="w-12 h-12 bg-purple-100 text-purple-700 rounded-full shadow-lg flex items-center justify-center">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
        </button>
        <button onClick={() => setShowDescriptionDialog(true)} className="w-12 h-12 bg-purple-200 text-purple-800 rounded-full shadow-lg flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        </button>
        <button onClick={() => alert("Add Product Placeholder (Camera not implemented yet)")} className="w-14 h-14 bg-avSecondary text-black rounded-full shadow-lg flex items-center justify-center">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
        </button>
      </div>

      {/* PROMOTION DIALOG */}
      {productToPromote && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-black mb-1">Manage Promotion</h2>
            <p className="text-xs text-gray-500 mb-4">for {productToPromote.name}</p>
            
            <div className="space-y-3">
              <input type="number" placeholder={`Sale Price (Original: ₹${productToPromote.price.toFixed(0)})`} value={promoForm.salePrice} onChange={e => setPromoForm({...promoForm, salePrice: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm outline-none" />
              <input placeholder="Offer Description" value={promoForm.saleDescription} onChange={e => setPromoForm({...promoForm, saleDescription: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm outline-none" />
              <input type="number" placeholder="Duration (Days)" value={promoForm.durationDays} onChange={e => setPromoForm({...promoForm, durationDays: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm outline-none" />
            </div>

            <div className="mt-6 space-y-2">
              <button onClick={handlePromotionSubmit} className="w-full py-2.5 bg-avPrimary text-white rounded-lg font-bold text-sm">
                {productToPromote.isOnSale ? "Update Promotion" : "Start Promotion"}
              </button>
              {productToPromote.isOnSale && (
                <button onClick={handleRemovePromotion} className="w-full py-2.5 bg-red-100 text-red-600 rounded-lg font-bold text-sm">Remove Promotion</button>
              )}
              <button onClick={() => setProductToPromote(null)} className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-lg font-bold text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE DIALOG */}
      {productToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
            <h2 className="text-lg font-bold text-black mb-2">Delete Product</h2>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete '{productToDelete.name}'? This action cannot be undone.</p>
            <div className="flex space-x-3">
              <button onClick={() => setProductToDelete(null)} className="flex-1 py-2 border border-gray-300 rounded-lg font-bold text-gray-700">Cancel</button>
              <button onClick={handleDelete} className="flex-1 py-2 bg-red-500 text-white rounded-lg font-bold">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* STORE DESCRIPTION DIALOG */}
      {showDescriptionDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-black mb-4">About your store</h2>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 ml-1">Mobile number</label>
                <input value={ownerPhone} onChange={e => setOwnerPhone(e.target.value.replace(/\D/g, '').slice(0,12))} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm outline-none" />
              </div>
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="text-xs text-gray-500 ml-1">Description</label>
                  <button onClick={startVoiceInput} className="text-avPrimary text-xs font-bold flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
                    Speak
                  </button>
                </div>
                <textarea 
                  value={storeDescription} 
                  onChange={e => setStoreDescription(e.target.value.slice(0, 300))} 
                  rows={4}
                  placeholder="Tell customers about your store..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-sm outline-none resize-none" 
                />
                <p className="text-right text-[10px] text-gray-400 mt-1">{storeDescription.length} / 300</p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowDescriptionDialog(false)} className="flex-1 py-2 border border-gray-300 rounded-lg font-bold text-gray-700">Cancel</button>
              <button onClick={handleSaveDesc} disabled={isSavingDesc} className="flex-1 py-2 bg-avPrimary text-white rounded-lg font-bold disabled:opacity-50">
                {isSavingDesc ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}