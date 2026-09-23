"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BASE_PATH } from "@/lib/basePath";

type SessionUser = { id: number; name: string; role: "admin" | "clerk" | "viewer" } | null;
type Status = "active" | "sold" | "written_off";
type Asset = {
  id: number;
  description: string;
  invoiceNumber: string | null;
  vinNumber: string | null;
  registration: string | null;
  status: Status;
  purchaseDate: string;
  cost: number;
  usefulLifeYears: number;
  figures: {
    closingBalance: number;
    depreciation: number;
    accumulatedDepreciation: number;
    carryingValue: number;
  };
};
type Settings = { currency: string };

const STATUS_LABEL: Record<Status, string> = { active: "Active", sold: "Sold", written_off: "Written off" };
const STATUS_PILL: Record<Status, string> = {
  active: "pill-good",
  sold: "bg-surface-2 text-ink-dim",
  written_off: "pill-over",
};

function money(currency: string, n: number) {
  return `${currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RegisterPage() {
  const [session, setSession] = useState<SessionUser>(null);
  const [checking, setChecking] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [settings, setSettings] = useState<Settings>({ currency: "R" });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("active");

  useEffect(() => {
    async function load() {
      const [sessionRes, assetsRes, settingsRes] = await Promise.all([
        fetch(`${BASE_PATH}/api/session`).then((r) => r.json()),
        fetch(`${BASE_PATH}/api/assets`).then((r) => (r.ok ? r.json() : { assets: [] })),
        fetch(`${BASE_PATH}/api/settings`).then((r) => (r.ok ? r.json() : { settings: null })),
      ]);
      setSession(sessionRes.user ?? null);
      setAssets(assetsRes.assets ?? []);
      if (settingsRes.settings) setSettings(settingsRes.settings);
      setChecking(false);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const duplicateRegistrations = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) {
      if (!a.registration) continue;
      counts.set(a.registration, (counts.get(a.registration) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([reg]) => reg));
  }, [assets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets
      .filter((a) => {
        if (statusFilter !== "all" && a.status !== statusFilter) return false;
        if (!q) return true;
        return (
          a.description.toLowerCase().includes(q) ||
          (a.vinNumber ?? "").toLowerCase().includes(q) ||
          (a.registration ?? "").toLowerCase().includes(q) ||
          (a.invoiceNumber ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.registration ?? "").localeCompare(b.registration ?? ""));
  }, [assets, query, statusFilter]);

  const totals = filtered.reduce(
    (acc, a) => ({
      cost: acc.cost + a.cost,
      closingBalance: acc.closingBalance + a.figures.closingBalance,
      depreciation: acc.depreciation + a.figures.depreciation,
      accumulatedDepreciation: acc.accumulatedDepreciation + a.figures.accumulatedDepreciation,
      carryingValue: acc.carryingValue + a.figures.carryingValue,
    }),
    { cost: 0, closingBalance: 0, depreciation: 0, accumulatedDepreciation: 0, carryingValue: 0 }
  );

  if (checking) return null;

  const canEdit = session?.role === "admin" || session?.role === "clerk";

  return (
    <main className="mx-auto max-w-7xl p-4 pb-16 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Asset Register</h1>
          <p className="text-xs text-ink-dim">{filtered.length} of {assets.length} assets</p>
        </div>
        {canEdit && (
          <Link href="/assets/new" className="btn-primary">
            + Add asset
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search registration, VIN, description, invoice…"
          className="input-field-sm w-72 max-w-full"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | Status)}
          className="input-field-sm"
        >
          <option value="active">Active</option>
          <option value="sold">Sold</option>
          <option value="written_off">Written off</option>
          <option value="all">All statuses</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-4">Registration</th>
                <th>Description</th>
                <th>VIN</th>
                <th>Status</th>
                <th>Purchase Date</th>
                <th className="text-right">Cost</th>
                <th className="text-right">Depreciation</th>
                <th className="text-right">Accum. Depreciation</th>
                <th className="pr-4 text-right">Carrying Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-ink-dim">
                    No assets found.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 pl-4">
                      <Link href={`/assets/${a.id}`} className="link-brand mono font-medium">
                        {a.registration ?? "—"}
                      </Link>
                      {a.registration && duplicateRegistrations.has(a.registration) && (
                        <span
                          title="Duplicate registration — shared with another asset"
                          className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-bad text-[10px] font-bold leading-none text-white"
                        >
                          !
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs truncate">{a.description}</td>
                    <td className="mono text-xs text-ink-dim">{a.vinNumber ?? "—"}</td>
                    <td>
                      <span className={`pill ${STATUS_PILL[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    </td>
                    <td className="text-xs text-ink-dim">{a.purchaseDate}</td>
                    <td className="mono text-right">{money(settings.currency, a.cost)}</td>
                    <td className="mono text-right">{money(settings.currency, a.figures.depreciation)}</td>
                    <td className="mono text-right">{money(settings.currency, a.figures.accumulatedDepreciation)}</td>
                    <td className="mono pr-4 text-right font-semibold">
                      {money(settings.currency, a.figures.carryingValue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td className="pl-4 py-2" colSpan={5}>
                    Totals
                  </td>
                  <td className="mono text-right">{money(settings.currency, totals.cost)}</td>
                  <td className="mono text-right">{money(settings.currency, totals.depreciation)}</td>
                  <td className="mono text-right">{money(settings.currency, totals.accumulatedDepreciation)}</td>
                  <td className="mono pr-4 text-right">{money(settings.currency, totals.carryingValue)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </main>
  );
}
