"use client";

import { useEffect, useRef, useState } from "react";
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
  disposalDate: string | null;
  cost: number;
  categoryId: number | null;
  usefulLifeYears: number;
  insuranceReference: string | null;
  insuranceTypeId: number | null;
  comments: string | null;
};
type Category = { id: number; name: string; defaultUsefulLifeYears: number };
type InsuranceType = { id: number; name: string };
type Adjustment = {
  id: number;
  type: "addition" | "disposal";
  amount: number;
  occurredAt: string;
  note: string | null;
};
type ScheduleRow = {
  fiscalYear: number;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  openingValue: number;
  additions: number;
  disposals: number;
  closingBalance: number;
  depreciation: number;
  accumulatedDepreciation: number;
  carryingValue: number;
};
type Settings = { currency: string };

const STATUS_LABEL: Record<Status, string> = { active: "Active", sold: "Sold", written_off: "Written off" };

function money(currency: string, n: number) {
  return `${currency}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AssetDetailClient({ id }: { id: string }) {
  const [session, setSession] = useState<SessionUser>(null);
  const [checking, setChecking] = useState(true);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [settings, setSettings] = useState<Settings>({ currency: "R" });
  const [categories, setCategories] = useState<Category[]>([]);
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const adjustmentDialogRef = useRef<HTMLDialogElement>(null);
  const statusDialogRef = useRef<HTMLDialogElement>(null);

  async function refresh() {
    const [sessionRes, assetRes, settingsRes, categoriesRes, insuranceTypesRes] = await Promise.all([
      fetch(`${BASE_PATH}/api/session`).then((r) => r.json()),
      fetch(`${BASE_PATH}/api/assets/${id}`),
      fetch(`${BASE_PATH}/api/settings`).then((r) => (r.ok ? r.json() : { settings: null })),
      fetch(`${BASE_PATH}/api/categories`).then((r) => (r.ok ? r.json() : { categories: [] })),
      fetch(`${BASE_PATH}/api/insurance-types`).then((r) => (r.ok ? r.json() : { insuranceTypes: [] })),
    ]);
    setSession(sessionRes.user ?? null);
    if (settingsRes.settings) setSettings(settingsRes.settings);
    setCategories(categoriesRes.categories ?? []);
    setInsuranceTypes(insuranceTypesRes.insuranceTypes ?? []);
    if (!assetRes.ok) {
      setNotFound(true);
      setChecking(false);
      return;
    }
    const data = await assetRes.json();
    setAsset(data.asset);
    setAdjustments(data.adjustments);
    setSchedule(data.schedule);
    setChecking(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveField(patch: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`${BASE_PATH}/api/assets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Couldn't save change.");
      return;
    }
    refresh();
  }

  if (checking) return null;
  if (notFound || !asset) {
    return (
      <main className="mx-auto max-w-2xl p-6 text-sm text-ink-dim">
        Asset not found. <Link href="/" className="link-brand">Back to register</Link>
      </main>
    );
  }

  const canEdit = session?.role === "admin" || session?.role === "clerk";
  const current = schedule[schedule.length - 1];

  return (
    <main className="mx-auto max-w-4xl p-4 pb-16 sm:p-6">
      <Link href="/" className="link-brand text-xs">← Back to register</Link>

      <div className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">{asset.registration ?? "No registration"}</h1>
          <p className="text-xs text-ink-dim">
            {asset.description} · {asset.vinNumber ?? "No VIN"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill bg-surface-2 text-ink-dim">{STATUS_LABEL[asset.status]}</span>
          {canEdit && (
            <button type="button" className="btn-secondary" onClick={() => statusDialogRef.current?.showModal()}>
              Change status
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-bad">{error}</p>}

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-dim">Details</div>
          <div className="space-y-3">
            <EditableField label="Registration" value={asset.registration ?? ""} disabled={!canEdit} onSave={(v) => saveField({ registration: v })} />
            <EditableField label="Description" value={asset.description} disabled={!canEdit} onSave={(v) => saveField({ description: v })} />
            <EditableField label="VIN number" value={asset.vinNumber ?? ""} disabled={!canEdit} onSave={(v) => saveField({ vinNumber: v })} />
            <EditableField label="Invoice number" value={asset.invoiceNumber ?? ""} disabled={!canEdit} onSave={(v) => saveField({ invoiceNumber: v })} />
            <EditableField label="Purchase date" type="date" value={asset.purchaseDate} disabled={!canEdit} onSave={(v) => saveField({ purchaseDate: v })} />
            <EditableField label="Cost" type="number" value={String(asset.cost)} disabled={!canEdit} onSave={(v) => saveField({ cost: Number(v) })} />
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
              Category
              <select
                defaultValue={asset.categoryId ?? ""}
                disabled={!canEdit}
                onChange={(e) => {
                  const category = categories.find((c) => String(c.id) === e.target.value);
                  saveField(
                    category
                      ? { categoryId: category.id, usefulLifeYears: category.defaultUsefulLifeYears }
                      : { categoryId: null }
                  );
                }}
                className="input-field-sm normal-case disabled:opacity-60"
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
              Useful life (years)
              <input value={String(asset.usefulLifeYears)} disabled className="input-field-sm normal-case disabled:opacity-60" />
              <span className="text-[11px] normal-case text-ink-dim">Fixed by category — change the Category above to update it.</span>
            </label>
            <EditableField label="Insurance reference" value={asset.insuranceReference ?? ""} disabled={!canEdit} onSave={(v) => saveField({ insuranceReference: v })} />
            <EditableField
              label="Type of insurance"
              value={asset.insuranceTypeId != null ? String(asset.insuranceTypeId) : ""}
              disabled={!canEdit}
              onSave={(v) => saveField({ insuranceTypeId: v || null })}
              options={insuranceTypes.map((t) => ({ value: String(t.id), label: t.name }))}
            />
            <EditableField label="Comments" value={asset.comments ?? ""} disabled={!canEdit} onSave={(v) => saveField({ comments: v })} multiline />
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-dim">
            Current fiscal year ({current?.fiscalYearStart} – {current?.fiscalYearEnd})
          </div>
          {current && (
            <dl className="space-y-2 text-sm">
              <Row label="Opening value" value={money(settings.currency, current.openingValue)} />
              <Row label="Additions" value={money(settings.currency, current.additions)} />
              <Row label="Disposals" value={money(settings.currency, current.disposals)} />
              <Row label="Closing balance" value={money(settings.currency, current.closingBalance)} />
              <Row label="Depreciation" value={money(settings.currency, current.depreciation)} />
              <Row label="Accumulated depreciation" value={money(settings.currency, current.accumulatedDepreciation)} />
              <Row label="Carrying value" value={money(settings.currency, current.carryingValue)} bold />
            </dl>
          )}
        </div>
      </div>

      <div className="card mb-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-3">
          <span className="font-display text-sm font-semibold">Depreciation history</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-4">Fiscal Year</th>
                <th className="text-right">Opening</th>
                <th className="text-right">Additions</th>
                <th className="text-right">Disposals</th>
                <th className="text-right">Closing</th>
                <th className="text-right">Depreciation</th>
                <th className="text-right">Accum. Dep.</th>
                <th className="pr-4 text-right">Carrying Value</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row) => (
                <tr key={row.fiscalYear}>
                  <td className="pl-4 py-1.5">FY{row.fiscalYear}</td>
                  <td className="mono text-right">{money(settings.currency, row.openingValue)}</td>
                  <td className="mono text-right">{money(settings.currency, row.additions)}</td>
                  <td className="mono text-right">{money(settings.currency, row.disposals)}</td>
                  <td className="mono text-right">{money(settings.currency, row.closingBalance)}</td>
                  <td className="mono text-right">{money(settings.currency, row.depreciation)}</td>
                  <td className="mono text-right">{money(settings.currency, row.accumulatedDepreciation)}</td>
                  <td className="mono pr-4 text-right font-semibold">{money(settings.currency, row.carryingValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-3">
          <span className="font-display text-sm font-semibold">Cost adjustments</span>
          {canEdit && (
            <button type="button" className="btn-secondary" onClick={() => adjustmentDialogRef.current?.showModal()}>
              + Record adjustment
            </button>
          )}
        </div>
        {adjustments.length === 0 ? (
          <p className="p-4 text-sm text-ink-dim">No additions or disposals recorded.</p>
        ) : (
          <div className="divide-y divide-line">
            {adjustments.map((adj) => (
              <div key={adj.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <span className={`pill ${adj.type === "addition" ? "pill-good" : "pill-over"} mr-2`}>
                    {adj.type === "addition" ? "Addition" : "Disposal"}
                  </span>
                  <span className="text-ink-dim">{adj.occurredAt}</span>
                  {adj.note && <span className="ml-2 text-ink-dim">— {adj.note}</span>}
                </div>
                <span className="mono font-medium">{money(settings.currency, adj.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AdjustmentDialog dialogRef={adjustmentDialogRef} assetId={id} onSaved={() => { adjustmentDialogRef.current?.close(); refresh(); }} />
      <StatusDialog dialogRef={statusDialogRef} asset={asset} onSaved={() => { statusDialogRef.current?.close(); refresh(); }} />
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-dim">{label}</dt>
      <dd className={`mono ${bold ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

function EditableField({
  label,
  value,
  onSave,
  disabled,
  type = "text",
  multiline = false,
  options,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
  disabled?: boolean;
  type?: string;
  multiline?: boolean;
  options?: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
      {label}
      {options ? (
        <select
          defaultValue={value}
          disabled={disabled}
          onChange={(e) => onSave(e.target.value)}
          className="input-field-sm normal-case disabled:opacity-60"
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : multiline ? (
        <textarea
          defaultValue={value}
          disabled={disabled}
          onBlur={(e) => e.target.value !== value && onSave(e.target.value)}
          rows={2}
          className="input-field-sm normal-case disabled:opacity-60"
        />
      ) : (
        <input
          type={type}
          defaultValue={value}
          disabled={disabled}
          onBlur={(e) => e.target.value !== value && onSave(e.target.value)}
          className="input-field-sm normal-case disabled:opacity-60"
        />
      )}
    </label>
  );
}

function AdjustmentDialog({
  dialogRef,
  assetId,
  onSaved,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  assetId: string;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"addition" | "disposal">("addition");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    setSaving(true);
    const res = await fetch(`${BASE_PATH}/api/assets/${assetId}/adjustments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, amount: Number(amount), occurredAt, note }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Couldn't record adjustment.");
      return;
    }
    setAmount("");
    setNote("");
    onSaved();
  }

  return (
    <dialog ref={dialogRef} className="w-[420px] max-w-[92vw] rounded-2xl border-0 bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40">
      <div className="flex flex-col gap-3 p-6">
        <h3 className="font-display text-lg font-semibold">Record adjustment</h3>

        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Type
          <select value={type} onChange={(e) => setType(e.target.value as "addition" | "disposal")} className="input-field normal-case">
            <option value="addition">Addition (increases cost basis)</option>
            <option value="disposal">Disposal (write-down)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Amount
          <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field normal-case" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Date
          <input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className="input-field normal-case" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input-field normal-case" />
        </label>

        {error && <p className="text-xs text-bad">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button type="button" disabled={saving || !amount} onClick={save} className="btn-primary">
            {saving ? "Saving…" : "Record"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function StatusDialog({
  dialogRef,
  asset,
  onSaved,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  asset: Asset;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<Status>(asset.status);
  const [disposalDate, setDisposalDate] = useState(asset.disposalDate ?? new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(asset.status);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisposalDate(asset.disposalDate ?? new Date().toISOString().slice(0, 10));
  }, [asset]);

  async function save() {
    setError(null);
    setSaving(true);
    const res = await fetch(`${BASE_PATH}/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, disposalDate: status === "active" ? undefined : disposalDate }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Couldn't update status.");
      return;
    }
    onSaved();
  }

  return (
    <dialog ref={dialogRef} className="w-[400px] max-w-[92vw] rounded-2xl border-0 bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40">
      <div className="flex flex-col gap-3 p-6">
        <h3 className="font-display text-lg font-semibold">Change status</h3>

        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="input-field normal-case">
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="written_off">Written off</option>
          </select>
        </label>

        {status !== "active" && (
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Disposal date
            <input type="date" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} className="input-field normal-case" />
            <span className="text-[11px] normal-case text-ink-dim">No further depreciation accrues after this fiscal year.</span>
          </label>
        )}

        {error && <p className="text-xs text-bad">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button type="button" disabled={saving} onClick={save} className="btn-primary">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
