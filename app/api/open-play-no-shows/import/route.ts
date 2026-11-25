import { NextResponse } from "next/server";
import { noShowFacilityId, noShowFacilityName, noShowMaxFiles, noShowMaxFileSize, readNoShowRoster, validNoShowDate } from "@/lib/data/open-play-no-shows";
import { staffApiDenial, requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

class ImportInputError extends Error {}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireStaffUser();
  } catch (error) {
    return staffApiDenial(error);
  }

  try {
    const form = await request.formData().catch(() => {
      throw new ImportInputError("Unable to read the file upload.");
    });
    const files = form.getAll("file");
    const dates = form.getAll("session_date");
    const times = form.getAll("session_time");
    const names = form.getAll("session_name");
    if (form.getAll("facility_id").some((facility) => facility !== noShowFacilityId)) {
      throw new ImportInputError("This queue only accepts rosters for " + noShowFacilityName + ".");
    }
    if (!files.length || files.length > noShowMaxFiles || [dates, times, names].some((fields) => fields.length !== files.length)) {
      throw new ImportInputError("Choose one to five CSV files and enter the session details for each.");
    }
    if (form.get("completed") !== "yes") throw new ImportInputError("Confirm that the sessions have ended before importing.");

    const imports = await Promise.all(files.map(async (file, index) => {
      const date = String(dates[index]);
      const time = String(times[index]);
      const sessionName = String(names[index]).trim();
      if (!(file instanceof File) || !/\.csv$/i.test(file.name) || !file.size || file.size > noShowMaxFileSize) {
        throw new ImportInputError("File " + (index + 1) + " must be a non-empty CSV under 500 KB.");
      }
      if (!validNoShowDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !sessionName || sessionName.length > 160) {
        throw new ImportInputError(file.name + " needs a session name, a date on or after November 26, 2026, and a start time.");
      }
      try {
        return readNoShowRoster(await file.text()).map((player) => ({
          ...player, facility_id: noShowFacilityId, session_date: date, session_time: time,
          session_name: sessionName, source_file: file.name.slice(0, 255), imported_by: user.id,
        }));
      } catch (error) {
        throw new ImportInputError(file.name + " — " + (error instanceof Error ? error.message : "Unreadable CSV."));
      }
    }));

    const rows = imports.flat();
    if (rows.length > 1000) throw new ImportInputError("Import up to 1,000 no-shows at a time.");
    if (!rows.length) return NextResponse.json({ added: 0, duplicates: 0 });
    const { data, error } = await supabaseAdmin.from("open_play_no_shows")
      .upsert(rows, { onConflict: "facility_id,session_date,session_time,player_key", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;

    return NextResponse.json({ added: data.length, duplicates: rows.length - data.length });
  } catch (error) {
    if (error instanceof ImportInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Open-play no-show import failed");
    return NextResponse.json({ error: "Unable to import the rosters. Try again." }, { status: 500 });
  }
}
