"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { ReviewTaskDto } from "@/lib/types";

export default function ReviewQueuePage() {
  const [tasks, setTasks] = useState<ReviewTaskDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ReviewTaskDto[]>("/review?status=PENDING")
      .then(setTasks)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Review queue</h1>
        <p className="text-sm text-slate-500">
          Documents whose extraction failed validation or fell below the confidence threshold.
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Schema</th>
              <th className="px-4 py-3">Queued since</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{task.document.originalFilename}</td>
                <td className="px-4 py-3 text-slate-600">{task.document.schema?.name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(task.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/review/${task.id}`} className="font-medium text-brand-600 hover:underline">
                    Review
                  </Link>
                </td>
              </tr>
            ))}
            {!loading && tasks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Nothing pending review. 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
