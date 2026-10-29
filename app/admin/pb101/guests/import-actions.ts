
"use server";

import { revalidatePath } from "next/cache";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ImportGuest = {
  name: string;
  email: string;
  phone: string;
  invitationType: string;
  status: string;
};

type ImportRequest = {
  fileName: string;
  classDate: string;
  coach: string;
  guests: ImportGuest[];
};

type ImportResult = {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  message: string;
};

export async function importPB101Guests(
  request: ImportRequest
): Promise<ImportResult> {
  const user = await requireStaffUser();

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  const classDate = request.classDate;
  const coach = request.coach?.trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(classDate) ||
    Number.isNaN(Date.parse(`${classDate}T00:00:00Z`))
  ) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [],
      message: "A valid PB101 class date is required.",
    };
  }

  if (!coach) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [],
      message: "Please select a coach before importing.",
    };
  }

  if (
    !Array.isArray(request.guests) ||
    request.guests.length === 0 ||
    request.guests.length > 500
  ) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [],
      message: "No valid guest records were provided.",
    };
  }

  const seenEmails = new Set<string>();

  for (const guest of request.guests) {
    const invitationType =
      guest.invitationType?.trim().toUpperCase();

    const status =
      guest.status?.trim().toUpperCase();

    if (
      invitationType !== "EVENT_SIGNUP" ||
      status !== "CHECKED_IN"
    ) {
      skipped++;
      continue;
    }

    const name = guest.name?.trim() ?? "";
    const email = guest.email?.trim().toLowerCase() ?? "";
    const phone = guest.phone?.trim() ?? "";

    if (
      !name.includes(" ") ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      skipped++;
      errors.push(`Invalid guest information: ${name || "Unknown"}`);
      continue;
    }

    if (seenEmails.has(email)) {
      skipped++;
      continue;
    }

    seenEmails.add(email);

    const { data: existing, error: lookupError } =
      await supabaseAdmin
        .from("pb101_guests")
        .select("id")
        .ilike("email", email)
        .limit(1);

    if (lookupError) {
      skipped++;
      errors.push(`Could not check existing guest: ${name}`);
      continue;
    }

    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }

    const nameParts = name.split(/\s+/);
    const firstName = nameParts.shift() ?? "";
    const lastName = nameParts.join(" ");

    const { error: insertError } = await supabaseAdmin
      .from("pb101_guests")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        coach_name: coach,
        pb101_completed_at: classDate,
        trial_start_date: classDate,
        status: "active",
      });

    if (insertError) {
      skipped++;
      errors.push(`Unable to import: ${name}`);
    } else {
      imported++;
    }
  }

  const { error: logError } = await supabaseAdmin
    .from("pb101_imports")
    .insert({
      file_name: request.fileName || "podplay-import.csv",
      total_rows: request.guests.length,
      imported_rows: imported,
      skipped_rows: skipped,
      error_rows: errors.length,
      imported_by: user.id,
      notes: `PB101 class date: ${classDate}; Coach: ${coach}`,
    });

  if (logError) {
    errors.push("Import completed, but the import log could not be saved.");
  }

  revalidatePath("/admin/pb101/guests");
  revalidatePath("/admin/pb101");

  return {
    success: errors.length === 0,
    imported,
    skipped,
    errors,
    message: `${imported} guest(s) imported. ${skipped} skipped.`,
  };
}
