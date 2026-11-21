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

  if (showForgot) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex flex-col px-6 py-8">
        <button onClick={() => setShowForgot(false)} className="text-avPrimary font-bold mb-8 text-left">← Back to Login</button>
        <h1 className="text-2xl font-semibold text-center mb-2">Reset Password</h1>
        <p className="text-gray-500 text-center mb-8 text-sm">Enter your email to receive a reset code.</p>
        
        <input type="email" placeholder="Email Address" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className="bg-gray-200/50 rounded-2xl px-4 py-4 w-full outline-none mb-4" />
        {forgotMessage && <p className="text-avPrimary text-sm mb-4">{forgotMessage}</p>}
        
        <button onClick={handleForgotPassword} className="bg-avPrimary text-white rounded-2xl h-14 font-bold w-full">Send Reset Code</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col px-6 py-8 relative">
      <Link href="/" className="text-avPrimary font-bold mb-8 text-left text-sm">← Back to Home</Link>
      
      <h1 className="text-2xl font-semibold text-center mb-2 text-black">Welcome back</h1>
      <p className="text-gray-500 text-center mb-8 text-sm">Sign in to continue with Tegami.</p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className={`bg-gray-200/50 rounded-2xl px-4 py-4 w-full outline-none ${emailError ? 'border border-red-500' : ''}`} />
          {emailError && <p className="text-red-500 text-xs mt-1 ml-2">{emailError}</p>}
        </div>
        <div className="relative">
          <input type={passwordVisible ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className={`bg-gray-200/50 rounded-2xl px-4 py-4 w-full outline-none pr-12 ${passwordError ? 'border border-red-500' : ''}`} />
          <button type="button" onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-4 top-4 text-gray-500 text-sm font-semibold">
             {passwordVisible ? "Hide" : "Show"}
          </button>
          {passwordError && <p className="text-red-500 text-xs mt-1 ml-2">{passwordError}</p>}
        </div>

        {loginError && <p className="text-red-500 text-sm text-left w-full">{loginError}</p>}

        <div className="flex justify-end w-full">
          <button type="button" onClick={() => setShowForgot(true)} className="text-avPrimary font-semibold text-sm">Forgot Password?</button>
        </div>

        <button type="submit" disabled={isLoading} className="bg-avPrimary text-white rounded-2xl h-14 font-bold w-full mt-4 flex items-center justify-center disabled:opacity-50">
          {isLoading ? "Logging in..." : "Log In"}
        </button>
      </form>

      <div className="flex items-center my-6 space-x-4">
        <div className="flex-1 h-px bg-gray-300"></div>
        <span className="text-gray-500 text-sm">or</span>
        <div className="flex-1 h-px bg-gray-300"></div>
      </div>

      <button className="border border-gray-300 rounded-2xl h-14 font-medium w-full text-black">
        Sign in with Google
      </button>

      <div className="mt-8 text-center text-sm text-gray-500">
        Don't have an account?{" "}
        <Link href={isOwner ? "/owner/signup" : "/signup"} className="text-avPrimary font-bold">
          Sign Up
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center"><div className="w-10 h-10 border-4 border-avPrimary border-t-transparent rounded-full animate-spin"></div></div>}>
      <LoginContent />
    </Suspense>
  );
}