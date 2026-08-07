type DeleteSessionResponse = {
  deleted?: boolean;
  eventId?: string;
  eventName?: string;
  error?: string;
};

export async function deleteLeagueSession(
  eventId: string,
): Promise<DeleteSessionResponse> {
  const response = await fetch(
    `/api/events/${eventId}/cancel`,
    {
      method: "DELETE",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const responseText = await response.text();
  let result: DeleteSessionResponse;

  try {
    result = JSON.parse(
      responseText,
    ) as DeleteSessionResponse;
  } catch {
    throw new Error(
      `The cancel-session API did not return valid JSON. HTTP ${response.status}.`,
    );
  }

  if (!response.ok || !result.deleted) {
    throw new Error(
      result.error ??
        "Unable to delete the league session.",
    );
  }

  return result;
}
