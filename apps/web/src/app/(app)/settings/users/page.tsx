"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";

interface OrgUser {
  id: string;
  email: string;
  name: string;
  role: "MEMBER" | "REVIEWER" | "ADMIN" | "OWNER";
  isActive: boolean;
}

const ROLES = ["MEMBER", "REVIEWER", "ADMIN", "OWNER"] as const;

export default function UsersPage() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [form, setForm] = useState({ email: "", name: "", role: "MEMBER" as OrgUser["role"], temporaryPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiFetch<OrgUser[]>("/users").then(setUsers);
  }

  useEffect(load, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/users/invite", { method: "POST", body: JSON.stringify(form) });
      setForm({ email: "", name: "", role: "MEMBER", temporaryPassword: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to invite user");
    } finally {
      setSubmitting(false);
    }
  }

  async function setRole(id: string, role: OrgUser["role"]) {
    await apiFetch(`/users/${id}`, { method: "PATCH", body: JSON.stringify({ role }) });
    load();
  }

  async function toggleActive(user: OrgUser) {
    await apiFetch(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !user.isActive }) });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Team</h1>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <select className="input" value={u.role} onChange={(e) => setRole(u.id, e.target.value as OrgUser["role"])}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">{u.isActive ? "Active" : "Deactivated"}</td>
                <td className="px-4 py-3 text-right">
                  <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => toggleActive(u)}>
                    {u.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card max-w-md p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Invite a teammate</h2>
        <form onSubmit={invite} className="space-y-3">
          <input
            className="input"
            placeholder="Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Temporary password (min 10 chars)"
            type="text"
            required
            minLength={10}
            value={form.temporaryPassword}
            onChange={(e) => setForm((f) => ({ ...f, temporaryPassword: e.target.value }))}
          />
          <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as OrgUser["role"] }))}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Inviting..." : "Invite"}
          </button>
        </form>
      </div>
    </div>
  );
}
