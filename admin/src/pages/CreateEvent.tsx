import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase";

interface FormState {
  externalMatchId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  isDemo: boolean;
  oracleAddress: string;
  contractAddress: string;
}

const EMPTY: FormState = {
  externalMatchId: "",
  homeTeam: "",
  awayTeam: "",
  kickoffAt: "",
  isDemo: false,
  oracleAddress: "",
  contractAddress: "",
};

export default function CreateEvent() {
  const nav = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { error: err, data } = await supabase
      .from("matches")
      .insert({
        external_match_id: form.externalMatchId,
        home_team: form.homeTeam,
        away_team: form.awayTeam,
        kickoff_at: new Date(form.kickoffAt).toISOString(),
        status: "pre-match",
        is_demo: form.isDemo,
        oracle_address: form.oracleAddress || null,
        contract_address: form.contractAddress || null,
        current_minute: 0,
        score_home: 0,
        score_away: 0,
        half: 1,
      })
      .select()
      .single();

    setSaving(false);

    if (err) {
      setError(err.message);
      return;
    }

    nav(`/events/${data.external_match_id}`);
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Create Event</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="External Match ID" required>
          <input
            className={INPUT}
            placeholder="match_city_newcastle_20260221"
            value={form.externalMatchId}
            onChange={(e) => set("externalMatchId", e.target.value)}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Home Team" required>
            <input
              className={INPUT}
              placeholder="Man City"
              value={form.homeTeam}
              onChange={(e) => set("homeTeam", e.target.value)}
              required
            />
          </Field>
          <Field label="Away Team" required>
            <input
              className={INPUT}
              placeholder="Newcastle"
              value={form.awayTeam}
              onChange={(e) => set("awayTeam", e.target.value)}
              required
            />
          </Field>
        </div>

        <Field label="Kickoff (local time)" required>
          <input
            className={INPUT}
            type="datetime-local"
            value={form.kickoffAt}
            onChange={(e) => set("kickoffAt", e.target.value)}
            required
          />
        </Field>

        <Field label="Oracle Address" hint="Leave blank to assign later">
          <input
            className={INPUT}
            placeholder="0x..."
            value={form.oracleAddress}
            onChange={(e) => set("oracleAddress", e.target.value)}
          />
        </Field>

        <Field label="Contract Address" hint="Leave blank until deployed">
          <input
            className={INPUT}
            placeholder="0x..."
            value={form.contractAddress}
            onChange={(e) => set("contractAddress", e.target.value)}
          />
        </Field>

        <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isDemo}
            onChange={(e) => set("isDemo", e.target.checked)}
            className="w-4 h-4 rounded accent-green-500"
          />
          Mark as demo event (uses local replay data)
        </label>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 px-3 py-2 rounded-md">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-green-500 text-black font-semibold rounded-md hover:bg-green-400 disabled:opacity-50 transition-colors"
          >
            {saving ? "Creating…" : "Create Event"}
          </button>
          <button
            type="button"
            onClick={() => nav("/dashboard")}
            className="px-5 py-2 bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
        {required && <span className="text-green-400 ml-1">*</span>}
        {hint && <span className="ml-2 text-xs text-gray-500">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT =
  "w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors";
