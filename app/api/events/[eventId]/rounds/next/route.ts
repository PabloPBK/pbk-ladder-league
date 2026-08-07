import { generateNextRoundResponse } from "@/lib/server/ladder-rounds";

type RouteContext = {
  params: Promise<{
    eventId: string;
  }>;
};

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  const { eventId } = await context.params;

  return generateNextRoundResponse(eventId);
}
