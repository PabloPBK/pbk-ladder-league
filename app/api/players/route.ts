
import { NextResponse } from "next/server";

import type { DatabasePlayerRecord } from "@/lib/data/players";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffUser } from "@/lib/server/require-auth";

export async function GET() {
  try {
    await requireStaffUser();

    const pageSize = 500;
    const players: DatabasePlayerRecord[] = [];
    let cursor: string | undefined;
    for (;;) {
      const query = supabaseAdmin.from("players")
        .select("id, name, dupr, dupr_id")
        .order("id")
        .limit(pageSize);
      const { data, error } = await (cursor ? query.gt("id", cursor) : query);
      if (error) throw error;
      if (!data.length) break;
      players.push(...data);
      if (data.length < pageSize) break;
      cursor = data[data.length - 1].id;
    }

    players.sort((a, b) => Number(b.dupr) - Number(a.dupr) || a.name.localeCompare(b.name));

    return NextResponse.json(
      {
        players,
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

    if (error instanceof Error && error.message === "STAFF_ACCESS_DENIED") {
      return NextResponse.json({ error: "Only staff can view the player directory." }, { status: 403 });
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
