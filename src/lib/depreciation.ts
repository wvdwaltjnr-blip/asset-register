// Straight-line depreciation, computed on read from an asset's purchase
// cost, useful life, and cost adjustment history — no per-fiscal-year
// column is stored anywhere (that was only ever a spreadsheet limitation).
//
// Method (reverse-engineered from the live formulas in the spreadsheet this
// app replaces — verified against several assets' full histories):
//   - closingBalance(Y) = cost + (additions dated on/before FY Y's end)
//                              - (disposals dated on/before FY Y's end)
//   - In the fiscal year the asset was purchased in: depreciation is
//     prorated by the number of days owned that year (inclusive of both the
//     purchase date and the fiscal year end), over 365.
//   - In every later fiscal year: depreciation is closingBalance/usefulLife,
//     capped so accumulated depreciation never exceeds closingBalance (i.e.
//     carrying value floors at 0 once the asset is fully written down).
//   - Once an asset is disposed (status sold/written_off), no further
//     depreciation accrues for fiscal years after the one its disposalDate
//     falls in.

export type FiscalYearConfig = { startMonth: number; startDay: number };

export type CostAdjustment = {
  type: "addition" | "disposal";
  amount: number;
  occurredAt: string; // YYYY-MM-DD
};

export type ScheduleAsset = {
  purchaseDate: string; // YYYY-MM-DD
  cost: number;
  usefulLifeYears: number;
  status: "active" | "sold" | "written_off";
  disposalDate: string | null;
};

export type YearlyLedgerRow = {
  fiscalYear: number; // the calendar year the fiscal year ENDS in
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

const MS_PER_DAY = 86400000;

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fyStart(fiscalYear: number, cfg: FiscalYearConfig): Date {
  return new Date(Date.UTC(fiscalYear - 1, cfg.startMonth - 1, cfg.startDay));
}

/** Last day of the fiscal year ending in `fiscalYear` — one day before the next one starts. */
function fyEnd(fiscalYear: number, cfg: FiscalYearConfig): Date {
  const nextStart = new Date(Date.UTC(fiscalYear, cfg.startMonth - 1, cfg.startDay));
  return new Date(nextStart.getTime() - MS_PER_DAY);
}

/** The fiscal year (by its ending calendar year) that a date falls in. */
function fiscalYearOf(date: Date, cfg: FiscalYearConfig): number {
  const calYear = date.getUTCFullYear();
  const startThisCalYear = new Date(Date.UTC(calYear, cfg.startMonth - 1, cfg.startDay));
  return date.getTime() >= startThisCalYear.getTime() ? calYear + 1 : calYear;
}

function daysInclusive(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY) + 1;
}

const DEFAULT_CONFIG: FiscalYearConfig = { startMonth: 3, startDay: 1 };

/**
 * Full year-by-year depreciation schedule from the asset's acquisition
 * fiscal year through `throughFiscalYear` (defaults to the fiscal year the
 * asset's disposal date falls in, or the current fiscal year if still
 * active).
 */
export function getFullSchedule(
  asset: ScheduleAsset,
  adjustments: CostAdjustment[],
  throughFiscalYear?: number,
  cfg: FiscalYearConfig = DEFAULT_CONFIG
): YearlyLedgerRow[] {
  const purchaseDate = parseDate(asset.purchaseDate);
  const acquisitionYear = fiscalYearOf(purchaseDate, cfg);

  const lastAccruingYear =
    asset.disposalDate != null ? fiscalYearOf(parseDate(asset.disposalDate), cfg) : Infinity;

  const targetYear =
    throughFiscalYear ??
    (Number.isFinite(lastAccruingYear) ? (lastAccruingYear as number) : fiscalYearOf(new Date(), cfg));

  const rows: YearlyLedgerRow[] = [];
  let accumulatedDepreciation = 0;

  for (let year = acquisitionYear; year <= targetYear; year++) {
    const end = fyEnd(year, cfg);
    const start = fyStart(year, cfg);

    const additions = adjustments
      .filter((a) => a.type === "addition" && parseDate(a.occurredAt).getTime() <= end.getTime())
      .reduce((sum, a) => sum + a.amount, 0);
    const disposals = adjustments
      .filter((a) => a.type === "disposal" && parseDate(a.occurredAt).getTime() <= end.getTime())
      .reduce((sum, a) => sum + a.amount, 0);
    const closingBalance = asset.cost + additions - disposals;

    let depreciation: number;
    if (year > lastAccruingYear) {
      depreciation = 0;
    } else if (year === acquisitionYear) {
      const days = daysInclusive(purchaseDate, end);
      depreciation = (days / 365) * (closingBalance / asset.usefulLifeYears);
    } else {
      const fullYear = closingBalance / asset.usefulLifeYears;
      depreciation = Math.max(0, Math.min(fullYear, closingBalance - accumulatedDepreciation));
    }

    accumulatedDepreciation += depreciation;
    const carryingValue = closingBalance - accumulatedDepreciation;

    // Additions/disposals recorded *this* fiscal year only, for display —
    // closingBalance above is the cumulative figure the depreciation math
    // actually needs.
    const additionsThisYear = adjustments
      .filter(
        (a) =>
          a.type === "addition" &&
          parseDate(a.occurredAt).getTime() >= start.getTime() &&
          parseDate(a.occurredAt).getTime() <= end.getTime()
      )
      .reduce((sum, a) => sum + a.amount, 0);
    const disposalsThisYear = adjustments
      .filter(
        (a) =>
          a.type === "disposal" &&
          parseDate(a.occurredAt).getTime() >= start.getTime() &&
          parseDate(a.occurredAt).getTime() <= end.getTime()
      )
      .reduce((sum, a) => sum + a.amount, 0);

    rows.push({
      fiscalYear: year,
      fiscalYearStart: formatDate(start),
      fiscalYearEnd: formatDate(end),
      openingValue: closingBalance - additionsThisYear + disposalsThisYear,
      additions: additionsThisYear,
      disposals: disposalsThisYear,
      closingBalance,
      depreciation,
      accumulatedDepreciation,
      carryingValue,
    });
  }

  return rows;
}

/** The current fiscal year's figures — what the register list view shows. */
export function getCurrentYearFigures(
  asset: ScheduleAsset,
  adjustments: CostAdjustment[],
  cfg: FiscalYearConfig = DEFAULT_CONFIG
): YearlyLedgerRow {
  const schedule = getFullSchedule(asset, adjustments, undefined, cfg);
  return schedule[schedule.length - 1];
}

export function currentFiscalYear(cfg: FiscalYearConfig = DEFAULT_CONFIG): number {
  return fiscalYearOf(new Date(), cfg);
}
