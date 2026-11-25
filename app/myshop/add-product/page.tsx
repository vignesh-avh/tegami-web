"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserIdFromToken, uploadAndPredict, bulkAddProducts } from "../../../lib/api";
import { ScannedProduct, GalleryScannedProduct, BulkProductItem } from "../../../lib/types";

export default function AddProductScreen() {
  const router = useRouter();
  const userId = getUserIdFromToken();

  // Helper: Format the backend ID into a full URL
  const getImageUrl = (idOrUrl?: string) => {
    if (!idOrUrl) return '';
    if (idOrUrl.startsWith('http')) return idOrUrl;
    return `https://api.avapp.in/temp/${idOrUrl}`;
  };
  
  // States
  const [view, setView] = useState<'CAMERA' | 'PROCESSING' | 'GRID' | 'GALLERY_GRID'>('CAMERA');
  const [isMultiMode, setIsMultiMode] = useState(false);
  // Camera batches: Pair of Primary File and Extra Files
  const [batchedFiles, setBatchedFiles] = useState<{ primary: File; extras: File[] }[]>([]);
  const [currentPrimary, setCurrentPrimary] = useState<File | null>(null);
  const [currentExtras, setCurrentExtras] = useState<File[]>([]);

  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);
  const [galleryProducts, setGalleryProducts] = useState<GalleryScannedProduct[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  
  // Camera Refs & State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState<ScannedProduct | null>(null);

  // NEW: Force reset state when screen mounts to prevent stale state from Next.js cache
  useEffect(() => {
    setView('CAMERA');
    setBatchedFiles([]);
    setScannedProducts([]);
    setSavedCount(0);
    setShowValidationErrors(false);
    setIsSaving(false);
  }, []);

  // 1. Initialize Camera
  useEffect(() => {
    if (view === 'CAMERA') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [view]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access denied or unavailable", err);
      alert("Camera access is required to take photos.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // 2. Capture Image
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cropW = vw * 0.80;
    const cropH = vh * 0.55;
    const startX = (vw - cropW) / 2;
    const startY = (vh - cropH) / 2;

    canvas.width = cropW;
    canvas.height = cropH;
    ctx.drawImage(video, startX, startY, cropW, cropH, 0, 0, cropW, cropH);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
        if (isMultiMode) {
          if (!currentPrimary) {
            setCurrentPrimary(file);
          } else if (currentExtras.length < 3) {
            setCurrentExtras(prev => [...prev, file]);
          }
        } else {
          setBatchedFiles(prev => [...prev, { primary: file, extras: [] }]);
        }
      }
    }, 'image/jpeg', 0.92);
  };

  // 3. Handle Gallery Selection
  const handleGallerySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Convert FileList to Array immediately
      const files = Array.from(e.target.files); 
      setView('PROCESSING');
      
      const results: GalleryScannedProduct[] = [];
      
      // Process all selected images
      for (const file of files) {
        const res = await uploadAndPredict(file);
        if (res) {
          const bgUrl = res.was_catalog_used_by_default ? res.original_temp_id : res.temp_image_id;
          results.push({
            id: crypto.randomUUID(),
            localFile: file,
            localUrl: URL.createObjectURL(file),
            predictedName: res.predicted_name || "",
            predictedCategory: res.predicted_category || "Kirana",
            predictedUnit: res.predicted_unit || "per_piece",
            predictedPrice: res.predicted_price || "0",
            bgRemovedUrl: bgUrl,
            originalS3Url: undefined,
            catalogImageUrl: res.catalog_image_url,
            wasCatalogUsed: res.was_catalog_used_by_default || false,
            aiConfidence: res.predicted_confidence,
            alternatives: res.alternative_names || [],
            priceFromAi: (res.predicted_price ? parseFloat(res.predicted_price) : 0) > 0,
            selectedSide: bgUrl ? 'BackgroundRemoved' : 'Original',
            isProcessing: false,
            needsCrop: false,
            extraFiles: [],
            extraS3Urls: []
          });
        }
      }
      
      // Add to existing if they are adding more, or replace
      setGalleryProducts(results);
      setView('GALLERY_GRID');
      
      // Reset the input value so the same files can be selected again if needed
      e.target.value = '';
    }
  };

  // 4. Process Camera Images (Bulk API Calls)
  const processImages = async (bundles: { primary: File; extras: File[] }[]) => {
    if (bundles.length === 0) return;
    setView('PROCESSING');
    setBatchedFiles([]); 
    
    const results: ScannedProduct[] = [];
    let failedCount = 0;

    for (let i = 0; i < bundles.length; i += 3) {
      const chunk = bundles.slice(i, i + 3);
      const promises = chunk.map(async (bundle) => {
        try {
          const res = await uploadAndPredict(bundle.primary);
          if (res) {
            // Upload the extras in the background and get their IDs
            const extraIds: string[] = [];
            for (const extraFile of bundle.extras) {
              const extraRes = await uploadAndPredict(extraFile, true);
              if (extraRes) extraIds.push(extraRes.temp_image_id);
            }

            return {
              id: crypto.randomUUID(),
              file: bundle.primary,
              previewUrl: getImageUrl(res.temp_image_id),
              predictedName: res.predicted_name || "",
              predictedCategory: res.predicted_category || "Kirana",
              predictedUnit: res.predicted_unit || "per_piece",
              predictedPrice: res.predicted_price || "0",
              tempImageId: res.temp_image_id,
              originalTempId: res.original_temp_id,
              wasCatalogUsed: res.was_catalog_used_by_default,
              priceFromAi: (res.predicted_price ? parseFloat(res.predicted_price) : 0) > 0,
              aiConfidence: res.predicted_confidence,
              alternatives: res.alternative_names || [],
              catalogImageUrl: res.catalog_image_url,
              isProcessing: false,
              extraFiles: bundle.extras,
              extraTempIds: extraIds 
            } as ScannedProduct;
          } else {
            failedCount++;
            return null;
          }
        } catch (err) {
          console.error("Failed to process image:", err);
          failedCount++;
          return null;
        }
      });
      const chunkResults = await Promise.all(promises);
      chunkResults.forEach(r => { if (r) results.push(r); });
    }
    
    if (failedCount > 0) {
      alert(`Failed to process ${failedCount} image(s). Please try again.`);
    }

    setScannedProducts(results);
    setView('GRID');
  };

  // 5. Save All
  const saveAllProducts = async () => {
    if (!userId || isSaving) return;
    setIsSaving(true);
    
    const isGallery = view === 'GALLERY_GRID';
    const productsToSave = isGallery ? galleryProducts : scannedProducts;

    if (productsToSave.length === 0) {
      setIsSaving(false);
      return;
    }

    // Validation
    const hasInvalid = productsToSave.some(p => p.predictedName.trim() === "" || parseFloat(p.predictedPrice) <= 0);
    if (hasInvalid) {
      setShowValidationErrors(true);
      alert("Please ensure all products have a name and a valid price.");
      setIsSaving(false);
      return;
    }
    setShowValidationErrors(false);

    // Prepare payload (uploading missing images if necessary)
    const payloadProducts: BulkProductItem[] = [];

    for (const p of productsToSave) {
      let primaryTempId = '';
      let extraIds: string[] = [];
      let skipExtraBgRemoval = false;

      if (isGallery) {
        const gp = p as GalleryScannedProduct;
        skipExtraBgRemoval = gp.selectedSide === 'Original';
        
        if (skipExtraBgRemoval) {
           // If using "My Photo", we need to upload it if we haven't already
           primaryTempId = gp.originalS3Url || '';
           if (!primaryTempId) {
             const res = await uploadAndPredict(gp.localFile, true);
             if (res) primaryTempId = res.temp_image_id;
           }
        } else {
           primaryTempId = gp.bgRemovedUrl || '';
        }
        
        // Upload any new extra images added from the gallery grid
        for (const f of gp.extraFiles) {
           const res = await uploadAndPredict(f, true);
           if (res) extraIds.push(res.temp_image_id);
        }
      } else {
        const sp = p as ScannedProduct;
        primaryTempId = sp.tempImageId;
        extraIds = sp.extraTempIds;
      }

      payloadProducts.push({
        product_name: p.predictedName,
        price: parseFloat(p.predictedPrice),
        unit: p.predictedUnit,
        category: p.predictedCategory,
        temp_image_id: primaryTempId,
        extra_image_ids: extraIds,
        skip_extra_bg_removal: skipExtraBgRemoval
      });
    }

    const success = await bulkAddProducts({
      owner_id: userId,
      products: payloadProducts
    });

    setIsSaving(false);
    if (success) {
      alert("All products added successfully!");
      router.push("/myshop");
    } else {
      alert("Failed to save products. Please try again.");
    }
  };

  // 6. Voice Input for Edit Modal
  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice typing is not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      if (editingProduct) {
        setEditingProduct({ ...editingProduct, predictedName: text });
      }
    };
    recognition.start();
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col font-sans">
      
      {/* HEADER */}
      <div className="px-4 py-3 bg-white shadow-sm flex items-center sticky top-0 z-50">
        <button onClick={() => {
          if (scannedProducts.length > 0 || galleryProducts.length > 0) {
            if(confirm("Discard scanned products?")) router.push("/myshop");
          } else {
            router.push("/myshop");
          }
        }} className="p-2">
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        </button>
        <h1 className="text-[18px] font-bold text-black ml-2">
          {view === 'CAMERA' ? 'Add Product' : view === 'PROCESSING' ? 'Processing...' : 'Verify Products'}
        </h1>
      </div>

      {/* CAMERA VIEW */}
      {view === 'CAMERA' && (
        <div className="flex-1 relative flex flex-col bg-black">
          <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          
                    {/* Reticle Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[80%] h-[55%] border-4 border-green-500 rounded-lg relative">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-xs bg-black/50 px-2 py-1 rounded">Align product here</div>
            </div>
          </div>

          {/* Queue Indicator */}
          {batchedFiles.length > 0 && (
            <div className="absolute top-20 right-4 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs font-bold z-10 shadow-lg">
              Queued: {batchedFiles.length}
            </div>
          )}

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center bg-gradient-to-t from-black/80 to-transparent">
            
            {/* Mode Toggle */}
            <div className="flex bg-gray-800 rounded-full p-1 mb-2">
              <button onClick={() => { setIsMultiMode(false); setCurrentPrimary(null); setCurrentExtras([]); }} className={`px-4 py-2 rounded-full text-xs font-bold ${!isMultiMode ? 'bg-[#6200EE] text-white' : 'text-gray-400'}`}>Single</button>
              <button onClick={() => { setIsMultiMode(true); setCurrentPrimary(null); setCurrentExtras([]); }} className={`px-4 py-2 rounded-full text-xs font-bold ${isMultiMode ? 'bg-[#6200EE] text-white' : 'text-gray-400'}`}>Multi</button>
            </div>

            {/* Multi-Mode Slots Preview (Android Style) */}
            {isMultiMode && (
              <div className="flex space-x-2 mb-4">
                {/* Primary Slot */}
                <div className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center overflow-hidden ${!currentPrimary ? 'border-[#6200EE] bg-white/20' : 'border-transparent bg-white/30'}`}>
                  {currentPrimary ? <img src={URL.createObjectURL(currentPrimary)} className="w-full h-full object-cover" /> : <span className="text-white text-xs text-center">Main</span>}
                </div>
                {/* Extra Slots */}
                {[0, 1, 2].map(i => {
                  const file = currentExtras[i];
                  const isActive = currentPrimary && currentExtras.length === i;
                  return (
                    <div key={i} className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center overflow-hidden ${isActive ? 'border-[#03DAC5]' : 'border-transparent bg-white/20'}`}>
                      {file ? <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" /> : null}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between w-full max-w-sm">
                            {/* Gallery Button */}
              <label className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center cursor-pointer">
                {/* FIXED: Explicitly added multiple to allow picking multiple photos */}
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                  onChange={handleGallerySelect} 
                />
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              </label>

              {/* Capture Button */}
              <button onClick={captureImage} className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center">
                <div className="w-16 h-16 bg-[#6200EE] rounded-full"></div>
              </button>

                            {/* Next / Process Batch Button */}
              <div className="w-16 h-12 flex flex-col items-center justify-center space-y-1">
                {isMultiMode && (
                  <button 
                    disabled={!currentPrimary}
                    onClick={() => { 
                      if (!currentPrimary) return;
                      setBatchedFiles(prev => [...prev, { primary: currentPrimary, extras: currentExtras }]); 
                      setCurrentPrimary(null); 
                      setCurrentExtras([]); 
                    }} 
                    className={`font-bold text-[10px] px-2 py-1 rounded ${currentPrimary ? 'bg-white text-black' : 'bg-gray-500 text-gray-300'}`}
                  >
                    Next
                  </button>
                )}
                {batchedFiles.length > 0 && (
                  <button onClick={() => processImages(batchedFiles)} className="bg-[#03DAC5] text-black font-bold text-[10px] px-2 py-1 rounded mt-1 shadow-md">
                    Process ({batchedFiles.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROCESSING VIEW */}
      {view === 'PROCESSING' && (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#F5F5F5]">
          <div className="w-16 h-16 border-4 border-[#6200EE] border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-[18px] font-bold text-black mb-2">Extracting Products</h2>
          <p className="text-[14px] text-gray-600">Using AI to read names, categories, and prices...</p>
        </div>
      )}

      {/* GRID VIEW */}
      {view === 'GRID' && (
        <div className="flex-1 flex flex-col p-4">
          <div className="mb-4">
            <h2 className="text-[16px] font-bold text-black">Products Ready ({scannedProducts.length})</h2>
            <p className="text-[12px] text-gray-500">Tap any product to edit its details.</p>
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3 pb-24">
            {scannedProducts.map((product) => {
              // NEW: Check if this specific product is invalid
              const isInvalid = product.predictedName.trim() === "" || parseFloat(product.predictedPrice) <= 0;
              const needsAttention = showValidationErrors && isInvalid;

              return (
                <div 
                  key={product.id} 
                  onClick={() => setEditingProduct(product)} 
                  className={`bg-white rounded-xl shadow-sm border p-3 flex flex-col relative cursor-pointer transition-colors ${
                    needsAttention ? 'border-red-500 border-2 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  {needsAttention && (
                    <span className="text-[10px] font-bold text-red-500 mb-1">Missing Info</span>
                  )}
                  
                  <button onClick={(e) => { e.stopPropagation(); setScannedProducts(prev => prev.filter(p => p.id !== product.id)); }} className="absolute top-2 right-2 bg-white/80 rounded-full p-1 z-10">
                     <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                  
                  <img src={product.previewUrl} alt={product.predictedName} className="w-full aspect-square object-contain bg-gray-50 rounded-lg mb-2" />
                  <p className={`text-[14px] font-bold line-clamp-2 ${!product.predictedName ? 'text-red-500' : 'text-black'}`}>
                    {product.predictedName || "Tap to add name"}
                  </p>
                  <p className="text-[12px] text-gray-500">{product.predictedCategory}</p>
                  <p className={`text-[14px] font-bold mt-1 ${parseFloat(product.predictedPrice) <= 0 ? 'text-red-500' : 'text-black'}`}>
                    ₹{product.predictedPrice || "0"} / {product.predictedUnit.replace('per_', '')}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Save Button */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
             <button onClick={saveAllProducts} disabled={isSaving} className="w-full bg-[#6200EE] text-white font-bold py-4 rounded-full shadow-lg disabled:opacity-50">
               {isSaving ? `Uploading...` : `Add ${scannedProducts.length} Products`}
             </button>
          </div>
        </div>
      )}

            {/* GALLERY GRID VIEW */}
      {view === 'GALLERY_GRID' && (
        <div className="flex-1 flex flex-col p-4">
          <div className="mb-4">
            <h2 className="text-[16px] font-bold text-black">Pick the best photo</h2>
            <p className="text-[12px] text-gray-500">Select original or clean background. Tap to edit details.</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pb-24">
            {galleryProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 relative">
                <div className="flex justify-between items-center mb-2">
                   <button className="text-xs font-bold text-[#6200EE] flex items-center">
                     <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                     Crop
                   </button>
                   <div className="flex space-x-2">
                     <button onClick={() => setEditingProduct(product as any)} className="text-xs border border-gray-300 px-3 py-1 rounded">Edit</button>
                     <button onClick={() => setGalleryProducts(prev => prev.filter(p => p.id !== product.id))} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                       <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                     </button>
                   </div>
                </div>

                {/* Side-by-side Photos */}
                <div className="flex space-x-2 mb-3">
                   <div onClick={() => setGalleryProducts(prev => prev.map(p => p.id === product.id ? {...p, selectedSide: 'Original'} : p))} className={`flex-1 rounded-lg border-2 overflow-hidden cursor-pointer ${product.selectedSide === 'Original' ? 'border-[#6200EE]' : 'border-transparent'}`}>
                     <img src={product.localUrl} className="w-full aspect-square object-cover" />
                     <p className="text-center text-[10px] py-1 bg-gray-50">My photo</p>
                   </div>
                   <div onClick={() => product.bgRemovedUrl && setGalleryProducts(prev => prev.map(p => p.id === product.id ? {...p, selectedSide: 'BackgroundRemoved'} : p))} className={`flex-1 rounded-lg border-2 overflow-hidden cursor-pointer ${product.selectedSide === 'BackgroundRemoved' ? 'border-[#6200EE]' : 'border-transparent'}`}>
                     {product.bgRemovedUrl ? (
                       <img src={getImageUrl(product.bgRemovedUrl)} className="w-full aspect-square object-cover bg-gray-50" />
                     ) : (
                       <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-xs text-gray-400">No Clean BG</div>
                     )}
                     <p className="text-center text-[10px] py-1 bg-gray-50">Clean background</p>
                   </div>
                </div>

                {/* Extra Images Row */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-gray-500">More photos ({product.extraFiles.length}/3)</span>
                  <div className="flex space-x-2">
                                        {product.extraFiles.map((f: File, i: number) => (
                      <div key={i} className="relative w-8 h-8 rounded overflow-hidden">
                        <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />
                        <button onClick={() => setGalleryProducts(prev => prev.map(p => p.id === product.id ? {...p, extraFiles: p.extraFiles.filter((_: File, idx: number) => idx !== i)} : p))} className="absolute top-0 right-0 bg-black/50 text-white rounded-full p-[1px]">
                           <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                      </div>
                    ))}
                    {product.extraFiles.length < 3 && (
                      <label className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const f = e.target.files[0];
                            setGalleryProducts(prev => prev.map(p => p.id === product.id ? {...p, extraFiles: [...p.extraFiles, f]} : p));
                          }
                        }} />
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                      </label>
                    )}
                  </div>
                </div>

                <p className="text-[14px] font-bold text-black mt-2 truncate">{product.predictedName || "Tap Edit to add name"}</p>
                <p className="text-[12px] text-gray-500">{product.predictedCategory} • ₹{product.predictedPrice}</p>
              </div>
            ))}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
             <button onClick={saveAllProducts} disabled={isSaving} className="w-full bg-[#6200EE] text-white font-bold py-4 rounded-full shadow-lg disabled:opacity-50">
               {isSaving ? `Uploading...` : `Add ${galleryProducts.length} Products`}
             </button>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h2 className="text-[20px] font-bold text-black mb-4">Edit Product</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Product Name</label>
                <div className="flex space-x-2">
                  <input value={editingProduct.predictedName} onChange={e => setEditingProduct({...editingProduct, predictedName: e.target.value})} className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm outline-none" placeholder="Name" />
                  <button onClick={startVoiceInput} className="bg-[#6200EE] text-white p-3 rounded-lg">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Price (₹)</label>
                <input type="number" value={editingProduct.predictedPrice} onChange={e => setEditingProduct({...editingProduct, predictedPrice: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm outline-none" />
              </div>

              <div className="flex space-x-2">
                 <div className="flex-1">
                   <label className="text-xs font-bold text-gray-500 mb-1 block">Unit</label>
                   <select value={editingProduct.predictedUnit} onChange={e => setEditingProduct({...editingProduct, predictedUnit: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm outline-none">
                     <option value="per_kg">Per Kg</option>
                     <option value="per_100g">Per 100g</option>
                     <option value="per_piece">Per Piece</option>
                   </select>
                 </div>
                 <div className="flex-1">
                   <label className="text-xs font-bold text-gray-500 mb-1 block">Category</label>
                   <select value={editingProduct.predictedCategory} onChange={e => setEditingProduct({...editingProduct, predictedCategory: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm outline-none">
                     {["Kirana", "Snacks", "Dairy", "Drinks", "Fruits & vegetables", "TechTools", "Stat.", "Others"].map(c => (
                       <option key={c} value={c}>{c}</option>
                     ))}
                   </select>
                 </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button onClick={() => setEditingProduct(null)} className="flex-1 py-3 border border-gray-300 rounded-lg font-bold text-gray-600">Cancel</button>
              <button onClick={() => {
                if (view === 'GALLERY_GRID') {
                  setGalleryProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, predictedName: editingProduct.predictedName, predictedPrice: editingProduct.predictedPrice, predictedCategory: editingProduct.predictedCategory, predictedUnit: editingProduct.predictedUnit } : p));
                } else {
                  setScannedProducts(prev => prev.map(p => p.id === editingProduct.id ? editingProduct : p));
                }
                setEditingProduct(null);
              }} className="flex-1 py-3 bg-[#6200EE] text-white rounded-lg font-bold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}