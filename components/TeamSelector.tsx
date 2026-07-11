export interface TeamOption {
  id: string;
  name: string;
}

export function TeamSelector({
  teams,
  value,
  onChange,
}: {
  teams: TeamOption[];
  value: string;
  onChange: (teamId: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-(--color-ink-muted)">
        Team
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-md border border-(--color-line) bg-(--color-paper-raised) px-3 text-sm text-(--color-ink) outline-none transition-colors focus-visible:border-(--color-gold) focus-visible:ring-2 focus-visible:ring-(--color-gold-soft)"
      >
        <option value="" disabled>
          Select a team
        </option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </select>
    </label>
  );
}
