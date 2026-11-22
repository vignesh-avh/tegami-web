"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getUserIdFromToken, addShop } from "../../../lib/api";

export default function OnboardingScreen() {
  const router = useRouter();
  const ownerId = getUserIdFromToken();

  const [shopName, setShopName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [rating, setRating] = useState("5.0");
  const [storeType, setStoreType] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  
  const [locationError, setLocationError] = useState<string | null>(null);
  const [errors, setErrors] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleMobileChange = (val: string) => {
    const digits = val.replace(/\D/g, "");
    setMobileNumber(digits);
    if (digits.length > 10) {
      setErrors({ ...errors, mobileNumber: "Mobile number cannot exceed 10 digits." });
    } else {
      setErrors({ ...errors, mobileNumber: null });
    }
  };

  const handleRatingChange = (val: string) => {
    setRating(val);
    const parsed = parseFloat(val);
    if (val && (isNaN(parsed) || parsed < 0 || parsed > 5)) {
      setErrors({ ...errors, rating: "Rating must be between 0 and 5." });
    } else {
      setErrors({ ...errors, rating: null });
    }
  };

  const fetchLocation = () => {
    setLocationError(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setLocationError(null);
        },
        () => {
          setLocationError("Could not get location. Enable GPS.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationError("Geolocation is not supported by this browser.");
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setSubmitError(null);

    let newErrors: any = {};
    if (!shopName.trim()) newErrors.shopName = "Please enter your shop name.";
    if (mobileNumber.length !== 10) newErrors.mobileNumber = "Mobile number must contain exactly 10 digits.";
    
    const parsedRating = rating ? parseFloat(rating) : 5.0;
    if (isNaN(parsedRating) || parsedRating < 0 || parsedRating > 5) {
      newErrors.rating = "Rating must be between 0 and 5.";
    }
    
    if (latitude === null || longitude === null) {
      setLocationError("Please capture your shop location before continuing.");
      return;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    const res = await addShop({
      name: shopName.trim(),
      rating: parsedRating,
      latitude,
      longitude,
      store: storeType.trim(),
      owner_id: ownerId,
      mobile_number: mobileNumber
    });

    setIsSubmitting(false);

    if (res.success) {
      router.push("/owner"); 
    } else {
      setSubmitError("We couldn't save your shop details. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex justify-center py-10 md:py-16 px-6 font-sans">
      <div className="w-full max-w-md flex flex-col relative pb-10">
        
        {/* HEADER */}
        <h1 className="text-[28px] leading-[34px] font-bold text-center mb-2 text-[#121212]">
          Set Up Your Shop
        </h1>
        <p className="text-[16px] text-[#757575] text-center mb-8">
          Let's get your business online.
        </p>

        {/* FORM INPUTS */}
        <div className="flex flex-col gap-4">
          
          <div>
            <input 
              placeholder="Shop Name" 
              value={shopName} 
              onChange={e => setShopName(e.target.value)} 
              className={`h-[56px] bg-[#E0E0E0]/30 rounded-[12px] px-4 w-full outline-none text-[16px] text-[#121212] transition-all ${errors.shopName ? 'border border-[#B00020]' : 'border border-transparent focus:border-[#6200EE]/50'}`} 
            />
            {errors.shopName && <p className="text-[#B00020] text-[12px] mt-1.5 ml-2">{errors.shopName}</p>}
          </div>

          <div>
            <input 
              placeholder="Mobile Number" 
              value={mobileNumber} 
              onChange={e => handleMobileChange(e.target.value)} 
              maxLength={10}
              type="tel"
              className={`h-[56px] bg-[#E0E0E0]/30 rounded-[12px] px-4 w-full outline-none text-[16px] text-[#121212] transition-all ${errors.mobileNumber ? 'border border-[#B00020]' : 'border border-transparent focus:border-[#6200EE]/50'}`} 
            />
            {errors.mobileNumber ? (
              <p className="text-[#B00020] text-[12px] mt-1.5 ml-2">{errors.mobileNumber}</p>
            ) : (
              <p className="text-[#757575] text-[12px] mt-1.5 ml-2">Enter a 10-digit mobile number.</p>
            )}
          </div>

          <div>
            <input 
              placeholder="Initial Rating (0-5)" 
              value={rating} 
              onChange={e => handleRatingChange(e.target.value)} 
              type="number" 
              step="0.1" 
              className={`h-[56px] bg-[#E0E0E0]/30 rounded-[12px] px-4 w-full outline-none text-[16px] text-[#121212] transition-all ${errors.rating ? 'border border-[#B00020]' : 'border border-transparent focus:border-[#6200EE]/50'}`} 
            />
            {errors.rating ? (
              <p className="text-[#B00020] text-[12px] mt-1.5 ml-2">{errors.rating}</p>
            ) : (
              <p className="text-[#757575] text-[12px] mt-1.5 ml-2">Enter a rating between 0 and 5.</p>
            )}
          </div>

          <div>
            <input 
              placeholder="Store Type (e.g. Grocery)" 
              value={storeType} 
              onChange={e => setStoreType(e.target.value)} 
              className="h-[56px] bg-[#E0E0E0]/30 rounded-[12px] px-4 w-full outline-none text-[16px] text-[#121212] border border-transparent focus:border-[#6200EE]/50 transition-all" 
            />
          </div>
        </div>

        {/* DIVIDER */}
        <div className="my-6 border-t border-[#E0E0E0]/50"></div>

        {/* LOCATION SECTION */}
        <div className="flex flex-col items-center">
          <h2 className="text-[16px] font-semibold text-[#121212]">Shop Location</h2>
          
          {locationError && (
            <p className="text-[#B00020] text-[12px] mt-1 text-center">{locationError}</p>
          )}
          
          {latitude !== null && longitude !== null && (
            <p className="text-[#10B981] font-bold text-[14px] mt-1">✅ Location Captured!</p>
          )}

          <button 
            onClick={fetchLocation} 
            className="w-full h-[56px] border border-[#757575]/50 rounded-[12px] text-[16px] font-medium mt-3 text-[#6200EE] bg-transparent transition-all hover:bg-[#6200EE]/5 active:scale-[0.98] flex items-center justify-center"
          >
            Use Current Location
          </button>
        </div>

        {/* SUBMIT BUTTON */}
        <button 
          onClick={handleSubmit} 
          disabled={isSubmitting} 
          className="w-full h-[56px] bg-[#03DAC5] text-black rounded-[12px] font-bold text-[16px] mt-6 transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </div>
          ) : "Save & Finish"}
        </button>
        
        {submitError && <p className="text-[#B00020] text-center mt-4 text-[14px]">{submitError}</p>}
      </div>
    </div>
  );
}