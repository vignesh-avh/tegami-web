"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GoogleLogin } from "@react-oauth/google";
import { signupUser, verifyOtp, setToken, googleAuth } from "../../lib/api";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") || "customer"; 

  const [form, setForm] = useState({ fullName: "", email: "", city: "", password: "", mobileNumber: "" });
  const [errors, setErrors] = useState<any>({});
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupMessage, setSignupMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [otp, setOtp] = useState("");
  const [tempToken, setTempToken] = useState("");

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: null });
  };

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    setSignupMessage(null);

    let newErrors: any = {};
    if (!form.fullName.trim()) newErrors.fullName = "Please enter your full name.";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) newErrors.email = "Please enter a valid email address.";
    if (!form.city.trim()) newErrors.city = "Please enter your city.";
    if (form.password.length < 8) newErrors.password = "Password must be at least 8 characters.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    const res = await signupUser({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      city: form.city.trim(),
      password: form.password,
      role: role,
      mobileNumber: form.mobileNumber
    });
    setIsLoading(false);

    if (res.success) {
      setIsOtpSent(true);
      setSignupMessage("Verification code sent to your email.");
    } else {
      setSignupError("We couldn't send the verification code. Please try again.");
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setErrors({ ...errors, otp: "Please enter the 6-digit code." });
      return;
    }
    setIsLoading(true);
    const res = await verifyOtp(form.email, otp);
    setIsLoading(false);

    if (res.success && res.token) {
      setTempToken(res.token);
      setIsOtpVerified(true);
      setSignupMessage("Email verified successfully.");
      setErrors({ ...errors, otp: null });
    } else {
      setErrors({ ...errors, otp: "Invalid or expired code." });
    }
  };

  const completeSignup = () => {
    if (!agreedToTerms) {
      setTermsError(true);
      return;
    }
    if (!tempToken) return;

    setToken(tempToken);
    router.push(role === "owner" ? "/owner/onboarding" : "/");
  };

  const handleGoogleSignup = () => {
    if (!agreedToTerms) {
      setTermsError(true);
      return;
    }
    setIsGoogleLoading(true);
    setTimeout(() => {
        setIsGoogleLoading(false);
    }, 2000);
  };

  const EyeIcon = () => (
    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );

  const EyeOffIcon = () => (
    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex justify-center py-10 md:py-16 px-6 font-sans">
      <div className="w-full max-w-md flex flex-col relative pb-6">
        
        <Link href="/welcome" className="text-[#6200EE] font-bold mb-8 text-left text-sm hover:underline">
          ← Back
        </Link>

        <h1 className="text-[24px] leading-[30px] font-semibold text-center mb-1.5 text-[#121212]">
          {role === "owner" ? "Create your Shop account" : "Create your Tegami account"}
        </h1>
        <p className="text-[#757575] text-center mb-7 text-[14px]">
          {role === "owner" ? "Set up your account to manage your shop." : "Find what's available nearby."}
        </p>

        <div className="flex flex-col gap-3">
          <div>
            <input 
              name="fullName" 
              placeholder="Full Name" 
              value={form.fullName} 
              onChange={handleChange} 
              disabled={isOtpSent} 
              className={`h-[56px] bg-[#E0E0E0]/30 rounded-[16px] px-4 w-full outline-none text-[16px] text-[#121212] transition-all disabled:opacity-50 ${errors.fullName ? 'border border-[#B00020]' : 'border border-transparent focus:border-[#6200EE]/50'}`} 
            />
            {errors.fullName && <p className="text-[#B00020] text-[12px] mt-1.5 ml-2">{errors.fullName}</p>}
          </div>
          
          <div>
            <input 
              name="email" 
              type="email" 
              placeholder="Email Address" 
              value={form.email} 
              onChange={handleChange} 
              disabled={isOtpSent} 
              className={`h-[56px] bg-[#E0E0E0]/30 rounded-[16px] px-4 w-full outline-none text-[16px] text-[#121212] transition-all disabled:opacity-50 ${errors.email ? 'border border-[#B00020]' : 'border border-transparent focus:border-[#6200EE]/50'}`} 
            />
            {errors.email && <p className="text-[#B00020] text-[12px] mt-1.5 ml-2">{errors.email}</p>}
          </div>

          <div>
            <input 
              name="city" 
              placeholder="City" 
              value={form.city} 
              onChange={handleChange} 
              disabled={isOtpSent} 
              className={`h-[56px] bg-[#E0E0E0]/30 rounded-[16px] px-4 w-full outline-none text-[16px] text-[#121212] transition-all disabled:opacity-50 ${errors.city ? 'border border-[#B00020]' : 'border border-transparent focus:border-[#6200EE]/50'}`} 
            />
            {errors.city && <p className="text-[#B00020] text-[12px] mt-1.5 ml-2">{errors.city}</p>}
          </div>

          <div>
            <div className="relative w-full">
              <input 
                name="password" 
                type={passwordVisible ? "text" : "password"} 
                placeholder="Password" 
                value={form.password} 
                onChange={handleChange} 
                disabled={isOtpSent} 
                className={`h-[56px] bg-[#E0E0E0]/30 rounded-[16px] px-4 pr-12 w-full outline-none text-[16px] text-[#121212] transition-all disabled:opacity-50 ${errors.password ? 'border border-[#B00020]' : 'border border-transparent focus:border-[#6200EE]/50'}`} 
              />
              <button 
                type="button" 
                onClick={() => setPasswordVisible(!passwordVisible)} 
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
                disabled={isOtpSent}
              >
                {passwordVisible ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
            {errors.password ? (
              <p className="text-[#B00020] text-[12px] mt-1.5 ml-2">{errors.password}</p>
            ) : (
              <p className="text-[#757575] text-[12px] mt-1.5 ml-2">Min 8 chars, 1 uppercase, 1 number</p>
            )}
          </div>
        </div>

        {signupMessage && <p className="text-[#6200EE] text-[14px] mt-2">{signupMessage}</p>}
        {signupError && <p className="text-[#B00020] text-[14px] mt-2">{signupError}</p>}

        {isOtpSent && !isOtpVerified && (
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <input 
                placeholder="Enter 6-Digit OTP" 
                value={otp} 
                onChange={e => setOtp(e.target.value)} 
                maxLength={6} 
                className={`h-[56px] bg-[#E0E0E0]/30 rounded-[16px] px-4 w-full outline-none text-[16px] text-[#121212] transition-all ${errors.otp ? 'border border-[#B00020]' : 'border border-transparent focus:border-[#6200EE]/50'}`} 
              />
              {errors.otp && <p className="text-[#B00020] text-[12px] mt-1.5 ml-2">{errors.otp}</p>}
            </div>
            <button 
              onClick={handleVerifyOtp} 
              disabled={isLoading || isOtpVerified} 
              className="bg-[#6200EE] text-white rounded-[16px] h-[56px] font-bold text-[16px] w-full transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Verifying...
                </div>
              ) : "Verify & Continue"}
            </button>
          </div>
        )}

        <div className="mt-6">
          <label className="flex items-start gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={agreedToTerms} 
              onChange={e => { setAgreedToTerms(e.target.checked); setTermsError(false); }} 
              className={`mt-0.5 w-[18px] h-[18px] rounded border-gray-300 text-[#6200EE] focus:ring-[#6200EE] ${termsError ? 'border-[#B00020] ring-1 ring-[#B00020]' : ''}`} 
            />
            <span className="text-[14px] text-[#757575] leading-[20px]">
              I agree to the{" "}
              <a href="https://sites.google.com/view/teg-gami/terms-of-service?authuser=0" target="_blank" rel="noopener noreferrer" className="text-[#6200EE] font-bold hover:underline">Terms of Services</a>
              {" "}and{" "}
              <a href="https://sites.google.com/view/teg-gami/privacy-policy?authuser=0" target="_blank" rel="noopener noreferrer" className="text-[#6200EE] font-bold hover:underline">Privacy Policy</a>
            </span>
          </label>
          {termsError && <p className="text-[#B00020] text-[12px] mt-1.5 ml-[26px]">Please agree to the Terms & Privacy Policy to continue.</p>}
        </div>

        <div className="mt-3">
          {!isOtpSent ? (
            <button 
              onClick={requestOtp} 
              disabled={isLoading || isGoogleLoading} 
              className="bg-[#03DAC5] text-black rounded-[16px] h-[56px] font-bold text-[16px] w-full transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  Sending OTP...
                </div>
              ) : "Get OTP"}
            </button>
          ) : (
            <button 
              onClick={completeSignup} 
              disabled={isLoading || !isOtpVerified || isGoogleLoading} 
              className={`bg-[#03DAC5] text-black rounded-[16px] h-[56px] font-bold text-[16px] w-full transition-transform active:scale-[0.98] flex items-center justify-center ${!isOtpVerified ? 'opacity-50' : ''}`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  Creating account...
                </div>
              ) : "Complete Signup"}
            </button>
          )}
        </div>

        <div className="flex items-center py-4 space-x-4">
          <div className="flex-1 h-px bg-[#E0E0E0]/50"></div>
          <span className="text-[#757575] text-[14px]">or</span>
          <div className="flex-1 h-px bg-[#E0E0E0]/50"></div>
        </div>

        <div className={`relative w-full ${!agreedToTerms ? 'pointer-events-none' : ''}`}>
        <div className="w-full flex flex-col items-center">
          {!agreedToTerms && (
            <p className="text-[#B00020] text-[12px] mb-2 text-center">
              Please agree to the Terms to continue with Google.
            </p>
          )}
          <div className={!agreedToTerms ? 'opacity-50 pointer-events-none' : ''}>
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                if (!credentialResponse.credential) return;
                setIsGoogleLoading(true);
                const res = await googleAuth({ token: credentialResponse.credential, role });
                setIsGoogleLoading(false);
                if (res.success) {
                  router.push(role === "owner" ? "/owner/onboarding" : "/");
                } else {
                  setSignupError("Google signup failed. Please try again.");
                }
              }}
              onError={() => setSignupError("Google signup failed.")}
              theme="outline"
              size="large"
              width="380"
              shape="pill"
              text="signup_with"
            />
          </div>
        </div>
          
          {!isLoading && !isGoogleLoading && agreedToTerms && (
            <div className="absolute inset-0 opacity-0 overflow-hidden cursor-pointer flex justify-center items-center">
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  if (!credentialResponse.credential) return;
                  setIsGoogleLoading(true);
                  const res = await googleAuth({ token: credentialResponse.credential, role });
                  setIsGoogleLoading(false);
                  if (res.success) {
                    router.push(role === "owner" ? "/owner/onboarding" : "/");
                  } else {
                    setSignupError("Google signup failed. Please try again.");
                  }
                }}
                onError={() => setSignupError("Google signup failed.")}
                width="400"
              />
            </div>
          )}
        </div>

        <div className="mt-5 text-center text-[14px] text-[#757575]">
          Already have an account? <Link href={role === "owner" ? "/owner/login" : "/login"} className="text-[#6200EE] font-bold hover:underline">Log In</Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#F5F5F5]"></div>}><SignupContent /></Suspense>;
}