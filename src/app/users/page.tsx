"use client";

import { useEffect, useRef, useState } from "react";
import { BASE_PATH } from "@/lib/basePath";

type SessionUser = { id: number; name: string; role: "admin" | "clerk" | "viewer" } | null;
type Role = "admin" | "clerk" | "viewer";
type User = {
  id: number;
  name: string;
  email: string;
  active: boolean;
  accessAssetRegister: boolean;
  role: Role | null;
};

const ROLES: Role[] = ["admin", "clerk", "viewer"];
const ROLE_LABEL: Record<Role, string> = { admin: "Admin", clerk: "Clerk", viewer: "Viewer" };

export default function UsersPage() {
  const [session, setSession] = useState<SessionUser>(null);
  const [checking, setChecking] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const manageDialogRef = useRef<HTMLDialogElement>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  async function refresh() {
    const [sessionRes, usersRes] = await Promise.all([
      fetch(`${BASE_PATH}/api/session`).then((r) => r.json()),
      fetch(`${BASE_PATH}/api/users`).then((r) => (r.ok ? r.json() : { users: [] })),
    ]);
    setSession(sessionRes.user ?? null);
    setUsers(usersRes.users ?? []);
    setChecking(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  function openManage(u: User) {
    setEditingUser(u);
    setStatus(null);
    manageDialogRef.current?.showModal();
  }

  if (checking) return null;

  if (session?.role !== "admin") {
    return <main className="mx-auto max-w-2xl p-6 text-sm text-ink-dim">Users is for Admins only.</main>;
  }

  return (
    <main className="mx-auto max-w-2xl p-4 pb-16 sm:p-6">
      <h1 className="mb-1 font-display text-xl font-semibold">Users</h1>
      <p className="mb-6 text-xs text-ink-dim">
        Accounts are managed on the main site — this only controls asset register access. Admin can manage
        assets, users and settings. Clerk can add/edit assets and record adjustments. Viewer is read-only.
      </p>

      {status && <p className="mb-4 text-sm text-ink-dim">{status}</p>}

      <div className="card divide-y divide-line overflow-hidden">
        {users.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-dim">No accounts found.</p>
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{u.name}</div>
                <div className="truncate text-xs text-ink-dim">{u.email}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {u.accessAssetRegister && u.role ? (
                  <span className="pill bg-surface-2 text-ink-dim">{ROLE_LABEL[u.role]}</span>
                ) : (
                  <span className="pill pill-over">No access</span>
                )}
                <button type="button" className="btn-secondary" onClick={() => openManage(u)}>
                  Manage
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <ManageUserDialog
        dialogRef={manageDialogRef}
        user={editingUser}
        isSelf={editingUser?.id === session?.id}
        onSaved={(message) => {
          manageDialogRef.current?.close();
          setStatus(message);
          refresh();
        }}
      />
    </main>
  );
}

function ManageUserDialog({
  dialogRef,
  user,
  isSelf,
  onSaved,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  user: User | null;
  isSelf: boolean;
  onSaved: (message: string) => void;
}) {
  const [accessAssetRegister, setAccessAssetRegister] = useState(false);
  const [role, setRole] = useState<Role>("clerk");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccessAssetRegister(user.accessAssetRegister);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRole(user.role ?? "clerk");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
  }, [user]);

  async function save() {
    if (!user) return;
    setError(null);
    setSaving(true);

    const res = await fetch(`${BASE_PATH}/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessAssetRegister, role: accessAssetRegister ? role : user.role }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't update access.");
      return;
    }

    onSaved(accessAssetRegister ? `Updated ${user.name}.` : `Removed asset register access for ${user.name}.`);
  }

  if (!user) return null;

  return (
    <dialog ref={dialogRef} className="w-[420px] max-w-[92vw] rounded-2xl border-0 bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40">
      <div className="flex flex-col gap-3 p-6">
        <h3 className="font-display text-lg font-semibold">Manage access</h3>
        <div>
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-xs text-ink-dim">{user.email}</div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={accessAssetRegister}
            onChange={(e) => setAccessAssetRegister(e.target.checked)}
            disabled={isSelf}
          />
          Asset register access
        </label>
        {isSelf && <p className="-mt-2 text-[11px] text-ink-dim">You can&apos;t remove your own access.</p>}

        {accessAssetRegister && (
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-ink-dim">
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input-field normal-case">
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </label>
        )}

        {error && <p className="text-xs text-bad">{error}</p>}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button type="button" disabled={saving} onClick={save} className="btn-primary">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
