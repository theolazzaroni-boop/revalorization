"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
    } else {
      router.push("/portal/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Espace fournisseur</h1>
        <p className="text-sm text-gray-500 mt-1">Connectez-vous pour accéder à vos demandes</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            placeholder="vous@entreprise.fr"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium transition"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-6">
        Pas encore de compte ? Utilisez le lien d&apos;invitation reçu par email.
      </p>
    </div>
  );
}
