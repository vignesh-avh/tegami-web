"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginUser } from "../../../lib/api";

export default function OwnerLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      router.push("/owner");
    } else {
      if (res.status === 400 || res.status === 401) setLoginError("Incorrect email or password.");
      else setLoginError("Unable to log in right now. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col px-6 py-8 relative">
      <Link href="/" className="text-avPrimary font-bold mb-8 text-left text-sm">← Back to Home</Link>
      
      <h1 className="text-2xl font-semibold text-center mb-2 text-black">Owner Login</h1>
      <p className="text-gray-500 text-center mb-8 text-sm">Sign in to manage your shop.</p>

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

        <button type="submit" disabled={isLoading} className="bg-avPrimary text-white rounded-2xl h-14 font-bold w-full mt-4 flex items-center justify-center disabled:opacity-50">
          {isLoading ? "Logging in..." : "Log In"}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-gray-500">
        Don't have a shop account?{" "}
        <Link href="/owner/signup" className="text-avPrimary font-bold">
          Sign Up
        </Link>
      </div>
    </div>
  );
}