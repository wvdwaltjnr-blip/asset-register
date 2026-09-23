import { requireUser, isAuthFailure } from "@/lib/auth";
import { listAssetsWithFigures } from "@/lib/assets";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const auth = await requireUser();
  if (isAuthFailure(auth)) return auth;

  const withFigures = [...(await listAssetsWithFigures())].sort((a, b) =>
    (a.registration ?? "").localeCompare(b.registration ?? "")
  );

  const csv = toCsv(
    [
      "Registration",
      "Description",
      "VIN Number",
      "Invoice Number",
      "Status",
      "Purchase Date",
      "Useful Life (years)",
      "Opening Value",
      "Additions",
      "Disposals",
      "Closing Balance",
      "Depreciation (this year)",
      "Accumulated Depreciation",
      "Carrying Value",
      "Comments",
    ],
    withFigures.map((a) => [
      a.registration,
      a.description,
      a.vinNumber,
      a.invoiceNumber,
      a.status,
      a.purchaseDate,
      a.usefulLifeYears,
      a.figures.openingValue.toFixed(2),
      a.figures.additions.toFixed(2),
      a.figures.disposals.toFixed(2),
      a.figures.closingBalance.toFixed(2),
      a.figures.depreciation.toFixed(2),
      a.figures.accumulatedDepreciation.toFixed(2),
      a.figures.carryingValue.toFixed(2),
      a.comments,
    ])
  );

  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="asset-register-${today}.csv"`,
    },
  });
}
