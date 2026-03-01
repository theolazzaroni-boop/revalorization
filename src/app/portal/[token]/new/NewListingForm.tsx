"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

type Category = {
  value: string;
  label: string;
  icon: string;
  description: string;
};

type Condition = { value: string; label: string; icon: string };
type Unit = { value: string; label: string };

// ─── Données statiques ───────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  { value: "PLASTIC",    label: "Plastique",      icon: "♻️",  description: "PET, HDPE, films, granulés..." },
  { value: "METAL",      label: "Métal",          icon: "⚙️",  description: "Ferraille, aluminium, cuivre..." },
  { value: "WOOD",       label: "Bois",           icon: "🪵",  description: "Palettes, chutes, sciure..." },
  { value: "ELECTRONIC", label: "Électronique",   icon: "💻",  description: "DEEE, câbles, composants..." },
  { value: "PAPER",      label: "Papier / Carton", icon: "📦", description: "Cartons, journaux, archives..." },
  { value: "GLASS",      label: "Verre",          icon: "🔷",  description: "Bouteilles, vitrage, cristal..." },
  { value: "TEXTILE",    label: "Textile",        icon: "👕",  description: "Vêtements, chiffons, fibres..." },
  { value: "OTHER",      label: "Autre",          icon: "🗃️",  description: "Autre type de matière..." },
];

const CONDITIONS: Condition[] = [
  { value: "clean",     label: "Propre",              icon: "✅" },
  { value: "light",     label: "Légèrement souillé",  icon: "⚠️" },
  { value: "dirty",     label: "Souillé",             icon: "🔴" },
];

const UNITS: Unit[] = [
  { value: "KG",    label: "Kilogrammes (kg)" },
  { value: "TONNE", label: "Tonnes (t)" },
  { value: "M3",    label: "Mètres cubes (m³)" },
  { value: "UNIT",  label: "Unités" },
];

// ─── Composant ───────────────────────────────────────────────────────────────

type Props = { token: string; partnerName: string };

type FormData = {
  category: string;
  condition: string;
  quantity: string;
  unit: string;
  description: string;
  locationAddress: string;
  preferredDate: string;
};

const INITIAL: FormData = {
  category: "",
  condition: "",
  quantity: "",
  unit: "TONNE",
  description: "",
  locationAddress: "",
  preferredDate: "",
};

const STEPS = ["Matière", "Quantité", "Détails", "Récapitulatif"];

export default function NewListingForm({ token, partnerName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canNext = () => {
    if (step === 0) return !!form.category;
    if (step === 1) return !!form.condition && !!form.quantity;
    if (step === 2) return !!form.locationAddress;
    return true;
  };

  async function handleSubmit() {
    setSubmitting(true);
    const res = await fetch(`/api/portal/${token}/listings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setSubmitted(true);
    } else {
      alert("Une erreur est survenue, veuillez réessayer.");
    }
    setSubmitting(false);
  }

  // ── Confirmation ──
  if (submitted) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Demande envoyée !</h2>
        <p className="text-gray-500 mb-8">
          Notre équipe va examiner votre demande et vous contactera pour planifier la collecte.
        </p>
        <button
          onClick={() => { setForm(INITIAL); setStep(0); setSubmitted(false); }}
          className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition"
        >
          Déposer une autre demande
        </button>
      </div>
    );
  }

  const category = CATEGORIES.find((c) => c.value === form.category);

  return (
    <div>
      {/* En-tête */}
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-1">Bonjour, {partnerName}</p>
        <h1 className="text-2xl font-bold text-gray-900">Nouvelle demande de collecte</h1>
      </div>

      {/* Barre de progression */}
      <div className="flex items-center gap-2 mb-10">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
              i < step ? "bg-emerald-600 text-white"
              : i === step ? "bg-emerald-600 text-white"
              : "bg-gray-200 text-gray-400"
            }`}>
              {i < step ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-gray-900" : "text-gray-400"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 ${i < step ? "bg-emerald-600" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Carte principale */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">

        {/* ── Étape 0 : Catégorie ── */}
        {step === 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Quel type de matière souhaitez-vous faire collecter ?
            </h2>
            <p className="text-sm text-gray-500 mb-6">Sélectionnez la catégorie qui correspond le mieux à vos surplus.</p>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => set("category", cat.value)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    form.category === cat.value
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-2xl mb-2 block">{cat.icon}</span>
                  <span className="font-medium text-gray-900 text-sm block">{cat.label}</span>
                  <span className="text-xs text-gray-500 mt-0.5 block">{cat.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Étape 1 : Quantité & état ── */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                En quel état sont vos {category?.label.toLowerCase()} ?
              </h2>
              <p className="text-sm text-gray-500 mb-5">Cela nous aide à préparer la collecte au mieux.</p>
              <div className="flex flex-col gap-3">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => set("condition", c.value)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                      form.condition === c.value
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-xl">{c.icon}</span>
                    <span className="font-medium text-gray-900">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Quelle quantité estimez-vous avoir ?</h2>
              <p className="text-sm text-gray-500 mb-5">Une estimation suffit.</p>
              <div className="flex gap-3">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="ex: 2.5"
                  value={form.quantity}
                  onChange={(e) => set("quantity", e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
                <select
                  value={form.unit}
                  onChange={(e) => set("unit", e.target.value)}
                  className="px-4 py-3 rounded-xl border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white"
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── Étape 2 : Détails ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Où se trouvent vos surplus ?</h2>
              <p className="text-sm text-gray-500 mb-5">L&apos;adresse de collecte.</p>
              <input
                type="text"
                placeholder="Ex: 12 rue de l'industrie, 25000 Besançon"
                value={form.locationAddress}
                onChange={(e) => set("locationAddress", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Quand seriez-vous disponible ?</h2>
              <p className="text-sm text-gray-500 mb-5">Date souhaitée pour la collecte (optionnel).</p>
              <input
                type="date"
                value={form.preferredDate}
                onChange={(e) => set("preferredDate", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Informations complémentaires</h2>
              <p className="text-sm text-gray-500 mb-5">Précisions utiles pour notre équipe (optionnel).</p>
              <textarea
                placeholder="Ex: Les palettes sont stockées dans l'entrepôt B, accès par le portail nord..."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
              />
            </div>
          </div>
        )}

        {/* ── Étape 3 : Récapitulatif ── */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Récapitulatif de votre demande</h2>
            <p className="text-sm text-gray-500 mb-6">Vérifiez les informations avant d&apos;envoyer.</p>
            <div className="space-y-3">
              {[
                { label: "Matière", value: `${category?.icon} ${category?.label}` },
                { label: "État", value: CONDITIONS.find((c) => c.value === form.condition)?.label },
                { label: "Quantité", value: `${form.quantity} ${UNITS.find((u) => u.value === form.unit)?.label}` },
                { label: "Adresse", value: form.locationAddress },
                { label: "Date souhaitée", value: form.preferredDate ? new Date(form.preferredDate).toLocaleDateString("fr-FR") : "Non précisée" },
                ...(form.description ? [{ label: "Commentaire", value: form.description }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-4 p-4 rounded-xl bg-gray-50">
                  <span className="text-sm font-medium text-gray-500 w-32 shrink-0">{label}</span>
                  <span className="text-sm text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="px-5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-0 transition"
        >
          Retour
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium transition"
          >
            Continuer →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium transition"
          >
            {submitting ? "Envoi en cours..." : "Envoyer ma demande ✓"}
          </button>
        )}
      </div>
    </div>
  );
}
