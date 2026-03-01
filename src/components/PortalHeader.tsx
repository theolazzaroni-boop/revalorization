"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PortalHeader({ userEmail }: { userEmail?: string }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900 text-sm">Revalorization</span>
        </div>

        {userEmail && (
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 hidden sm:block">{userEmail}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
            >
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
