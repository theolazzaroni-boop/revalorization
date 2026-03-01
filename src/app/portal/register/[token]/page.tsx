"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client"; // pour signIn après création

export default function PortalRegisterPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [partnerName, setPartnerName] = useState("");
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/portal/${token}/info`)
      .then((r) => r.json())
      .then((data) => {
        if (data.partnerName) {
          setPartnerName(data.partnerName);
          setTokenValid(!data.hasAccount);
          if (data.hasAccount) {
            router.replace("/portal/login");
          }
        } else {
          setTokenValid(false);
        }
      })
      .catch(() => setTokenValid(false));
  }, [token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);
    setError("");

    // 1. Créer le compte côté serveur (admin, sans confirmation email)
    const registerRes = await fetch("/api/portal/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email, password }),
    });

    if (!registerRes.ok) {
      const data = await registerRes.json();
      setError(data.error ?? "Erreur lors de la création du compte.");
      setLoading(false);
      return;
    }

    // 2. Se connecter immédiatement
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Compte créé, mais erreur de connexion. Essayez de vous connecter.");
      setLoading(false);
      return;
    }

    router.push("/portal/dashboard");
    router.refresh();
  }

  if (tokenValid === null) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">Vérification du lien...</div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-700 font-medium">Lien invalide ou expiré.</p>
        <p className="text-sm text-gray-500 mt-2">Contactez votre gestionnaire pour obtenir un nouveau lien.</p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Créer votre compte</h1>
        <p className="text-sm text-gray-500 mt-1">
          Compte fournisseur pour <span className="font-medium text-gray-700">{partnerName}</span>
        </p>
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
            placeholder="Min. 8 caractères"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le mot de passe</label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
          {loading ? "Création du compte..." : "Créer mon compte"}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-6">
        Déjà un compte ?{" "}
        <a href="/portal/login" className="text-emerald-600 hover:underline">Se connecter</a>
      </p>
    </div>
  );
}
