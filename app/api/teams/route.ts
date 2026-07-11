import { NextResponse } from "next/server";
import { AirtableFetchError } from "@/lib/airtable/errors";
import { fetchAllTeams } from "@/lib/airtable/teams";

export async function GET() {
  try {
    const teams = await fetchAllTeams();
    return NextResponse.json(teams.map((t) => ({ id: t.id, name: t.name })));
  } catch (error) {
    if (error instanceof AirtableFetchError) {
      console.error(error.message, error.cause);
      return NextResponse.json({ error: "Failed to load teams from Airtable." }, { status: 502 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to load teams." }, { status: 502 });
  }
}
