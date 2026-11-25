import { NextResponse } from "next/server";
import { noShowDailyCsv, type NoShowReportEvent } from "@/lib/data/open-play-no-show-billing";
import { noShowFacilityId, validCalendarDate } from "@/lib/data/open-play-no-shows";
import { requireStaffUser, staffApiDenial } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    await requireStaffUser();
  } catch (error) {
    return staffApiDenial(error);
  }

  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!validCalendarDate(date)) {
    return NextResponse.json({ error: "Choose a valid report date." }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin.rpc("open_play_no_show_daily_report", {
    report_facility: noShowFacilityId, report_date: date,
  });
  if (error) {
    console.error("Unable to download the open-play no-show report:", error.code);
    return NextResponse.json({ error: "Unable to download the report. Try again." }, { status: 500 });
  }

  return new Response(noShowDailyCsv(date, data as NoShowReportEvent[]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lynnwood-no-shows-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
