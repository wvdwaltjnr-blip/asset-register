// Set only in the deployed environment, where this app is reverse-proxied
// at eezisupport.co.za/assetregister (see next.config.ts). Client components
// must prefix their own fetch()/asset paths with this — Next.js only
// rewrites next/link, useRouter(), and next/image automatically, not raw
// "/api/..." strings.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
