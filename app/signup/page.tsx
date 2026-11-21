"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signupUser, verifyOtp, setToken, setRefreshToken } from "../../lib/api";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") || "customer"; 
  const isOwner = role === "owner";

  const [form, setForm] = useState({ fullName: "", email: "", city: "", password: "", mobileNumber: "" });
  const [errors, setErrors] = useState<any>({});
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupMessage, setSignupMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [otp, setOtp] = useState("");
  const [tempToken, setTempToken] = useState("");

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);

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
    else if (!form.password.match(/\d/)) newErrors.password = "Password must contain at least one number.";
    else if (!form.password.match(/[A-Z]/)) newErrors.password = "Password must contain at least one uppercase letter.";

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
      setSignupMessage("Verification code sent to your email. Check your inbox and spam folder.");
    } else if (res.status === 409) {
      setSignupError("An account with this email may already exist. Try logging in.");
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
      setSignupMessage("Email verified successfully. You can now complete your signup.");
      setErrors({ ...errors, otp: null });
    } else {
      setErrors({ ...errors, otp: "Invalid or expired verification code." });
    }
  };

  const completeSignup = () => {
    if (!agreedToTerms) {
      setTermsError(true);
      return;
    }
    if (!tempToken) return;

    setToken(tempToken);
    // Save refresh token if you have it stored, else just access
    router.push(isOwner ? "/owner" : "/");
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col px-6 py-8">
      <Link href={isOwner ? "/owner/login" : "/login"} className="text-avPrimary font-bold mb-8 text-left text-sm">← Back to Login</Link>

      <h1 className="text-2xl font-semibold text-center mb-2 text-black">
        {isOwner ? "Create your Shop account" : "Create your Tegami account"}
      </h1>
      <p className="text-gray-500 text-center mb-8 text-sm">
        {isOwner ? "Set up your account to manage your shop." : "Find what's available nearby."}
      </p>

      <div className="space-y-4">
        <div>
          <input name="fullName" placeholder="Full Name" value={form.fullName} onChange={handleChange} disabled={isOtpSent} className={`bg-gray-200/50 rounded-2xl px-4 py-4 w-full outline-none ${errors.fullName ? 'border border-red-500' : ''}`} />
          {errors.fullName && <p className="text-red-500 text-xs mt-1 ml-2">{errors.fullName}</p>}
        </div>
        
        <div>
          <input name="email" type="email" placeholder="Email Address" value={form.email} onChange={handleChange} disabled={isOtpSent} className={`bg-gray-200/50 rounded-2xl px-4 py-4 w-full outline-none ${errors.email ? 'border border-red-500' : ''}`} />
          {errors.email && <p className="text-red-500 text-xs mt-1 ml-2">{errors.email}</p>}
        </div>

        <div>
          <input name="city" placeholder="City" value={form.city} onChange={handleChange} disabled={isOtpSent} className={`bg-gray-200/50 rounded-2xl px-4 py-4 w-full outline-none ${errors.city ? 'border border-red-500' : ''}`} />
          {errors.city && <p className="text-red-500 text-xs mt-1 ml-2">{errors.city}</p>}
        </div>

        <div>
          <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} disabled={isOtpSent} className={`bg-gray-200/50 rounded-2xl px-4 py-4 w-full outline-none ${errors.password ? 'border border-red-500' : ''}`} />
          {errors.password ? <p className="text-red-500 text-xs mt-1 ml-2">{errors.password}</p> : <p className="text-gray-500 text-xs mt-1 ml-2">Min 8 chars, 1 uppercase, 1 number</p>}
        </div>
      </div>

      {signupMessage && <p className="text-avPrimary text-sm mt-4">{signupMessage}</p>}
      {signupError && <p className="text-red-500 text-sm mt-4">{signupError}</p>}

      {/* OTP SECTION */}
      {isOtpSent && !isOtpVerified && (
        <div className="mt-6 space-y-4">
          <input placeholder="Enter 6-Digit OTP" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} className={`bg-gray-200/50 rounded-2xl px-4 py-4 w-full outline-none ${errors.otp ? 'border border-red-500' : ''}`} />
          {errors.otp && <p className="text-red-500 text-xs ml-2">{errors.otp}</p>}
          <button onClick={handleVerifyOtp} disabled={isLoading} className="bg-avPrimary text-white rounded-2xl h-14 font-bold w-full">
            {isLoading ? "Verifying..." : "Verify & Continue"}
          </button>
        </div>
      )}

      {/* TERMS */}
      <div className="mt-6">
        <label className="flex items-start space-x-2 cursor-pointer">
          <input type="checkbox" checked={agreedToTerms} onChange={e => { setAgreedToTerms(e.target.checked); setTermsError(false); }} className="mt-1 w-4 h-4 text-avPrimary" />
          <span className="text-sm text-gray-600">
            I agree to the <a href="#" className="text-avPrimary font-bold">Terms of Services</a> and <a href="#" className="text-avPrimary font-bold">Privacy Policy</a>
          </span>
        </label>
        {termsError && <p className="text-red-500 text-xs mt-1 ml-6">Please agree to the Terms & Privacy Policy to continue.</p>}
      </div>

      {/* ACTION BUTTON */}
      <div className="mt-6">
        {!isOtpSent ? (
          <button onClick={requestOtp} disabled={isLoading} className="bg-avSecondary text-black rounded-2xl h-14 font-bold w-full">
            {isLoading ? "Sending OTP..." : "Get OTP"}
          </button>
        ) : (
          <button onClick={completeSignup} disabled={isLoading || !isOtpVerified} className={`bg-avSecondary text-black rounded-2xl h-14 font-bold w-full ${!isOtpVerified ? 'opacity-50' : ''}`}>
            {isLoading ? "Creating account..." : "Complete Signup"}
          </button>
        )}
      </div>

      <div className="flex items-center my-6 space-x-4">
        <div className="flex-1 h-px bg-gray-300"></div>
        <span className="text-gray-500 text-sm">or</span>
        <div className="flex-1 h-px bg-gray-300"></div>
      </div>

      <button className="border border-gray-300 rounded-2xl h-14 font-medium w-full text-black">
        Continue with Google
      </button>

      <div className="mt-8 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href={isOwner ? "/owner/login" : "/login"} className="text-avPrimary font-bold">
          Log In
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#F5F5F5]"></div>}><SignupContent /></Suspense>;
}