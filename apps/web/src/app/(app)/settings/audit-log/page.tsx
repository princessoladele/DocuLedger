"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorType: string;
  actor: { name: string; email: string } | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    apiFetch<{ items: AuditEntry[] }>("/audit-log").then((r) => setEntries(r.items));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audit log</h1>
        <p className="text-sm text-slate-500">Every mutating action taken in your organization.</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{e.action}</td>
                <td className="px-4 py-3 text-slate-600">
                  {e.resourceType}
                  {e.resourceId ? ` #${e.resourceId.slice(0, 8)}` : ""}
                </td>
                <td className="px-4 py-3 text-slate-600">{e.actor ? e.actor.name : e.actorType}</td>
                <td className="px-4 py-3 text-slate-500">{e.ipAddress ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(e.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
