"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginUser, forgotPasswordAPI } from "../../lib/api";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOwner = searchParams.get("role") === "owner";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setEmailError(null);
    setPasswordError(null);

    if (!email.trim()) { setEmailError("Please enter your email address."); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setEmailError("Please enter a valid email address."); return; }
    if (!password) { setPasswordError("Please enter your password."); return; }

    setIsLoading(true);
    const res = await loginUser({ email: email.trim(), password });
    setIsLoading(false);

    if (res.success) {
      if (isOwner) {
        router.push("/owner");
      } else {
        router.push("/");
      }
    } else {
      if (res.status === 400 || res.status === 401) setLoginError("Incorrect email or password. Please check your details and try again.");
      else if (res.status === 429) setLoginError("Too many login attempts. Please wait a moment and try again.");
      else setLoginError("Unable to log in right now. Please try again.");
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) return;
    const res = await forgotPasswordAPI(forgotEmail);
    if (res.success) setForgotMessage("Reset code sent to your email.");
    else setForgotMessage("Failed to send reset code. Please check the email.");
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

  if (showForgot) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex justify-center py-10 md:py-16 px-6 font-sans">
        <div className="w-full max-w-md flex flex-col">
          <button onClick={() => setShowForgot(false)} className="text-[#6200EE] font-bold mb-8 text-left text-sm hover:underline">
            ← Back to Login
          </button>
          <h1 className="text-[24px] leading-[30px] font-semibold text-center mb-1.5 text-[#121212]">Reset Password</h1>
          <p className="text-[#757575] text-center mb-7 text-[14px]">Enter your email to receive a reset code.</p>
          
          <input 
            type="email" 
            placeholder="Email Address" 
            value={forgotEmail} 
            onChange={e => setForgotEmail(e.target.value)} 
            className="h-[56px] bg-[#E0E0E0]/30 rounded-[16px] px-4 w-full outline-none text-[16px] text-[#121212] border border-transparent focus:border-[#6200EE]/50 mb-4 transition-all" 
          />
          {forgotMessage && <p className="text-[#6200EE] text-[14px] mb-4">{forgotMessage}</p>}
          
          <button onClick={handleForgotPassword} className="bg-[#6200EE] text-white rounded-[16px] h-[56px] font-bold w-full text-[16px] transition-transform active:scale-[0.98] mt-2">
            Send Reset Code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex justify-center py-10 md:py-16 px-6 font-sans">
      <div className="w-full max-w-md flex flex-col relative">
        
        <Link href="/" className="text-[#6200EE] font-bold mb-8 text-left text-sm hover:underline">
          ← Back to Home
        </Link>
        
        <h1 className="text-[24px] leading-[30px] font-semibold text-center mb-1.5 text-[#121212]">Welcome back</h1>
        <p className="text-[#757575] text-center mb-7 text-[14px]">Sign in to continue with Tegami.</p>

        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <div>
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className={`h-[56px] bg-[#E0E0E0]/30 rounded-[16px] px-4 w-full outline-none text-[16px] text-[#121212] transition-all ${emailError ? 'border border-[#B00020]' : 'border border-transparent focus:border-[#6200EE]/50'}`} 
            />
            {emailError && <p className="text-[#B00020] text-[12px] mt-1.5 ml-2">{emailError}</p>}
          </div>
          
          <div>
            <div className="relative w-full">
              <input 
                type={passwordVisible ? "text" : "password"} 
                placeholder="Password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className={`h-[56px] bg-[#E0E0E0]/30 rounded-[16px] px-4 pr-12 w-full outline-none text-[16px] text-[#121212] transition-all ${passwordError ? 'border border-[#B00020]' : 'border border-transparent focus:border-[#6200EE]/50'}`} 
              />
              <button 
                type="button" 
                onClick={() => setPasswordVisible(!passwordVisible)} 
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
              >
                {passwordVisible ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
            {passwordError && <p className="text-[#B00020] text-[12px] mt-1.5 ml-2">{passwordError}</p>}
          </div>

          {loginError && <p className="text-[#B00020] text-[14px] text-left w-full mt-1">{loginError}</p>}

          <div className="flex justify-end w-full mt-1">
            <button type="button" onClick={() => setShowForgot(true)} className="text-[#6200EE] font-semibold text-[14px] hover:underline">
              Forgot Password?
            </button>
          </div>

          <button 
            type="submit" 
            disabled={isLoading || isGoogleLoading} 
            className="bg-[#6200EE] text-white rounded-[16px] h-[56px] font-bold text-[16px] w-full mt-5 flex items-center justify-center transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Logging in...
              </div>
            ) : "Log In"}
          </button>
        </form>

        <div className="flex items-center py-4 space-x-4">
          <div className="flex-1 h-px bg-[#E0E0E0]/50"></div>
          <span className="text-[#757575] text-[14px]">or</span>
          <div className="flex-1 h-px bg-[#E0E0E0]/50"></div>
        </div>

        <button 
          type="button"
          onClick={() => {
            setIsGoogleLoading(true);
            setTimeout(() => setIsGoogleLoading(false), 2000); // Placeholder
          }}
          disabled={isLoading || isGoogleLoading}
          className="border border-[#757575]/50 rounded-[16px] h-[56px] font-medium text-[16px] w-full text-[#121212] bg-transparent flex items-center justify-center transition-all hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50"
        >
          {isGoogleLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-[#121212] border-t-transparent rounded-full animate-spin"></div>
              Signing in...
            </div>
          ) : "Sign in with Google"}
        </button>

        <div className="mt-5 text-center text-[14px] text-[#757575] pb-6">
          Don't have an account?{" "}
          <Link href={isOwner ? "/owner/signup" : "/signup"} className="text-[#6200EE] font-bold hover:underline">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center"><div className="w-10 h-10 border-4 border-[#6200EE] border-t-transparent rounded-full animate-spin"></div></div>}>
      <LoginContent />
    </Suspense>
  );
}