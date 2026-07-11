import { fetchAllTeams } from "@/lib/airtable/teams";
import { DashboardClient } from "@/components/DashboardClient";

// Team list comes from Airtable and can change between deploys; never
// bake it into a static build output.
export const dynamic = "force-dynamic";

export default async function Home() {
  let teams: { id: string; name: string }[] = [];
  let connectionError: string | null = null;

  try {
    teams = await fetchAllTeams();
  } catch (error) {
    connectionError =
      error instanceof Error ? error.message : "Failed to connect to Airtable.";
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="bg-(--color-pitch) px-6 py-5 sm:px-10">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-(--color-gold)">
          USL Front Office
        </p>
        <h1 className="font-(family-name:--font-display) text-2xl text-(--color-paper) sm:text-3xl">
          Dues Dashboard
        </h1>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8 sm:px-10">
        {connectionError ? (
          <div className="rounded-lg border border-(--color-flag) bg-(--color-flag-soft) px-5 py-4 text-sm text-(--color-flag)">
            <p className="font-medium">Not connected to Airtable</p>
            <p className="mt-1 text-(--color-ink-muted)">
              {connectionError} Copy <code>.env.local.example</code> to{" "}
              <code>.env.local</code> and fill in your Airtable Personal Access Token and
              Base ID, then restart the dev server.
            </p>
          </div>
        ) : (
          <DashboardClient teams={teams} />
        )}
      </main>
    </div>
  );
}
