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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setLocationError(null);
        },
        () => {
          setLocationError("Could not get location. Enable GPS.");
        }
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
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col px-6 py-8">
      <h1 className="text-2xl font-bold text-center mb-2 text-black">Set Up Your Shop</h1>
      <p className="text-gray-500 text-center mb-8 text-sm">Let's get your business online.</p>

      <div className="space-y-4">
        <div>
          <input placeholder="Shop Name" value={shopName} onChange={e => setShopName(e.target.value)} className={`bg-gray-200/50 rounded-xl px-4 py-4 w-full outline-none ${errors.shopName ? 'border border-red-500' : ''}`} />
          {errors.shopName && <p className="text-red-500 text-xs mt-1 ml-2">{errors.shopName}</p>}
        </div>
        <div>
          <input placeholder="Mobile Number" value={mobileNumber} onChange={e => handleMobileChange(e.target.value)} maxLength={10} className={`bg-gray-200/50 rounded-xl px-4 py-4 w-full outline-none ${errors.mobileNumber ? 'border border-red-500' : ''}`} />
          {errors.mobileNumber ? <p className="text-red-500 text-xs mt-1 ml-2">{errors.mobileNumber}</p> : <p className="text-gray-500 text-xs mt-1 ml-2">Enter a 10-digit mobile number.</p>}
        </div>
        <div>
          <input placeholder="Initial Rating (0-5)" value={rating} onChange={e => handleRatingChange(e.target.value)} type="number" step="0.1" className={`bg-gray-200/50 rounded-xl px-4 py-4 w-full outline-none ${errors.rating ? 'border border-red-500' : ''}`} />
          {errors.rating ? <p className="text-red-500 text-xs mt-1 ml-2">{errors.rating}</p> : <p className="text-gray-500 text-xs mt-1 ml-2">Enter a rating between 0 and 5.</p>}
        </div>
        <div>
          <input placeholder="Store Type (e.g. Grocery)" value={storeType} onChange={e => setStoreType(e.target.value)} className="bg-gray-200/50 rounded-xl px-4 py-4 w-full outline-none" />
        </div>
      </div>

      <div className="my-8 border-t border-gray-300"></div>

      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold text-black">Shop Location</h2>
        {locationError && <p className="text-red-500 text-sm">{locationError}</p>}
        {latitude && longitude && <p className="text-green-500 font-bold text-sm">✅ Location Captured!</p>}
      </div>

      <button onClick={fetchLocation} className="w-full border border-gray-400 rounded-xl h-14 font-medium mt-4 text-avPrimary bg-white">
        Use Current Location
      </button>

      <button onClick={handleSubmit} disabled={isSubmitting} className="w-full bg-avSecondary text-black rounded-xl h-14 font-bold mt-8 disabled:opacity-50">
        {isSubmitting ? "Saving..." : "Save & Finish"}
      </button>
      
      {submitError && <p className="text-red-500 text-center mt-4 text-sm">{submitError}</p>}
    </div>
  );
}