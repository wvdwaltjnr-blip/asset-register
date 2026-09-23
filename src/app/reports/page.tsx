"use client";

import { useEffect, useMemo, useState } from "react";
import { BASE_PATH } from "@/lib/basePath";

type Status = "active" | "sold" | "written_off";
type Asset = {
  id: number;
  status: Status;
  cost: number;
  figures: {
    depreciation: number;
    accumulatedDepreciation: number;
    carryingValue: number;
  };
};
type Settings = { currency: string };

function fmt(n: number, currency: string) {
  return currency + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReportsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [settings, setSettings] = useState<Settings>({ currency: "R" });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE_PATH}/api/assets`).then((r) => r.json()),
      fetch(`${BASE_PATH}/api/settings`).then((r) => r.json()),
    ]).then(([assetsRes, settingsRes]) => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAssets(assetsRes.assets ?? []);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettings(settingsRes.settings ?? { currency: "R" });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(true);
    });
  }, []);

  const byStatus = useMemo(() => {
    const counts: Record<Status, number> = { active: 0, sold: 0, written_off: 0 };
    for (const a of assets) counts[a.status]++;
    return counts;
  }, [assets]);

  const totals = assets.reduce(
    (acc, a) => ({
      cost: acc.cost + a.cost,
      depreciation: acc.depreciation + a.figures.depreciation,
      accumulatedDepreciation: acc.accumulatedDepreciation + a.figures.accumulatedDepreciation,
      carryingValue: acc.carryingValue + a.figures.carryingValue,
    }),
    { cost: 0, depreciation: 0, accumulatedDepreciation: 0, carryingValue: 0 }
  );

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-5xl p-4 pb-16 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-semibold">Reports</h1>
        <a href={`${BASE_PATH}/api/reports/export`} className="btn-secondary">⭳ Export CSV</a>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-dim">Total cost</div>
          <div className="mono mt-1 text-xl font-semibold">{fmt(totals.cost, settings.currency)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-dim">This year&apos;s depreciation</div>
          <div className="mono mt-1 text-xl font-semibold text-bad">{fmt(totals.depreciation, settings.currency)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-dim">Accumulated depreciation</div>
          <div className="mono mt-1 text-xl font-semibold text-bad">{fmt(totals.accumulatedDepreciation, settings.currency)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-dim">Carrying value</div>
          <div className="mono mt-1 text-xl font-semibold text-good">{fmt(totals.carryingValue, settings.currency)}</div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line bg-surface-2 px-4 py-3 font-display text-sm font-semibold">Assets by status</div>
        <div className="grid grid-cols-3 divide-x divide-line">
          <div className="p-4 text-center">
            <div className="text-2xl font-semibold">{byStatus.active}</div>
            <div className="text-xs text-ink-dim">Active</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-2xl font-semibold">{byStatus.sold}</div>
            <div className="text-xs text-ink-dim">Sold</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-2xl font-semibold">{byStatus.written_off}</div>
            <div className="text-xs text-ink-dim">Written off</div>
          </div>
        </div>
      </div>
    </main>
  );
}
