"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BASE_PATH } from "@/lib/basePath";

type Category = { id: number; name: string; defaultUsefulLifeYears: number };
type InsuranceType = { id: number; name: string };

export default function NewAssetPage() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [vinNumber, setVinNumber] = useState("");
  const [registration, setRegistration] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [cost, setCost] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [usefulLifeYears, setUsefulLifeYears] = useState("");
  const [insuranceReference, setInsuranceReference] = useState("");
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [insuranceTypeId, setInsuranceTypeId] = useState("");
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${BASE_PATH}/api/categories`)
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d) => setCategories(d.categories ?? []));
    fetch(`${BASE_PATH}/api/insurance-types`)
      .then((r) => (r.ok ? r.json() : { insuranceTypes: [] }))
      .then((d) => setInsuranceTypes(d.insuranceTypes ?? []));
  }, []);

  function onCategoryChange(id: string) {
    setCategoryId(id);
    const category = categories.find((c) => String(c.id) === id);
    if (category) setUsefulLifeYears(String(category.defaultUsefulLifeYears));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch(`${BASE_PATH}/api/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        invoiceNumber,
        vinNumber,
        registration,
        purchaseDate,
        cost: Number(cost),
        categoryId: categoryId || null,
        insuranceReference,
        insuranceTypeId: insuranceTypeId || null,
        comments,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't add asset.");
      return;
    }
    router.push(`/assets/${data.asset.id}`);
  }

  return (
    <main className="mx-auto max-w-xl p-4 pb-16 sm:p-6">
      <h1 className="mb-6 font-display text-xl font-semibold">Add asset</h1>

      <form onSubmit={submit} className="card space-y-4 p-6">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Registration
          <input
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            placeholder="e.g. HK32DVGP"
            className="input-field normal-case"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="e.g. Hino 300 - 915"
              className="input-field normal-case"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
            VIN number
            <input value={vinNumber} onChange={(e) => setVinNumber(e.target.value)} className="input-field normal-case" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Invoice number
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="input-field normal-case" />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Purchase date
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
              className="input-field normal-case"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Cost
            <input
              type="number" min={0} step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              required
              className="input-field normal-case"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Category
            <select
              value={categoryId}
              onChange={(e) => onCategoryChange(e.target.value)}
              required
              className="input-field normal-case"
            >
              <option value="" disabled>Choose a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Useful life (years)
            <input
              value={usefulLifeYears}
              disabled
              placeholder="Set by category"
              className="input-field normal-case disabled:opacity-60"
            />
          </label>
        </div>
        {categories.length === 0 && (
          <p className="text-xs text-bad">
            No vehicle categories exist yet — an admin must add one under Settings before an asset can be added.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Insurance reference
            <input value={insuranceReference} onChange={(e) => setInsuranceReference(e.target.value)} className="input-field normal-case" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Type of insurance
            <select
              value={insuranceTypeId}
              onChange={(e) => setInsuranceTypeId(e.target.value)}
              className="input-field normal-case"
            >
              <option value="">—</option>
              {insuranceTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Comments
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} className="input-field normal-case" />
        </label>

        {error && <p className="text-sm text-bad">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => router.push("/")} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving || !usefulLifeYears} className="btn-primary">
            {saving ? "Saving…" : "Add asset"}
          </button>
        </div>
      </form>
    </main>
  );
}
