"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { DocumentDto, SchemaDto } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { UploadDialog } from "./upload-dialog";

const STATUS_FILTERS = [
  "",
  "UPLOADED",
  "QUEUED",
  "PROCESSING",
  "VALIDATING",
  "NEEDS_REVIEW",
  "REVIEWED",
  "ANCHORED",
  "FAILED",
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [schemas, setSchemas] = useState<SchemaDto[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const query = status ? `?status=${status}` : "";
    apiFetch<{ items: DocumentDto[]; total: number }>(`/documents${query}`)
      .then((res) => {
        setDocuments(res.items);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiFetch<SchemaDto[]>("/schemas").then(setSchemas).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
          <p className="text-sm text-slate-500">{total} total</p>
        </div>
        <button className="btn-primary" onClick={() => setUploadOpen(true)}>
          Upload document
        </button>
      </div>

      <div className="flex gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status === s ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Schema</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Uploaded by</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/documents/${doc.id}`} className="font-medium text-brand-700 hover:underline">
                    {doc.originalFilename}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{doc.schema?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-4 py-3 text-slate-600">{doc.uploadedBy?.name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(doc.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {!loading && documents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No documents yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <UploadDialog
        open={uploadOpen}
        schemas={schemas}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setUploadOpen(false);
          load();
        }}
      />
    </div>
  );
}
