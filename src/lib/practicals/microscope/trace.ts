/**
 * The ordered log of what the student did.
 *
 * This is the assessable artefact, not the final state. Two students can finish with
 * identical slides having done completely different things — one lowered the coverslip
 * properly, the other dropped it and started again — and the exam asks about the
 * method, so the method is what gets marked.
 */
import { describeAction, PHASE_OF, type MicroscopeAction, type Phase } from "./actions";
import { activeFaultIds, type FaultId } from "./faults";
import { initialBench, type BenchState } from "./state";
import { reduce } from "./reduce";

export type TraceEntry = {
  /** Position in the run, from 1. */
  n: number;
  action: MicroscopeAction;
  /** Plain description, for the trace view and the live region. */
  description: string;
  phase: Phase | "recovery";
  /** Faults active *after* this action — so the student can see when it went wrong. */
  faults: FaultId[];
  /** False when the bench refused the action as impossible. */
  applied: boolean;
};

export type Run = {
  state: BenchState;
  trace: TraceEntry[];
};

export const emptyRun = (): Run => ({ state: initialBench(), trace: [] });

/**
 * Applies an action and appends it to the trace.
 *
 * Impossible actions are recorded with `applied: false` rather than dropped. A student
 * repeatedly trying to blot a slide that has no coverslip is telling us something, and
 * silently swallowing it would make the trace a record of what the app allowed rather
 * than of what the student tried.
 */
export function step(run: Run, action: MicroscopeAction): Run {
  const next = reduce(run.state, action);
  const applied = next !== run.state;

  return {
    state: next,
    trace: [
      ...run.trace,
      {
        n: run.trace.length + 1,
        action,
        description: describeAction(action),
        phase: PHASE_OF[action.t],
        faults: activeFaultIds(next),
        applied,
      },
    ],
  };
}

export function runAll(actions: readonly MicroscopeAction[], from: Run = emptyRun()): Run {
  return actions.reduce<Run>((run, action) => step(run, action), from);
}

/** Every action of a given type the student actually performed. */
export function actionsOfType<T extends MicroscopeAction["t"]>(
  trace: readonly TraceEntry[],
  type: T,
): Extract<MicroscopeAction, { t: T }>[] {
  return trace
    .filter((entry) => entry.applied && entry.action.t === type)
    .map((entry) => entry.action as Extract<MicroscopeAction, { t: T }>);
}

export const didPerform = (
  trace: readonly TraceEntry[],
  type: MicroscopeAction["t"],
): boolean => trace.some((entry) => entry.applied && entry.action.t === type);

/** Position of the first applied action of a type, or -1. */
export function firstIndexOf(
  trace: readonly TraceEntry[],
  type: MicroscopeAction["t"],
): number {
  return trace.findIndex((entry) => entry.applied && entry.action.t === type);
}

/**
 * Whether `before` genuinely happened before `after`.
 *
 * Both must have happened: a step that was never performed did not happen "first".
 * This is what makes "goggles before iodine" checkable as an ordering rather than as
 * two independent facts.
 */
export function happenedBefore(
  trace: readonly TraceEntry[],
  before: MicroscopeAction["t"],
  after: MicroscopeAction["t"],
): boolean {
  const first = firstIndexOf(trace, before);
  const second = firstIndexOf(trace, after);
  return first !== -1 && second !== -1 && first < second;
}

/** Every fault that fired at any point, even if the slide was later restarted. */
export function faultsEverSeen(run: Run): FaultId[] {
  const seen = new Set<FaultId>(run.state.historicFaults as FaultId[]);
  for (const entry of run.trace) for (const fault of entry.faults) seen.add(fault);
  return [...seen];
}
