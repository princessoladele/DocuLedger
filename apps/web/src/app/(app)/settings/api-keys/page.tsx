"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface ApiKey {
  id: string;
  name: string;
  role: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiFetch<ApiKey[]>("/api-keys").then(setKeys);
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await apiFetch<{ apiKey: string }>("/api-keys", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNewKey(result.apiKey);
      setName("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(id: string) {
    await apiFetch(`/api-keys/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">API keys</h1>
        <p className="text-sm text-slate-500">Use these to submit documents programmatically via the API.</p>
      </div>

      {newKey && (
        <div className="card border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">Copy this key now — it won&apos;t be shown again:</p>
          <code className="mt-2 block break-all rounded bg-white px-3 py-2 text-sm">{newKey}</code>
        </div>
      )}

      <form onSubmit={create} className="card flex max-w-md items-end gap-2 p-4">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">Key name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={submitting}>
          Create
        </button>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Prefix</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Last used</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {keys.map((k) => (
              <tr key={k.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{k.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{k.keyPrefix}&hellip;</td>
                <td className="px-4 py-3 text-slate-600">{k.role}</td>
                <td className="px-4 py-3 text-slate-500">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}</td>
                <td className="px-4 py-3">{k.revokedAt ? "Revoked" : "Active"}</td>
                <td className="px-4 py-3 text-right">
                  {!k.revokedAt && (
                    <button className="text-xs font-medium text-red-600 hover:underline" onClick={() => revoke(k.id)}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
