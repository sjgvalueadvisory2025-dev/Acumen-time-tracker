import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { csvCell, parseFilters, reportRows, reportSummary } from "@/lib/reports";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const filters = parseFilters(user, Object.fromEntries(req.nextUrl.searchParams));
  const summaryOnly = req.nextUrl.searchParams.get("type") === "summary";

  let lines: string[];
  if (summaryOnly) {
    const rows = await reportSummary(filters);
    lines = [
      "Project,Person,Email,Entries,Hours",
      ...rows.map((r) => [r.project, r.person, r.email, r.entries, r.hours.toFixed(2)].map(csvCell).join(",")),
    ];
  } else {
    const rows = await reportRows(filters);
    lines = [
      "Date,Project,Person,Email,Task,Hours,Work done",
      ...rows.map((r) =>
        [r.work_date, r.project, r.person, r.email, r.task, r.hours.toFixed(2), r.description].map(csvCell).join(","),
      ),
    ];
  }

  const range = filters.from === "1900-01-01" ? "all-time" : `${filters.from}_to_${filters.to}`;
  const filename = `time-report-${summaryOnly ? "summary-" : ""}${range}.csv`;
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
