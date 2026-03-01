import { createClient } from "@/lib/supabase/server";
import PortalHeader from "@/components/PortalHeader";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeader userEmail={user?.email} />
      <main className="max-w-2xl mx-auto px-4 py-10">
        {children}
      </main>
    </div>
  );
}
