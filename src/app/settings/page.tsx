"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { BASE_PATH } from "@/lib/basePath";

type SessionUser = { id: number; name: string; role: "admin" | "clerk" | "viewer" } | null;
type Settings = { id: number; currency: string; fiscalYearStartMonth: number; fiscalYearStartDay: number };
type Category = { id: number; name: string; defaultUsefulLifeYears: number };
type InsuranceType = { id: number; name: string };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function SettingsPage() {
  const [session, setSession] = useState<SessionUser>(null);
  const [checking, setChecking] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryYears, setNewCategoryYears] = useState("4");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [newInsuranceTypeName, setNewInsuranceTypeName] = useState("");
  const [insuranceTypeError, setInsuranceTypeError] = useState<string | null>(null);

  async function refresh() {
    const [sessionRes, settingsRes, categoriesRes, insuranceTypesRes] = await Promise.all([
      fetch(`${BASE_PATH}/api/session`).then((r) => r.json()),
      fetch(`${BASE_PATH}/api/settings`).then((r) => r.json()),
      fetch(`${BASE_PATH}/api/categories`).then((r) => (r.ok ? r.json() : { categories: [] })),
      fetch(`${BASE_PATH}/api/insurance-types`).then((r) => (r.ok ? r.json() : { insuranceTypes: [] })),
    ]);
    setSession(sessionRes.user ?? null);
    setSettings(settingsRes.settings ?? null);
    setCategories(categoriesRes.categories ?? []);
    setInsuranceTypes(insuranceTypesRes.insuranceTypes ?? []);
    setChecking(false);
  }

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    setCategoryError(null);
    const res = await fetch(`${BASE_PATH}/api/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName.trim(), defaultUsefulLifeYears: Number(newCategoryYears) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setCategoryError(data.error ?? "Couldn't add category.");
      return;
    }
    setNewCategoryName("");
    setNewCategoryYears("4");
    refresh();
  }

  async function updateCategory(id: number, patch: Record<string, unknown>) {
    await fetch(`${BASE_PATH}/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    refresh();
  }

  async function deleteCategory(id: number, name: string) {
    if (!confirm(`Delete category "${name}"? Assets using it will keep their own useful life, but lose the category label.`)) return;
    await fetch(`${BASE_PATH}/api/categories/${id}`, { method: "DELETE" });
    refresh();
  }

  async function addInsuranceType(e: FormEvent) {
    e.preventDefault();
    setInsuranceTypeError(null);
    const res = await fetch(`${BASE_PATH}/api/insurance-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newInsuranceTypeName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setInsuranceTypeError(data.error ?? "Couldn't add insurance type.");
      return;
    }
    setNewInsuranceTypeName("");
    refresh();
  }

  async function updateInsuranceType(id: number, name: string) {
    await fetch(`${BASE_PATH}/api/insurance-types/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    refresh();
  }

  async function deleteInsuranceType(id: number, name: string) {
    if (!confirm(`Delete insurance type "${name}"? Assets using it will just show no insurance type.`)) return;
    await fetch(`${BASE_PATH}/api/insurance-types/${id}`, { method: "DELETE" });
    refresh();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  async function saveSettings(patch: Partial<Pick<Settings, "currency" | "fiscalYearStartMonth" | "fiscalYearStartDay">>) {
    await fetch(`${BASE_PATH}/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    refresh();
  }

  if (checking) return null;

  if (session?.role !== "admin") {
    return (
      <main className="mx-auto max-w-2xl p-6 text-sm text-ink-dim">
        Settings is for Admins only.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-4 pb-16 sm:p-6">
      <h1 className="mb-1 font-display text-xl font-semibold">Settings</h1>
      <p className="mb-6 text-xs text-ink-dim">
        Manage currency and the fiscal year used for depreciation. Manage who can sign in on the{" "}
        <Link href="/users" className="link-brand">Users</Link> page.
      </p>

      {settings && (
        <div className="card p-6">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-dim">General</div>
          <div className="flex flex-wrap gap-6">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
              Currency symbol
              <input
                defaultValue={settings.currency}
                onBlur={(e) => e.target.value.trim() && saveSettings({ currency: e.target.value.trim() })}
                className="input-field-sm w-28 normal-case"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
              Fiscal year start month
              <select
                defaultValue={settings.fiscalYearStartMonth}
                onChange={(e) => saveSettings({ fiscalYearStartMonth: Number(e.target.value) })}
                className="input-field-sm w-40 normal-case"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
              Fiscal year start day
              <input
                type="number" min={1} max={31} defaultValue={settings.fiscalYearStartDay}
                onBlur={(e) => Number.isFinite(Number(e.target.value)) && saveSettings({ fiscalYearStartDay: Number(e.target.value) })}
                className="input-field-sm w-24 normal-case"
              />
            </label>
          </div>
          <p className="mt-4 text-[11px] text-ink-dim">
            Default is 1 March, matching the South African tax year. Changing this reshapes every asset&apos;s
            depreciation schedule going forward.
          </p>
        </div>
      )}

      <div className="card mt-8 overflow-hidden">
        <div className="border-b border-line bg-surface-2 px-4 py-3 font-display text-sm font-semibold">Vehicle Categories</div>
        <p className="px-4 pt-3 text-xs text-ink-dim">
          Picking a category on an asset prefills its useful life with the category&apos;s default — the asset
          keeps its own useful life afterward, so changing a category&apos;s years here doesn&apos;t alter any
          existing asset&apos;s depreciation schedule.
        </p>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-4">Name</th>
                <th className="text-right">Default useful life (years)</th>
                <th className="pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr><td colSpan={3} className="py-4 text-center text-ink-dim">No categories yet.</td></tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id}>
                    <td className="pl-4 py-1.5">
                      <input
                        defaultValue={c.name}
                        onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && updateCategory(c.id, { name: e.target.value.trim() })}
                        className="input-field-sm w-full max-w-xs normal-case"
                      />
                    </td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number" min={0.5} step="0.5"
                        defaultValue={c.defaultUsefulLifeYears}
                        onBlur={(e) => Number(e.target.value) > 0 && Number(e.target.value) !== c.defaultUsefulLifeYears && updateCategory(c.id, { defaultUsefulLifeYears: Number(e.target.value) })}
                        className="input-field-sm w-24 text-right normal-case"
                      />
                    </td>
                    <td className="pr-4 py-1.5 text-right">
                      <button type="button" onClick={() => deleteCategory(c.id, c.name)} className="text-xs text-bad hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {categoryError && <p className="px-4 pb-2 text-xs text-bad">{categoryError}</p>}
        <form onSubmit={addCategory} className="flex flex-wrap items-end gap-2 border-t border-line p-4">
          <label className="flex flex-col gap-1 text-xs text-ink-dim">
            Category name
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Truck"
              required
              className="input-field-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-dim">
            Default useful life (years)
            <input
              type="number" min={0.5} step="0.5"
              value={newCategoryYears}
              onChange={(e) => setNewCategoryYears(e.target.value)}
              required
              className="input-field-sm w-32"
            />
          </label>
          <button type="submit" className="btn-secondary">+ Add category</button>
        </form>
      </div>

      <div className="card mt-8 overflow-hidden">
        <div className="border-b border-line bg-surface-2 px-4 py-3 font-display text-sm font-semibold">Insurance Types</div>
        <p className="px-4 pt-3 text-xs text-ink-dim">
          The options offered for an asset&apos;s &quot;Type of insurance&quot; field.
        </p>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-4">Name</th>
                <th className="pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {insuranceTypes.length === 0 ? (
                <tr><td colSpan={2} className="py-4 text-center text-ink-dim">No insurance types yet.</td></tr>
              ) : (
                insuranceTypes.map((t) => (
                  <tr key={t.id}>
                    <td className="pl-4 py-1.5">
                      <input
                        defaultValue={t.name}
                        onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && updateInsuranceType(t.id, e.target.value.trim())}
                        className="input-field-sm w-full max-w-xs normal-case"
                      />
                    </td>
                    <td className="pr-4 py-1.5 text-right">
                      <button type="button" onClick={() => deleteInsuranceType(t.id, t.name)} className="text-xs text-bad hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {insuranceTypeError && <p className="px-4 pb-2 text-xs text-bad">{insuranceTypeError}</p>}
        <form onSubmit={addInsuranceType} className="flex flex-wrap items-end gap-2 border-t border-line p-4">
          <label className="flex flex-col gap-1 text-xs text-ink-dim">
            Insurance type name
            <input
              value={newInsuranceTypeName}
              onChange={(e) => setNewInsuranceTypeName(e.target.value)}
              placeholder="e.g. Comp"
              required
              className="input-field-sm"
            />
          </label>
          <button type="submit" className="btn-secondary">+ Add insurance type</button>
        </form>
      </div>
    </main>
  );
}
