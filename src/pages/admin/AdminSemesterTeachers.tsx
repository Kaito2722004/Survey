// src/pages/admin/AdminSemesterTeachers.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  FileSpreadsheet,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type SectionRow = {
  id: string;
  sem: number;
  year_level: number;
  program: string;
  specialization: string;
};

type ParsedTeacher = {
  teacher_id: string;
  name: string;
  email: string | null;
  section_id: string;
  _row: number;
  _errors: string[];
};

type ImportResult = {
  success: number;
  failed: number;
  errors: { row: number; teacher_id: string; error: string }[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isAbortError(err: unknown) {
  return String((err as any)?.message ?? "")
    .toLowerCase()
    .includes("abort");
}

function cellStr(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AdminSemesterTeachers() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [parsed, setParsed] = useState<ParsedTeacher[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [fileName, setFileName] = useState("");

  // ── Load sections ──────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("sections")
          .select("id,sem,year_level,program,specialization")
          .order("year_level", { ascending: true });
        if (error) throw error;
        if (alive) setSections((data ?? []) as SectionRow[]);
      } catch (e: unknown) {
        if (!isAbortError(e))
          toast.error(String((e as any)?.message ?? "Failed to load sections"));
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  // ── Download sample template ───────────────────────────────────────────────
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    const teacherData = [
      ["teacher_id *", "name *", "email", "section_id * (UUID)"],
      [
        "TCH-001",
        "Dr. Jose Rizal",
        "jose@school.edu",
        sections[0]?.id ?? "<section UUID>",
      ],
      [
        "TCH-002",
        "Prof. Andres Boni",
        "andres@school.edu",
        sections[1]?.id ?? "<section UUID>",
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(teacherData);
    ws["!cols"] = [22, 26, 28, 38].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "Teachers");

    const secData = [
      ["section_id (UUID)", "sem", "year_level", "program", "specialization"],
      ...sections.map((s) => [
        s.id,
        s.sem,
        s.year_level,
        s.program,
        s.specialization,
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(secData);
    ws2["!cols"] = [38, 8, 12, 22, 24].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, "Sections (Reference)");

    XLSX.writeFile(wb, "teachers_import_template.xlsx");
  };

  // ── Parse uploaded file ────────────────────────────────────────────────────
  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      setResult(null);
      setParsed([]);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
            defval: "",
          });

          const sectionIds = new Set(sections.map((s) => s.id));

          const teachers: ParsedTeacher[] = rows.map((row, i) => {
            const errors: string[] = [];

            const teacher_id = cellStr(
              row["teacher_id *"] ?? row["teacher_id"],
            );
            const name = cellStr(row["name *"] ?? row["name"]);
            const email = cellStr(row["email"]) || null;
            const section_id = cellStr(
              row["section_id * (UUID)"] ?? row["section_id"],
            );

            if (!teacher_id) errors.push("teacher_id is required");
            if (!name) errors.push("name is required");
            if (!section_id) errors.push("section_id is required");
            else if (!sectionIds.has(section_id))
              errors.push(
                `section_id "${section_id}" not found in sections table`,
              );

            return {
              teacher_id,
              name,
              email,
              section_id,
              _row: i + 2,
              _errors: errors,
            };
          });

          // Strip header-lookalike rows
          const valid = teachers.filter(
            (t) =>
              t.teacher_id.toLowerCase() !== "teacher_id *" &&
              t.teacher_id.toLowerCase() !== "teacher_id",
          );

          setParsed(valid);
          setShowPreview(true);
        } catch {
          toast.error(
            "Failed to parse file. Make sure it's a valid .xlsx file.",
          );
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [sections],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  // ── Import to Supabase ─────────────────────────────────────────────────────
  const runImport = async () => {
    const toInsert = parsed.filter((t) => t._errors.length === 0);
    if (!toInsert.length) {
      toast.error("No valid rows to import.");
      return;
    }

    setImporting(true);
    const failed: ImportResult["errors"] = [];
    let success = 0;

    for (const t of toInsert) {
      const payload: Record<string, unknown> = {
        teacher_id: t.teacher_id,
        name: t.name,
        section_id: t.section_id,
      };
      // email is not in teachers table schema — only insert if your teachers table has it
      // if (t.email) payload.email = t.email;

      const { error } = await supabase
        .from("teachers")
        .upsert(payload, { onConflict: "teacher_id" });

      if (error) {
        failed.push({
          row: t._row,
          teacher_id: t.teacher_id,
          error: error.message,
        });
      } else {
        success++;
      }
    }

    setResult({ success, failed: failed.length, errors: failed });
    setImporting(false);

    if (failed.length === 0) {
      toast.success(
        `${success} teacher${success !== 1 ? "s" : ""} imported successfully!`,
      );
      setParsed([]);
      setShowPreview(false);
      setFileName("");
    } else {
      toast.error(`${failed.length} row(s) failed. Check the error log below.`);
    }
  };

  const validCount = parsed.filter((t) => t._errors.length === 0).length;
  const invalidCount = parsed.filter((t) => t._errors.length > 0).length;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* Page header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Admin · Teachers
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Import Teachers via Excel
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload an Excel file to bulk-insert teachers into the database.
            Download the template to see the required format.
          </p>
        </div>

        {/* Download template */}
        <div className="rounded-xl border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              Download Sample Template
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Includes a <strong>Sections (Reference)</strong> sheet with real
              section UUIDs from the database so you can copy-paste them easily.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            onClick={downloadTemplate}
            disabled={loading}
          >
            <Download className="h-4 w-4" />
            Download Template
          </Button>
        </div>

        {/* Column reference */}
        <div className="rounded-xl border bg-muted/30 p-5 space-y-3">
          <p className="font-semibold text-sm">
            Required Column Format (Teachers sheet)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  {["Column", "DB Field", "Required", "Notes"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 border border-border font-semibold"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "teacher_id *",
                    "teachers.teacher_id",
                    "✅ Yes",
                    "Unique text key e.g. TCH-001",
                  ],
                  ["name *", "teachers.name", "✅ Yes", "Full name"],
                  [
                    "email",
                    "(reference only)",
                    "Optional",
                    "Not stored in teachers table per current schema",
                  ],
                  [
                    "section_id * (UUID)",
                    "teachers.section_id",
                    "✅ Yes",
                    "UUID from sections table — see Sections sheet",
                  ],
                ].map(([col, field, req, note]) => (
                  <tr
                    key={col}
                    className="border-b border-border hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 border border-border font-mono text-[11px] font-semibold text-primary">
                      {col}
                    </td>
                    <td className="px-3 py-2 border border-border font-mono text-[11px]">
                      {field}
                    </td>
                    <td className="px-3 py-2 border border-border">{req}</td>
                    <td className="px-3 py-2 border border-border text-muted-foreground">
                      {note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sections reference */}
        <div className="rounded-xl border bg-muted/30 p-5 space-y-3">
          <p className="font-semibold text-sm flex items-center gap-2">
            📋 Sections Reference — copy these UUIDs into your Excel file
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted">
                  {[
                    "#",
                    "section_id (UUID)",
                    "Year",
                    "Program",
                    "Specialization",
                    "Sem",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 border border-border font-semibold whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    1,
                    "706c8a45-fe21-4f63-9882-a2ef5eb9c18e",
                    "Year 1",
                    "Computer Science and Technology",
                    "CST",
                    1,
                  ],
                  [
                    2,
                    "57c11343-d841-4115-bf14-88e9e73422f5",
                    "Year 2",
                    "Computer Science and Technology",
                    "CST",
                    1,
                  ],
                  [
                    3,
                    "c5ad8fc8-6470-4f48-a99e-ca5cce2e8190",
                    "Year 3",
                    "Computer Technology",
                    "CT",
                    1,
                  ],
                  [
                    4,
                    "cd5c9710-e7a4-4ece-8bba-f7e0103aefa0",
                    "Year 3",
                    "Computer Science",
                    "CS",
                    1,
                  ],
                  [
                    5,
                    "14eab446-e650-42c9-8d53-014b2230fa7e",
                    "Year 4",
                    "Computer Technology",
                    "CSEC",
                    1,
                  ],
                  [
                    6,
                    "2cdd405f-2716-4837-9f63-14cc03e34f68",
                    "Year 4",
                    "Computer Technology",
                    "CN",
                    1,
                  ],
                  [
                    7,
                    "bb76f197-0456-48fd-bd8a-6e520db18e61",
                    "Year 4",
                    "Computer Technology",
                    "ES",
                    1,
                  ],
                  [
                    8,
                    "d2b70b46-91af-422a-b58f-d5d8e1965abe",
                    "Year 4",
                    "Computer Science",
                    "BIS",
                    1,
                  ],
                  [
                    9,
                    "e4182620-b295-420d-8a04-403ecd66b491",
                    "Year 4",
                    "Computer Science",
                    "HPC",
                    1,
                  ],
                  [
                    10,
                    "fb4bbc5a-0a98-4774-ae8a-6e4170f74561",
                    "Year 4",
                    "Computer Science",
                    "SE",
                    1,
                  ],
                  [
                    11,
                    "fc4797e8-8aa2-4df9-96ff-9e3ec569a1de",
                    "Year 4",
                    "Computer Science",
                    "KE",
                    1,
                  ],
                ].map(([num, uuid, year, program, spec, sem]) => (
                  <tr
                    key={String(uuid)}
                    className="border-b border-border hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 border border-border text-muted-foreground">
                      {num}
                    </td>
                    <td className="px-3 py-2 border border-border">
                      <button
                        className="font-mono text-[11px] text-primary hover:underline cursor-copy text-left"
                        onClick={() => {
                          navigator.clipboard.writeText(String(uuid));
                          toast.success("UUID copied!");
                        }}
                        title="Click to copy"
                      >
                        {String(uuid)}
                      </button>
                    </td>
                    <td className="px-3 py-2 border border-border whitespace-nowrap">
                      {year}
                    </td>
                    <td className="px-3 py-2 border border-border">
                      {program}
                    </td>
                    <td className="px-3 py-2 border border-border font-semibold">
                      {spec}
                    </td>
                    <td className="px-3 py-2 border border-border text-center">
                      {sem}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            💡 Click any UUID to copy it to clipboard.
          </p>
        </div>

        {/* Upload zone */}
        <div
          className="rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-card transition-colors cursor-pointer p-8 text-center space-y-3"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
          <div>
            <p className="font-semibold">Click to upload or drag & drop</p>
            <p className="text-sm text-muted-foreground">.xlsx files only</p>
          </div>
          {fileName && (
            <p className="text-sm font-medium text-primary">{fileName}</p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={onFileChange}
          />
        </div>

        {/* Preview */}
        {parsed.length > 0 && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/30"
              onClick={() => setShowPreview((v) => !v)}
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold">
                  Preview ({parsed.length} rows)
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                  {validCount} valid
                </span>
                {invalidCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                    {invalidCount} errors
                  </span>
                )}
              </div>
              {showPreview ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>

            {showPreview && (
              <div className="overflow-x-auto border-t">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      {[
                        "Row",
                        "teacher_id",
                        "name",
                        "email",
                        "section_id",
                        "Status",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 font-semibold border-b border-border whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsed.map((t) => (
                      <tr
                        key={t._row}
                        className={
                          t._errors.length ? "bg-red-50" : "hover:bg-muted/20"
                        }
                      >
                        <td className="px-3 py-2 text-muted-foreground">
                          {t._row}
                        </td>
                        <td className="px-3 py-2 font-mono">{t.teacher_id}</td>
                        <td className="px-3 py-2">{t.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {t.email ?? "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground truncate max-w-[160px]">
                          {t.section_id}
                        </td>
                        <td className="px-3 py-2">
                          {t._errors.length === 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <span className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-4 w-4 shrink-0" />
                              {t._errors.join("; ")}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-5 py-4 border-t flex items-center gap-3">
              {invalidCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex-1">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {invalidCount} row(s) have errors and will be skipped. Only{" "}
                  {validCount} valid row(s) will be imported.
                </div>
              )}
              <Button
                className="ml-auto gap-2"
                onClick={runImport}
                disabled={importing || validCount === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Importing…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Import {validCount} Teacher
                    {validCount !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className={[
              "rounded-xl border p-5 space-y-3",
              result.failed === 0
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50",
            ].join(" ")}
          >
            <div className="flex items-center gap-2 font-semibold">
              {result.failed === 0 ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Import
                  complete
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600" /> Import
                  finished with errors
                </>
              )}
            </div>
            <p className="text-sm">
              <span className="text-emerald-700 font-medium">
                {result.success} succeeded
              </span>
              {result.failed > 0 && (
                <span className="ml-2 text-red-700 font-medium">
                  {result.failed} failed
                </span>
              )}
            </p>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-700">
                    Row {e.row} ({e.teacher_id}): {e.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
