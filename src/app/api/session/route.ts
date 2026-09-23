import { NextResponse } from "next/server";
import { getSessionUser, fullName } from "@/lib/clockinSession";

// Read-only: sign-in and sign-out both belong to clockin-system now (see
// /login and the "Sign out" form posting to /logout). This just reflects
// whatever session already exists, for the client components that need the
// current user's id/name/role (e.g. to gate the Settings/Users nav links).
export async function GET() {
  const sessionUser = await getSessionUser();
  const hasAccess = sessionUser?.accessAssetRegister && sessionUser.assetRegisterRole;
  const user = hasAccess && sessionUser
    ? { id: sessionUser.id, name: fullName(sessionUser), email: sessionUser.email, role: sessionUser.assetRegisterRole! }
    : null;
  return NextResponse.json({ user });
}
