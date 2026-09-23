import { NextResponse } from "next/server";
import { getSessionUser, fullName } from "@/lib/clockinSession";

export type Role = "admin" | "clerk" | "viewer";

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

/**
 * Call at the top of every mutating (and any sensitive read) Route Handler.
 * Returns the signed-in user, or a ready-to-return 401/403 NextResponse if
 * they don't qualify. This is the actual security boundary — it runs only
 * on the server, so it can't be bypassed by editing the page. Sign-in itself
 * is clockin-system's — this only checks the session it already created and
 * the asset-register-specific access grant on top of it.
 */
export async function requireUser(): Promise<CurrentUser | NextResponse> {
  const user = await getSessionUser();
  if (!user || !user.accessAssetRegister || !user.assetRegisterRole) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  return { id: user.id, name: fullName(user), email: user.email, role: user.assetRegisterRole };
}

export async function requireRole(roles: Role[]): Promise<CurrentUser | NextResponse> {
  const result = await requireUser();
  if (result instanceof NextResponse) return result;
  if (!roles.includes(result.role)) {
    return NextResponse.json(
      { error: "You don't have permission to do that." },
      { status: 403 }
    );
  }
  return result;
}

export function isAuthFailure(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}
