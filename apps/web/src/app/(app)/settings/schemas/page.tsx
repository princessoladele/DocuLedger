"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { SchemaDto } from "@/lib/types";

export default function SchemasPage() {
  const [schemas, setSchemas] = useState<SchemaDto[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SchemaDto[]>("/schemas").then(setSchemas);
  }, []);

  const byIndustry = schemas.reduce<Record<string, SchemaDto[]>>((acc, s) => {
    (acc[s.industry] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Document schemas</h1>
        <p className="text-sm text-slate-500">
          Built-in industry templates plus any custom schemas your organization has defined.
        </p>
      </div>

      {Object.entries(byIndustry).map(([industry, list]) => (
        <div key={industry}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {industry.replace("_", " ")}
          </h2>
          <div className="space-y-2">
            {list.map((schema) => (
              <div key={schema.id} className="card p-4">
                <button
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setExpanded(expanded === schema.id ? null : schema.id)}
                >
                  <div>
                    <p className="font-medium text-slate-800">{schema.name}</p>
                    <p className="text-xs text-slate-500">
                      {schema.organizationId ? "Custom" : "Built-in"} &middot; v{schema.version} &middot;{" "}
                      confidence threshold {Math.round(schema.confidenceThreshold * 100)}%
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">{expanded === schema.id ? "Hide fields" : "Show fields"}</span>
                </button>
                {expanded === schema.id && (
                  <table className="mt-4 w-full text-sm">
                    <thead className="text-left text-xs uppercase text-slate-400">
                      <tr>
                        <th className="py-1">Field</th>
                        <th className="py-1">Type</th>
                        <th className="py-1">Required</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schema.fields.map((f) => (
                        <tr key={f.name}>
                          <td className="py-1.5 text-slate-700">{f.label}</td>
                          <td className="py-1.5 text-slate-500">{f.type}</td>
                          <td className="py-1.5 text-slate-500">{f.required ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
