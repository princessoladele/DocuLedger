"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { apiFetch } from "@/lib/api-client";
import { DashboardSummary } from "@/lib/types";

function Tile({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardSummary>("/dashboard/summary")
      .then(setSummary)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!summary) return <p className="text-slate-500">Loading dashboard&hellip;</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Processing health across your organization.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Tile label="Total documents" value={summary.totalDocuments} accent="text-slate-900" />
        <Tile label="Successful" value={summary.buckets.successful} accent="text-emerald-600" />
        <Tile label="Pending" value={summary.buckets.pending} accent="text-blue-600" />
        <Tile label="Needs review" value={summary.buckets.needsReview} accent="text-amber-600" />
        <Tile label="Failed" value={summary.buckets.failed} accent="text-red-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tile label="Anchored on Stellar" value={summary.anchoredCount} accent="text-indigo-600" />
        <Tile label="Pending review tasks" value={summary.pendingReviewTasks} accent="text-amber-600" />
        <Tile label="Dead-letter jobs" value={summary.deadLetterCount} accent="text-red-600" />
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Last 7 days: throughput</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={summary.last7DaysDaily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Total" />
            <Bar dataKey="anchored" fill="#10b981" radius={[4, 4, 0, 0]} name="Anchored" />
            <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} name="Failed" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
