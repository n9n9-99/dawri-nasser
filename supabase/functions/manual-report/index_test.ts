import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildReportModel } from "./report.ts";
import { renderArabicPdf } from "./pdf.ts";
import { handleRequest, type ManualReportDeps } from "./index.ts";

const rows = [
  { transaction_no: "3", subject: "ج", entity: "ج", status: "قيد الإجراء", required_action: "متابعة" },
  { transaction_no: "2", subject: "ب", entity: "ب", status: "منتهية", required_action: "—" },
  { transaction_no: "1", subject: "أ", entity: "أ", status: "متأخرة", required_action: "عاجل" },
];

test("orders open rows and excludes completed rows", () => {
  const model = buildReportModel(rows, "2026-09-20");
  assert.deepEqual(model.rows.map((row) => row.status), ["متأخرة", "قيد الإجراء"]);
});

test("renders PDF bytes", async () => {
  const model = buildReportModel(rows, "2026-09-20");
  const localFontBytes = new Uint8Array(
    await readFile("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
  );
  const bytes = await renderArabicPdf(model, localFontBytes);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
  assert.ok(bytes.length > 1000);
});

test("renders Arabic PDF with the production font asset", async () => {
  const model = buildReportModel(rows, "2026-09-20");
  const bytes = await renderArabicPdf(model);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
  assert.ok(bytes.length > 1000);
});

function fakeDeps(overrides: Partial<ManualReportDeps> = {}): ManualReportDeps {
  return {
    verifyUser: async () => ({ id: "admin-user" }),
    getProfileRole: async () => "admin",
    syncStatuses: async () => {},
    listOpenTransactions: async () => rows.filter((row) => row.status !== "منتهية"),
    renderPdf: async () => new TextEncoder().encode("%PDF-test"),
    now: () => new Date("2026-09-20T12:00:00Z"),
    ...overrides,
  };
}

function postRequest(token = "test-session-token") {
  return new Request("https://local/manual-report", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
}

test("answers CORS preflight without authentication", async () => {
  const response = await handleRequest(
    new Request("https://local/manual-report", { method: "OPTIONS" }),
    fakeDeps(),
  );
  assert.equal(response.status, 204);
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /authorization/i);
});

test("rejects non-POST requests", async () => {
  const response = await handleRequest(new Request("https://local/manual-report"), fakeDeps());
  assert.equal(response.status, 405);
});

test("rejects requests without a session", async () => {
  const response = await handleRequest(
    new Request("https://local/manual-report", { method: "POST" }),
    fakeDeps(),
  );
  assert.equal(response.status, 401);
});

test("rejects a staff profile", async () => {
  const response = await handleRequest(
    postRequest(),
    fakeDeps({ getProfileRole: async () => "staff" }),
  );
  assert.equal(response.status, 403);
});

test("returns no content when there are no open transactions", async () => {
  const response = await handleRequest(
    postRequest(),
    fakeDeps({ listOpenTransactions: async () => [] }),
  );
  assert.equal(response.status, 204);
});

test("returns an uncached PDF to an authenticated admin", async () => {
  const response = await handleRequest(postRequest(), fakeDeps());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-disposition") ?? "", /legal-open-transactions-2026-09-20\.pdf/);
  assert.equal(new TextDecoder().decode(await response.arrayBuffer()), "%PDF-test");
});

test("does not expose credentials in internal errors", async () => {
  const response = await handleRequest(
    postRequest("jwt-secret-value"),
    fakeDeps({
      syncStatuses: async () => {
        throw new Error("service_role=super-secret Bearer jwt-secret-value");
      },
    }),
  );
  const body = await response.text();
  assert.equal(response.status, 500);
  assert.doesNotMatch(body, /super-secret|jwt-secret-value/);
});
