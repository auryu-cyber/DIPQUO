"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex relative overflow-hidden bg-gradient-to-br from-knt-ivory via-knt-pale-blue to-knt-blue-gray">
      <div className="absolute left-0 top-0 bottom-0 w-9 bg-gradient-to-b from-knt-navy to-knt-blue rounded-r-2xl" />

      <div className="flex-1 flex items-center justify-center px-16 py-16">
        <div className="w-full max-w-md bg-white rounded-[20px] shadow-xl p-10 flex flex-col items-center gap-7">
          <div className="flex flex-col items-center gap-1.5">
            <svg width="76" height="52" viewBox="0 0 76 52" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="72" height="48" rx="12" stroke="#41B6E6" strokeWidth="3.5" />
              <text
                x="38"
                y="33"
                textAnchor="middle"
                fontFamily="var(--font-quicksand), sans-serif"
                fontWeight="700"
                fontSize="24"
                fill="#41B6E6"
              >
                KNT
              </text>
            </svg>
            <div className="font-heading text-xs italic text-knt-navy tracking-wide">
              K.U. Nomura Thai
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 text-center">
            <div className="font-heading text-2xl font-bold text-knt-navy">DIP Quotation System</div>
            <div className="text-sm text-gray-500 leading-relaxed">
              An internal tool for centralized cost calculation
              <br />
              and quotation for dip-molded products
            </div>
          </div>

          <button
            onClick={() => signIn("google", { callbackUrl: "/quotes" })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-[10px] border border-knt-pale-blue bg-white shadow-sm hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.9 5.1 29.7 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.4-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.6 15.6 18.9 12.5 24 12.5c3.1 0 5.8 1.1 8 3l6-6C34.9 5.1 29.7 3 24 3 16 3 9.1 7.7 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 45c5.6 0 10.7-2.1 14.5-5.5l-6.7-5.7C29.6 35.5 26.9 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9 40.3 15.9 45 24 45z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.7 5.7C41.8 35.9 45 30.5 45 24c0-1.2-.1-2.4-.4-3.5z"
              />
            </svg>
            <span className="text-sm font-medium text-gray-700">Sign in with Google</span>
          </button>

          <div className="text-[11px] text-gray-400 text-center leading-relaxed">
            Please sign in with your kunomura.com
            <br />
            Google Workspace account
          </div>
        </div>
      </div>

      <div className="absolute left-16 bottom-6 text-[11px] text-knt-brown">
        © K.U. Nomura Thai Ltd. — Internal Use Only
      </div>
    </div>
  );
}
