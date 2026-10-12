
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffUser } from "@/lib/server/require-auth";

export async function GET() {
  try {
    await requireStaffUser();

    const { data, error } = await supabaseAdmin
      .from("players")
      .select("id, name, dupr, dupr_id")
      .order("dupr", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        players: data ?? [],
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        {
          error: "Please sign in to view players.",
        },
        {
          status: 401,
        },
      );
    }

    console.error("Unable to load players:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load players.",
      },
      {
        status: 500,
      },
    );
  }
}
