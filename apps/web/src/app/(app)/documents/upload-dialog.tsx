"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { SchemaDto } from "@/lib/types";

export function UploadDialog({
  open,
  schemas,
  onClose,
  onUploaded,
}: {
  open: boolean;
  schemas: SchemaDto[];
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [schemaId, setSchemaId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (schemaId) formData.append("schemaId", schemaId);
      await apiFetch("/documents", { method: "POST", body: formData, isForm: true });
      setFile(null);
      setSchemaId("");
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-slate-900">Upload a document</h2>
        <p className="mt-1 text-sm text-slate-500">PDF, PNG, JPEG, TIFF, or .eml — up to 25MB.</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">File</label>
            <input
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.eml"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Schema (optional)</label>
            <select className="input" value={schemaId} onChange={(e) => setSchemaId(e.target.value)}>
              <option value="">No schema — store raw only</option>
              {schemas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.industry})
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting || !file}>
              {submitting ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
