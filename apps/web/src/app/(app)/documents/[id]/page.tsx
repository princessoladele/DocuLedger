"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { DocumentDto } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { ConfidenceBar } from "@/components/confidence-bar";

interface VerifyResult {
  matchesStoredRecord: boolean;
  onChain: { found: boolean; orgId?: string; submittedAtUnix?: number };
  verified: boolean;
  stellarTxHash: string | null;
  network: string;
}

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const [doc, setDoc] = useState<DocumentDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(() => {
    apiFetch<DocumentDto>(`/documents/${params.id}`)
      .then(setDoc)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load document"));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function retry() {
    await apiFetch(`/documents/${params.id}/retry`, { method: "POST" });
    load();
  }

  async function download() {
    const { url } = await apiFetch<{ url: string }>(`/documents/${params.id}/download-url`);
    window.open(url, "_blank");
  }

  async function verifyOnChain() {
    setVerifying(true);
    try {
      const result = await apiFetch<VerifyResult>(`/stellar/verify/${params.id}`);
      setVerify(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!doc) return <p className="text-slate-500">Loading&hellip;</p>;

  const extraction = doc.extractions?.[0];
  const anchor = doc.anchorRecords?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{doc.originalFilename}</h1>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge status={doc.status} />
            <span className="text-sm text-slate-500">{doc.schema?.name ?? "No schema"}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={download}>
            Download original
          </button>
          {doc.status === "FAILED" && (
            <button className="btn-primary" onClick={retry}>
              Retry
            </button>
          )}
        </div>
      </div>

      {doc.failureReason && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">{doc.failureReason}</div>
      )}

      {extraction && (
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Extracted fields</h2>
            <span className="text-xs text-slate-500">
              Engine: {extraction.engine} &middot; Overall confidence:{" "}
              {Math.round(extraction.overallConfidence * 100)}%
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2">Field</th>
                <th className="py-2">Value</th>
                <th className="py-2">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {extraction.fields.map((f) => (
                <tr key={f.name}>
                  <td className="py-2 pr-4 font-medium text-slate-700">{f.label}</td>
                  <td className="py-2 pr-4 text-slate-600">{f.value ?? <span className="text-slate-400">missing</span>}</td>
                  <td className="py-2">
                    <ConfidenceBar confidence={f.confidence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {doc.validationIssues && doc.validationIssues.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Validation issues</h2>
          <ul className="space-y-2">
            {doc.validationIssues.map((issue) => (
              <li
                key={issue.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  issue.severity === "ERROR" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
                }`}
              >
                <span className="font-medium">{issue.field}:</span> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Stellar anchor</h2>
          {anchor && (
            <button className="btn-secondary text-xs" onClick={verifyOnChain} disabled={verifying}>
              {verifying ? "Verifying..." : "Verify on-chain"}
            </button>
          )}
        </div>
        {anchor ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-800">{anchor.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Network</dt>
              <dd className="font-medium text-slate-800">{anchor.network}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">Transaction hash</dt>
              <dd className="break-all font-mono text-xs text-slate-700">{anchor.stellarTxHash ?? "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">Fingerprint (sha256 of extracted data)</dt>
              <dd className="break-all font-mono text-xs text-slate-700">{anchor.fingerprint}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-500">Not yet anchored.</p>
        )}

        {verify && (
          <div
            className={`mt-4 rounded-lg p-3 text-sm ${
              verify.verified ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {verify.verified
              ? "Verified: the current extracted data matches the fingerprint anchored on-chain."
              : "Mismatch: the current data does not match the on-chain fingerprint — investigate."}
          </div>
        )}
      </div>
    </div>
  );
}
