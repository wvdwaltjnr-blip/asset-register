import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { redirect } from "next/navigation";
import "./globals.css";
import { getSessionUser, fullName } from "@/lib/clockinSession";
import NavBar from "@/components/NavBar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Asset Register",
  description: "Company vehicle & trailer asset register, with automatic straight-line depreciation.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sessionUser = await getSessionUser();

  // proxy.ts already redirects requests with no session cookie at all — this
  // covers the case where the cookie is present but no longer resolves to a
  // valid session (expired, signed out elsewhere since the cookie was set).
  if (!sessionUser) {
    redirect("/login");
  }

  const hasAccess = sessionUser.accessAssetRegister && sessionUser.assetRegisterRole;
  const currentUser = hasAccess
    ? { id: sessionUser.id, name: fullName(sessionUser), email: sessionUser.email, role: sessionUser.assetRegisterRole! }
    : null;

  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${plexMono.variable}`}>
      <body className="min-h-full bg-background">
        {hasAccess ? (
          <div className="flex min-h-full flex-col md:flex-row">
            <NavBar currentUser={currentUser} />
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        ) : (
          <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
            <h1 className="font-display text-lg font-semibold">No access to the Asset Register</h1>
            <p className="text-sm text-ink-dim">
              {fullName(sessionUser)}, your account doesn&apos;t have access to the asset register yet. Ask an
              admin to grant it from the Users screen.
            </p>
            {/* Deliberately a plain <a>, not next/link — "/" here means the
                site root outside this app's basePath, not this app's own
                (inaccessible) home page, which next/link would resolve to. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="btn-secondary">Back to the main site</a>
          </main>
        )}
      </body>
    </html>
  );
}
