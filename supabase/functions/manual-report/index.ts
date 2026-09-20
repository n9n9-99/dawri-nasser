import { createClient } from "@supabase/supabase-js";
import { renderArabicPdf } from "./pdf.ts";
import { buildReportModel, type TransactionRow } from "./report.ts";

export type ManualReportDeps = {
  verifyUser(token: string): Promise<{ id: string } | null>;
  getProfileRole(userId: string): Promise<string | null>;
  syncStatuses(): Promise<void>;
  listOpenTransactions(): Promise<TransactionRow[]>;
  renderPdf(model: ReturnType<typeof buildReportModel>): Promise<Uint8Array>;
  now(): Date;
};

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function riyadhDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function bearerToken(req: Request): string | null {
  const value = req.headers.get("authorization") ?? "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function handleRequest(req: Request, deps: ManualReportDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

  const token = bearerToken(req);
  if (!token) return jsonResponse(401, { ok: false, error: "Authentication required" });

  try {
    const user = await deps.verifyUser(token);
    if (!user) return jsonResponse(401, { ok: false, error: "Session expired" });

    const role = await deps.getProfileRole(user.id);
    if (role !== "admin") return jsonResponse(403, { ok: false, error: "Admin access required" });

    await deps.syncStatuses();
    const rows = await deps.listOpenTransactions();
    if (rows.length === 0) {
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS, "cache-control": "no-store" },
      });
    }

    const reportDate = riyadhDate(deps.now());
    const pdfBytes = await deps.renderPdf(buildReportModel(rows, reportDate));
    return new Response(pdfBytes as BodyInit, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="legal-open-transactions-${reportDate}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return jsonResponse(500, { ok: false, error: "Unable to create report" });
  }
}

function requireEnv(name: string): string {
  const runtimeDeno = (globalThis as { Deno?: { env: { get(name: string): string | undefined } } }).Deno;
  const value = runtimeDeno?.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function createProductionDeps(): ManualReportDeps {
  const client = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const assertNoError = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };

  return {
    async verifyUser(token) {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return null;
      return { id: data.user.id };
    },
    async getProfileRole(userId) {
      const { data, error } = await client.from("profiles").select("role").eq("id", userId).maybeSingle();
      assertNoError(error);
      return data?.role ?? null;
    },
    async syncStatuses() {
      const { error } = await client.rpc("sync_followup_statuses_system");
      assertNoError(error);
    },
    async listOpenTransactions() {
      const { data, error } = await client
        .from("transactions")
        .select("transaction_no,subject,entity,status,required_action,entry_date,notes")
        .neq("status", "منتهية");
      assertNoError(error);
      return (data ?? []) as TransactionRow[];
    },
    renderPdf: renderArabicPdf,
    now: () => new Date(),
  };
}

const runtimeDeno = (globalThis as {
  Deno?: { serve(handler: (req: Request) => Promise<Response>): void };
}).Deno;

if (runtimeDeno && import.meta.main) {
  const deps = createProductionDeps();
  runtimeDeno.serve((req) => handleRequest(req, deps));
}
