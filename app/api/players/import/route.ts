import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type ImportPlayerInput = {
  name?: string;
  dupr?: number;
};

type ImportPlayersRequest = {
  players?: ImportPlayerInput[];
  updateExisting?: boolean;
};

type ExistingPlayer = {
  id: string;
  name: string;
  dupr: number | string;
};

function normalizeName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as ImportPlayersRequest;

    const submittedPlayers = body.players ?? [];
    const updateExisting =
      body.updateExisting ?? true;

    if (!Array.isArray(submittedPlayers)) {
      return NextResponse.json(
        { error: "A players list is required." },
        { status: 400 },
      );
    }

    if (submittedPlayers.length === 0) {
      return NextResponse.json(
        { error: "Select at least one player to import." },
        { status: 400 },
      );
    }

    if (submittedPlayers.length > 500) {
      return NextResponse.json(
        {
          error:
            "A maximum of 500 players can be imported at one time.",
        },
        { status: 400 },
      );
    }

    const uniquePlayers = new Map<
      string,
      { name: string; dupr: number }
    >();

    for (const player of submittedPlayers) {
      const name = player.name
        ?.trim()
        .replace(/\s+/g, " ");
      const dupr = Number(player.dupr);

      if (!name) {
        return NextResponse.json(
          { error: "Every imported player needs a name." },
          { status: 400 },
        );
      }

      if (
        !Number.isFinite(dupr) ||
        dupr <= 0 ||
        dupr > 8
      ) {
        return NextResponse.json(
          {
            error: `${name} needs a valid DUPR between 0 and 8.`,
          },
          { status: 400 },
        );
      }

      uniquePlayers.set(normalizeName(name), {
        name,
        dupr,
      });
    }

    const { data: existingData, error: existingError } =
      await supabaseAdmin
        .from("players")
        .select("id, name, dupr");

    if (existingError) {
      throw existingError;
    }

    const existingPlayers =
      (existingData ?? []) as ExistingPlayer[];

    const existingByName = new Map(
      existingPlayers.map((player) => [
        normalizeName(player.name),
        player,
      ]),
    );

    const playersToCreate: {
      name: string;
      dupr: number;
    }[] = [];

    const playersToUpdate: {
      id: string;
      name: string;
      dupr: number;
    }[] = [];

    let skipped = 0;

    uniquePlayers.forEach((player, key) => {
      const existing = existingByName.get(key);

      if (!existing) {
        playersToCreate.push(player);
        return;
      }

      if (!updateExisting) {
        skipped += 1;
        return;
      }

      playersToUpdate.push({
        id: existing.id,
        name: player.name,
        dupr: player.dupr,
      });
    });

    let created: ExistingPlayer[] = [];

    if (playersToCreate.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("players")
        .insert(playersToCreate)
        .select("id, name, dupr");

      if (error) {
        throw error;
      }

      created = (data ?? []) as ExistingPlayer[];
    }

    const updated = await Promise.all(
      playersToUpdate.map(async (player) => {
        const { data, error } = await supabaseAdmin
          .from("players")
          .update({
            name: player.name,
            dupr: player.dupr,
          })
          .eq("id", player.id)
          .select("id, name, dupr")
          .single();

        if (error) {
          throw error;
        }

        return data as ExistingPlayer;
      }),
    );

    return NextResponse.json(
      {
        created: created.length,
        updated: updated.length,
        skipped,
        players: [...created, ...updated].map(
          (player) => ({
            ...player,
            dupr: Number(player.dupr),
          }),
        ),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Unable to import players:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to import players.",
      },
      { status: 500 },
    );
  }
}
