"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { ExtractedFieldDto, ValidationIssueDto } from "@/lib/types";
import { ConfidenceBar } from "@/components/confidence-bar";

interface ReviewTaskDetail {
  id: string;
  status: string;
  document: {
    id: string;
    originalFilename: string;
    extractions: { fields: ExtractedFieldDto[]; overallConfidence: number; engine: string }[];
    validationIssues: ValidationIssueDto[];
  };
}

export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<ReviewTaskDetail | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<ReviewTaskDetail>(`/review/${params.id}`).then(setTask);
  }, [params.id]);

  if (!task) return <p className="text-slate-500">Loading&hellip;</p>;

  const extraction = task.document.extractions[0];
  const issuesByField = new Map(task.document.validationIssues.map((i) => [i.field, i]));

  async function approve() {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/review/${params.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ correctedFields: corrections, reviewerNotes: notes || undefined }),
      });
      router.push("/review");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to approve");
    } finally {
      setSubmitting(false);
    }
  }

  async function reject() {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/review/${params.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reviewerNotes: notes || "Rejected during manual review" }),
      });
      router.push("/review");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reject");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">{task.document.originalFilename}</h1>

      <div className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          Extracted fields &middot; overall confidence {Math.round((extraction?.overallConfidence ?? 0) * 100)}%
        </h2>
        <div className="space-y-4">
          {extraction?.fields.map((f) => {
            const issue = issuesByField.get(f.name);
            return (
              <div key={f.name} className="border-b border-slate-100 pb-4 last:border-0">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">{f.label}</label>
                  <ConfidenceBar confidence={f.confidence} />
                </div>
                <input
                  className="input"
                  defaultValue={f.value ?? ""}
                  placeholder="No value extracted"
                  onChange={(e) => setCorrections((c) => ({ ...c, [f.name]: e.target.value }))}
                />
                {issue && (
                  <p className={`mt-1 text-xs ${issue.severity === "ERROR" ? "text-red-600" : "text-amber-600"}`}>
                    {issue.message}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-6">
        <label className="mb-1 block text-sm font-medium text-slate-700">Reviewer notes</label>
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3">
        <button className="btn-secondary" onClick={reject} disabled={submitting}>
          Reject
        </button>
        <button className="btn-primary" onClick={approve} disabled={submitting}>
          Approve & anchor
        </button>
      </div>
    </div>
  );
}
