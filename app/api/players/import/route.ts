import { NextResponse } from "next/server";

import { readImportRequest } from "@/lib/server/player-import-request";
import { requireStaffUser } from "@/lib/server/require-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  let staff;
  try {
    staff = await requireStaffUser();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Sign in as staff to import players." }, { status: 401 });
    }
    if (reason === "STAFF_ACCESS_DENIED") {
      return NextResponse.json({ error: "Only staff can import players." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to verify staff access." }, { status: 500 });
  }

  let input;
  try {
    input = readImportRequest(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid roster request." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc("prepare_player_import", {
    p_rows: input.rows,
    p_actor: staff.id,
    p_request_id: input.mode === "commit" ? input.requestId : null,
  });

  if (error) {
    if (error.code === "P0001") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "An identifier is already assigned. Review the roster again." },
        { status: 409 },
      );
    }
    console.error("Player import failed", { code: error.code });
    return NextResponse.json({ error: "Unable to prepare the roster." }, { status: 500 });
  }

  return NextResponse.json({ rows: data }, { headers: { "Cache-Control": "no-store" } });
}
