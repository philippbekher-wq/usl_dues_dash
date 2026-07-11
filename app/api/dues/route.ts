import { NextResponse } from "next/server";
import { AirtableFetchError } from "@/lib/airtable/errors";
import { fetchContractsWithTermsForTeam } from "@/lib/airtable/contracts";
import { fetchTeamById } from "@/lib/airtable/teams";
import { buildTeamDuesReport } from "@/lib/dues/calculate";
import { duesRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = duesRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { startDate, endDate, teamId } = parsed.data;

  try {
    const team = await fetchTeamById(teamId);
    if (!team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    const { contracts, players } = await fetchContractsWithTermsForTeam(teamId);
    const report = buildTeamDuesReport({ team, contracts, players, startDate, endDate });

    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof AirtableFetchError) {
      console.error(error.message, error.cause);
      return NextResponse.json({ error: "Failed to load data from Airtable." }, { status: 502 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to calculate dues." }, { status: 502 });
  }
}
