import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("players")
      .select("id, name, dupr")
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