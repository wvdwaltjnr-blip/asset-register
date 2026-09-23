# asset-register

Fleet asset register and depreciation tracker for J and A Truck Rental (Eezi Move), replacing the hand-maintained `TR 1 Asset register 2025.xlsx` spreadsheet.

## Stack

- Next.js
- Drizzle ORM + better-sqlite3
- Shared session/login with the clockin-system app (SSO)

## Scope

Financial register only — tracks assets, cost adjustments, and computed straight-line depreciation. Vehicle spec/service/maintenance tracking is a separate, not-yet-built module.

## Development

```bash
npm install
npm run dev
```

## Deployment

See `deploy/` for the systemd service and nginx config used on the production server.
