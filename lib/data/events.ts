export type LeagueEventRecord = {
  id: string;
  season_id: string;
  event_date: string;
  name: string;
  status: "setup" | "active" | "complete";
  current_round: number;
  session_number: number;
  session_note: string | null;
  created_at?: string;
};

type CreateLeagueEventInput = {
  seasonId: string;
  eventDate?: string;
  sessionNumber?: number;
  sessionNote?: string;
  name?: string;
};

type LeagueEventResponse = {
  event?: LeagueEventRecord | null;
  events?: LeagueEventRecord[];
  existing?: boolean;
  error?: string;
};

async function readLeagueEventResponse(
  response: Response,
): Promise<LeagueEventResponse> {
  const responseText = await response.text();

  try {
    return JSON.parse(
      responseText,
    ) as LeagueEventResponse;
  } catch {
    throw new Error(
      `The league-events API did not return valid JSON. HTTP ${response.status}.`,
    );
  }
}

export async function getActiveLeagueEvent(
  seasonId?: string,
): Promise<LeagueEventRecord | null> {
  const searchParams = new URLSearchParams();

  if (seasonId) {
    searchParams.set("seasonId", seasonId);
  }

  const query = searchParams.toString();

  const response = await fetch(
    `/api/league-events/active${
      query ? `?${query}` : ""
    }`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const result =
    await readLeagueEventResponse(response);

  if (!response.ok) {
    throw new Error(
      result.error ??
        "Unable to load the active league event.",
    );
  }

  return result.event ?? null;
}

export async function getLeagueEventsForDate({
  seasonId,
  eventDate,
}: {
  seasonId: string;
  eventDate?: string;
}): Promise<LeagueEventRecord[]> {
  const searchParams = new URLSearchParams({
    seasonId,
  });

  if (eventDate) {
    searchParams.set("eventDate", eventDate);
  }

  const response = await fetch(
    `/api/league-events?${searchParams.toString()}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const result =
    await readLeagueEventResponse(response);

  if (!response.ok) {
    throw new Error(
      result.error ??
        "Unable to load league events.",
    );
  }

  return result.events ?? [];
}

export async function getLeagueEventForDate({
  seasonId,
  eventDate,
  sessionNumber = 1,
}: {
  seasonId: string;
  eventDate?: string;
  sessionNumber?: number;
}): Promise<LeagueEventRecord | null> {
  const searchParams = new URLSearchParams({
    seasonId,
    sessionNumber: String(sessionNumber),
  });

  if (eventDate) {
    searchParams.set("eventDate", eventDate);
  }

  const response = await fetch(
    `/api/league-events?${searchParams.toString()}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const result =
    await readLeagueEventResponse(response);

  if (!response.ok) {
    throw new Error(
      result.error ??
        "Unable to find the league event.",
    );
  }

  return result.event ?? null;
}

export async function createLeagueEvent({
  seasonId,
  eventDate,
  sessionNumber = 1,
  sessionNote,
  name,
}: CreateLeagueEventInput): Promise<LeagueEventRecord> {
  const response = await fetch("/api/league-events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      seasonId,
      eventDate,
      sessionNumber,
      sessionNote,
      name,
    }),
  });

  const result =
    await readLeagueEventResponse(response);

  if (!response.ok || !result.event) {
    throw new Error(
      result.error ??
        "Unable to create the league event.",
    );
  }

  return result.event;
}