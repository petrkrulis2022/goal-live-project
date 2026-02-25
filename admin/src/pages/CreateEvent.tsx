import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@shared/lib/supabase";
import { contractService } from "../services/contractService";

interface FormState {
  externalMatchId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  isDemo: boolean;
  oracleAddress: string;
  poolAmountUsdc: string;
}

const EMPTY: FormState = {
  externalMatchId: "",
  homeTeam: "",
  awayTeam: "",
  kickoffAt: "",
  isDemo: false,
  oracleAddress: "",
  poolAmountUsdc: "",
};

type Step =
  | { id: "idle" }
  | { id: "db"; label: "Saving event to database…" }
  | { id: "deploy"; label: "Deploying pool contract… (confirm in MetaMask)" }
  | { id: "fund"; label: "Funding pool… (confirm in MetaMask)" }
  | { id: "done"; contractAddress: string; txHash: string };

export default function CreateEvent() {
  const nav = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [step, setStep] = useState<Step>({ id: "idle" });
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const busy = step.id !== "idle" && step.id !== "done";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const poolAmount = parseFloat(form.poolAmountUsdc);
    if (!form.poolAmountUsdc || isNaN(poolAmount) || poolAmount <= 0) {
      setError("Enter a valid pool funding amount (USDC).");
      return;
    }

    try {
      // ── Step 1: Save event to Supabase ─────────────────────────────────────
      setStep({ id: "db", label: "Saving event to database…" });
      const { error: dbErr, data: match } = await supabase
        .from("matches")
        .insert({
          external_match_id: form.externalMatchId,
          home_team: form.homeTeam,
          away_team: form.awayTeam,
          kickoff_at: new Date(form.kickoffAt).toISOString(),
          status: "pre-match",
          is_demo: form.isDemo,
          oracle_address: form.oracleAddress || null,
          contract_address: null,
          current_minute: 0,
          score_home: 0,
          score_away: 0,
          half: 1,
        })
        .select()
        .single();

      if (dbErr) throw new Error(dbErr.message);

      // ── Step 2: Deploy escrow contract (MetaMask) ──────────────────────────
      setStep({
        id: "deploy",
        label: "Deploying pool contract… (confirm in MetaMask)",
      });
      const contractAddress = await contractService.deployContract(
        form.externalMatchId,
      );

      // Save contract address back
      await supabase
        .from("matches")
        .update({ contract_address: contractAddress })
        .eq("id", match.id);

      // ── Step 3: Fund the pool (MetaMask) ───────────────────────────────────
      setStep({ id: "fund", label: "Funding pool… (confirm in MetaMask)" });
      const txHash = await contractService.fundPool(
        contractAddress,
        poolAmount,
      );

      // ── Done ───────────────────────────────────────────────────────────────
      setStep({ id: "done", contractAddress, txHash });

      // Navigate after a short pause so the user can see the success state
      setTimeout(() => nav(`/events/${match.external_match_id}`), 2000);
    } catch (e: unknown) {
      setStep({ id: "idle" });
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Create Event</h1>
        <p className="text-gray-500 text-sm mt-1">
          Creates the match, deploys the pool contract and funds it — all in one
          flow.
        </p>
      </div>

      {/* Progress indicator (shown while processing) */}
      {busy && (
        <StepProgress
          step={step as Exclude<Step, { id: "idle" } | { id: "done" }>}
        />
      )}
      {step.id === "done" && (
        <SuccessBanner
          contractAddress={step.contractAddress}
          txHash={step.txHash}
        />
      )}

      <div className="bg-gray-900 border border-white/5 rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Match details ─────────────────────────────────────────────── */}
          <Field label="External Match ID" required>
            <input
              className={INPUT}
              placeholder="match_city_newcastle_20260221"
              value={form.externalMatchId}
              onChange={(e) => set("externalMatchId", e.target.value)}
              disabled={busy}
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
                disabled={busy}
                required
              />
            </Field>
            <Field label="Away Team" required>
              <input
                className={INPUT}
                placeholder="Newcastle"
                value={form.awayTeam}
                onChange={(e) => set("awayTeam", e.target.value)}
                disabled={busy}
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
              disabled={busy}
              required
            />
          </Field>

          {/* ── Pool funding ──────────────────────────────────────────────── */}
          <div className="border-t border-white/5 pt-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center text-xs text-green-400 font-bold">
                $
              </div>
              <p className="text-sm font-semibold text-white">Pool Funding</p>
              <span className="ml-auto text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full font-medium uppercase tracking-wide">
                MetaMask
              </span>
            </div>

            <Field label="Initial Pool Amount (USDC)" required>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                  $
                </span>
                <input
                  className={INPUT + " pl-7"}
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="5000.00"
                  value={form.poolAmountUsdc}
                  onChange={(e) => set("poolAmountUsdc", e.target.value)}
                  disabled={busy}
                  required
                />
              </div>
            </Field>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              This amount is deducted from the goal.live admin wallet and
              transferred into the deployed escrow contract. MetaMask will open{" "}
              <strong className="text-gray-500">twice</strong> — once to deploy
              the contract, once to fund it.
            </p>
          </div>

          {/* ── Optional ─────────────────────────────────────────────────── */}
          <div className="border-t border-white/5 pt-5 space-y-4">
            <p className="text-xs text-gray-600 uppercase tracking-wider font-medium">
              Optional
            </p>
            <Field label="Oracle Address" hint="Leave blank to assign later">
              <input
                className={INPUT}
                placeholder="0x…"
                value={form.oracleAddress}
                onChange={(e) => set("oracleAddress", e.target.value)}
                disabled={busy}
              />
            </Field>

            <label className="flex items-center gap-3 text-sm text-gray-400 cursor-pointer select-none">
              <div
                className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${form.isDemo ? "bg-green-500" : "bg-gray-700"}`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${form.isDemo ? "left-4" : "left-0.5"}`}
                />
              </div>
              <input
                type="checkbox"
                checked={form.isDemo}
                onChange={(e) => set("isDemo", e.target.checked)}
                disabled={busy}
                className="sr-only"
              />
              <span>
                Demo event{" "}
                <span className="text-gray-600">(uses local replay data)</span>
              </span>
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-lg">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={busy || step.id === "done"}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm shadow-lg shadow-green-500/20"
            >
              {busy ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Processing…
                </>
              ) : (
                "Create Event + Deploy Pool"
              )}
            </button>
            <button
              type="button"
              onClick={() => nav("/dashboard")}
              disabled={busy}
              className="px-5 py-3 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-colors text-sm border border-white/5"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Step progress banner ────────────────────────────────────────────────────

const STEP_ORDER = ["db", "deploy", "fund"] as const;
type ActiveStep = (typeof STEP_ORDER)[number];

const STEP_LABELS: Record<ActiveStep, string> = {
  db: "Save to database",
  deploy: "Deploy contract",
  fund: "Fund pool",
};

function StepProgress({ step }: { step: { id: ActiveStep; label: string } }) {
  const current = STEP_ORDER.indexOf(step.id);
  return (
    <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-4 h-4 border-2 border-green-400/40 border-t-green-400 rounded-full animate-spin shrink-0" />
        <span className="text-sm text-white font-medium">{step.label}</span>
      </div>
      <div className="flex items-center gap-1">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                i < current
                  ? "text-green-400"
                  : i === current
                    ? "text-white"
                    : "text-gray-600"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                  i < current
                    ? "bg-green-500 border-green-500 text-black"
                    : i === current
                      ? "border-green-400 text-green-400"
                      : "border-gray-700 text-gray-600"
                }`}
              >
                {i < current ? "✓" : i + 1}
              </div>
              {STEP_LABELS[s]}
            </div>
            {i < STEP_ORDER.length - 1 && (
              <div
                className={`flex-1 h-px mx-2 ${i < current ? "bg-green-500/40" : "bg-gray-800"}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Success banner ──────────────────────────────────────────────────────────

function SuccessBanner({
  contractAddress,
  txHash,
}: {
  contractAddress: string;
  txHash: string;
}) {
  return (
    <div className="bg-green-500/8 border border-green-500/20 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-green-400 text-lg">✓</span>
        <span className="text-green-400 font-semibold text-sm">
          Event created and pool funded!
        </span>
        <span className="ml-auto text-xs text-gray-500 animate-pulse">
          redirecting…
        </span>
      </div>
      <div className="space-y-1.5 text-xs font-mono">
        <div>
          <span className="text-gray-600">Contract </span>
          <span className="text-green-400">{contractAddress}</span>
        </div>
        <div>
          <span className="text-gray-600">Fund tx </span>
          <span className="text-gray-400">
            {txHash.slice(0, 18)}…{txHash.slice(-6)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
        {label}
        {required && (
          <span className="text-green-400 text-sm leading-none">*</span>
        )}
        {hint && (
          <span className="ml-1 text-gray-600 normal-case font-normal tracking-normal capitalize">
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

const INPUT =
  "w-full bg-gray-950 border border-white/8 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/30 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
