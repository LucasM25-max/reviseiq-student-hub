"use client";

import { useMemo, useState } from "react";

import { activeFaultIds } from "@/lib/practicals/microscope/faults";
import { magnificationWorking, umPerDivision } from "@/lib/practicals/microscope/graticule";
import { fieldOptics } from "@/lib/practicals/microscope/optics";
import { isPossible, STAGE_MAX, STAGE_MIN } from "@/lib/practicals/microscope/reduce";
import { scoreRun, summarise } from "@/lib/practicals/microscope/rubric";
import { OBJECTIVES, type Point, type Stroke } from "@/lib/practicals/microscope/state";
import { emptyRun, step, type Run } from "@/lib/practicals/microscope/trace";
import type { MicroscopeAction } from "@/lib/practicals/microscope/actions";
import type { MicroscopePracticalConfig } from "@/lib/widgets/schemas";
import { cn } from "@/lib/utils";

import { WidgetAnswerKey, WidgetButton, WidgetShell, WidgetStatus } from "../widget-shell";
import { DrawingCanvas, GuidedLabelling } from "./drawing-canvas";
import { FieldOfView } from "./field-of-view";

/**
 * Required practical 1, end to end.
 *
 * The whole simulation is a reducer plus derived views, so this component holds exactly
 * one piece of state — the run — and everything on screen is computed from it. That is
 * what lets the interesting behaviour be tested without a browser (D46): there is no
 * logic in here to test.
 *
 * Every action is a button. No drag-and-drop anywhere, no gesture that only works with a
 * mouse, and the one genuinely spatial task — the drawing — has a full-credit
 * alternative (D48).
 */

type Phase = "prepare" | "find" | "draw" | "measure";

const PHASE_LABELS: Record<Phase, string> = {
  prepare: "1 · Prepare the slide",
  find: "2 · Find the cells",
  draw: "3 · Draw what you see",
  measure: "4 · Measure and calculate",
};

/** Where each label points on the guided outline. */
const GUIDED_STRUCTURES = [
  { id: "cell-wall", label: "Cell wall", target: { x: 320, y: 92 } },
  { id: "nucleus", label: "Nucleus", target: { x: 400, y: 235 } },
  { id: "cytoplasm", label: "Cytoplasm", target: { x: 150, y: 330 } },
  { id: "vacuole", label: "Vacuole", target: { x: 480, y: 330 } },
];

export function MicroscopePracticalWidget({ config }: { config: MicroscopePracticalConfig }) {
  const [run, setRun] = useState<Run>(emptyRun);
  const [phase, setPhase] = useState<Phase>(config.phases[0] as Phase);
  const [checked, setChecked] = useState(false);
  const [divisions, setDivisions] = useState("");
  const [drawnLength, setDrawnLength] = useState("");
  const [magnification, setMagnification] = useState("");

  const state = run.state;
  const optics = fieldOptics(state);
  const faults = activeFaultIds(state);
  const result = useMemo(() => scoreRun(run), [run]);

  const act = (action: MicroscopeAction) => setRun((current) => step(current, action));
  const can = (action: MicroscopeAction) => isPossible(state, action);

  const working =
    state.measurement.divisionsRead !== null && state.drawing.drawnLengthMm !== null
      ? magnificationWorking(
          state.measurement.divisionsRead,
          state.scope.objective,
          state.drawing.drawnLengthMm,
          state.measurement.calibratedUmPerDivision,
        )
      : null;

  const phases = config.phases as Phase[];

  return (
    <WidgetShell
      title="Required practical: looking at onion cells"
      instruction={
        config.instruction ??
        "Work through the practical as you would at the bench. Mistakes are allowed to happen — you will see the result down the eyepiece."
      }
      status={
        checked ? (
          <WidgetStatus tone={result.awarded === result.total ? "success" : "warning"}>
            {summarise(result)}
          </WidgetStatus>
        ) : null
      }
      answers={
        checked ? null : (
          <WidgetAnswerKey>
            <p>
              The method, in order: goggles on · water on the slide · peel the epidermis from
              the <strong>inner</strong> surface · place it flat in the water · two drops of
              iodine · lower the coverslip from one edge with a needle · blot the excess · start
              at the lowest power and focus <strong>upwards</strong> · only then switch to a
              higher power and use the fine focus.
            </p>
          </WidgetAnswerKey>
        )
      }
    >
      {/* Phase tabs. Buttons, not links: this is one interactive block. */}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Stages of the practical">
        {phases.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={phase === name}
            onClick={() => setPhase(name)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none",
              phase === name
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60",
            )}
          >
            {PHASE_LABELS[name]}
          </button>
        ))}
      </div>

      {state.ended === "cracked-slide" ? (
        <div className="mt-4 rounded-md border border-[var(--warning-border)] bg-[var(--warning-surface)] px-3 py-3 text-sm">
          <p className="font-medium">
            You have driven the objective into the slide and cracked it.
          </p>
          <p className="mt-1">
            This is why you rack the lens down while watching from the side, then focus{" "}
            <strong>upwards</strong> with your eye at the eyepiece — focusing up can never push
            the lens into the glass.
          </p>
          <div className="mt-2">
            <WidgetButton onClick={() => act({ t: "freshSlide" })}>
              Take a fresh slide
            </WidgetButton>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <FieldOfView state={state} />
        </div>

        <div>
          {phase === "prepare" ? (
            <PrepareControls state={state} act={act} can={can} />
          ) : phase === "find" ? (
            <FindControls state={state} act={act} optics={optics} />
          ) : phase === "draw" ? (
            <div>
              {config.drawing === "guided-labelling" ? (
                <GuidedLabelling
                  structures={GUIDED_STRUCTURES}
                  placed={state.drawing.labels}
                  onPlace={(id, at, target) => act({ t: "placeLabel", id, at, target })}
                  onRemove={(id) => act({ t: "removeLabel", id })}
                  disabled={state.ended !== null}
                />
              ) : (
                <>
                  <DrawingCanvas
                    strokes={state.drawing.strokes}
                    onStroke={(stroke: Stroke) => act({ t: "drawStroke", stroke })}
                    onUndo={() => act({ t: "undoStroke" })}
                    disabled={state.ended !== null}
                  />
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-[var(--muted-foreground)]">
                      Cannot draw with a pointer? Label an outline instead — it is worth the
                      same.
                    </summary>
                    <div className="mt-2">
                      <GuidedLabelling
                        structures={GUIDED_STRUCTURES}
                        placed={state.drawing.labels}
                        onPlace={(id: string, at: Point, target: Point) =>
                          act({ t: "placeLabel", id, at, target })
                        }
                        onRemove={(id: string) => act({ t: "removeLabel", id })}
                        disabled={state.ended !== null}
                      />
                    </div>
                  </details>
                </>
              )}
            </div>
          ) : (
            <MeasureControls
              state={state}
              act={act}
              divisions={divisions}
              setDivisions={setDivisions}
              drawnLength={drawnLength}
              setDrawnLength={setDrawnLength}
              magnification={magnification}
              setMagnification={setMagnification}
              working={working}
            />
          )}
        </div>
      </div>

      {faults.length > 0 ? (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">Currently wrong: </span>
          {faults.join(", ").replaceAll("-", " ")}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <WidgetButton onClick={() => setChecked(true)}>Check my method</WidgetButton>
        <WidgetButton
          variant="ghost"
          onClick={() => {
            setRun(emptyRun());
            setChecked(false);
            setDivisions("");
            setDrawnLength("");
            setMagnification("");
          }}
        >
          Start the whole practical again
        </WidgetButton>
      </div>

      {checked ? <Feedback result={result} run={run} /> : null}
    </WidgetShell>
  );
}

// ---------------------------------------------------------------------------
// Phase 1 — preparing the slide
// ---------------------------------------------------------------------------

function PrepareControls({
  state,
  act,
  can,
}: {
  state: ReturnType<typeof emptyRun>["state"];
  act: (action: MicroscopeAction) => void;
  can: (action: MicroscopeAction) => boolean;
}) {
  const { slide } = state;

  return (
    <div className="space-y-3">
      <Step done={state.goggles} label="Eye protection">
        <WidgetButton onClick={() => act({ t: "wearGoggles" })} disabled={state.goggles}>
          {state.goggles ? "Goggles on" : "Put on goggles"}
        </WidgetButton>
      </Step>

      <Step done={slide.water} label="A drop of water on the slide">
        <WidgetButton
          onClick={() => act({ t: "pipetteWater" })}
          disabled={!can({ t: "pipetteWater" })}
        >
          Add a drop of water
        </WidgetButton>
      </Step>

      <Step done={state.peel !== null || slide.specimen !== null} label="Peel the epidermis">
        <WidgetButton
          onClick={() => act({ t: "peelEpidermis", surface: "inner" })}
          disabled={!can({ t: "peelEpidermis", surface: "inner" })}
        >
          Peel from the inner surface
        </WidgetButton>
        <WidgetButton
          variant="ghost"
          onClick={() => act({ t: "peelEpidermis", surface: "outer" })}
          disabled={!can({ t: "peelEpidermis", surface: "outer" })}
        >
          Peel from the outer surface
        </WidgetButton>
      </Step>

      <Step done={slide.specimen !== null} label="Place it on the slide">
        <WidgetButton
          onClick={() => act({ t: "placeSpecimen" })}
          disabled={!can({ t: "placeSpecimen" })}
        >
          Place the peel
        </WidgetButton>
        <WidgetButton
          variant="ghost"
          onClick={() => act({ t: "flattenSpecimen" })}
          disabled={!can({ t: "flattenSpecimen" })}
        >
          Spread it flat
        </WidgetButton>
      </Step>

      <Step done={slide.stainDrops > 0} label={`Iodine solution — ${slide.stainDrops} drops`}>
        <WidgetButton
          onClick={() => act({ t: "addStain", drops: 1 })}
          disabled={!can({ t: "addStain", drops: 1 })}
        >
          Add one drop
        </WidgetButton>
      </Step>

      <Step done={slide.coverslip !== null} label="Coverslip">
        <WidgetButton
          onClick={() => act({ t: "placeCoverslip", method: "lowerWithNeedle" })}
          disabled={!can({ t: "placeCoverslip", method: "lowerWithNeedle" })}
        >
          Lower it slowly with a needle
        </WidgetButton>
        <WidgetButton
          variant="ghost"
          onClick={() => act({ t: "placeCoverslip", method: "drop" })}
          disabled={!can({ t: "placeCoverslip", method: "drop" })}
        >
          Drop it flat
        </WidgetButton>
      </Step>

      <Step done={slide.blotted} label="Blot the excess">
        <WidgetButton
          onClick={() => act({ t: "blotExcess" })}
          disabled={!can({ t: "blotExcess" })}
        >
          Blot with filter paper
        </WidgetButton>
      </Step>

      <Step done={slide.mounted} label="On the stage">
        <WidgetButton
          onClick={() => act({ t: "mountSlide" })}
          disabled={!can({ t: "mountSlide" })}
        >
          Clip the slide onto the stage
        </WidgetButton>
      </Step>
    </div>
  );
}

function Step({
  done,
  label,
  children,
}: {
  done: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[var(--border)] px-3 py-2">
      <p className="text-sm font-medium">
        <span aria-hidden="true" className={done ? "text-[var(--success)]" : "opacity-40"}>
          {done ? "✓ " : "○ "}
        </span>
        {label}
        {/*
          The tick is decorative, so the state has to be in text too — and in *both*
          states. Announcing only "done" left a screen-reader user unable to tell an
          outstanding step from one with no marker at all.
        */}
        <span className="sr-only">{done ? " — done" : " — not done yet"}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 2 — driving the microscope
// ---------------------------------------------------------------------------

function FindControls({
  state,
  act,
  optics,
}: {
  state: ReturnType<typeof emptyRun>["state"];
  act: (action: MicroscopeAction) => void;
  optics: ReturnType<typeof fieldOptics>;
}) {
  const { scope } = state;
  const usable = state.slide.mounted && state.ended === null;

  return (
    <div className="space-y-3">
      <fieldset className="rounded-md border border-[var(--border)] px-3 py-2">
        <legend className="px-1 text-sm font-medium">Objective lens</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {OBJECTIVES.map((total) => (
            <WidgetButton
              key={total}
              variant={scope.objective === total ? "primary" : "ghost"}
              onClick={() => act({ t: "selectObjective", total })}
              disabled={!usable}
            >
              ×{total}
            </WidgetButton>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          Field of view {Math.round(optics.fieldUm)} µm across — about {optics.cellsAcross}{" "}
          onion cell{optics.cellsAcross === 1 ? "" : "s"} wide.
        </p>
      </fieldset>

      <fieldset className="rounded-md border border-[var(--border)] px-3 py-2">
        <legend className="px-1 text-sm font-medium">Coarse focus</legend>
        <p className="text-xs text-[var(--muted-foreground)]">
          Watch from the side while you rack down, then focus up with your eye at the eyepiece.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <WidgetButton
            variant="ghost"
            onClick={() => act({ t: "coarseFocus", delta: -40, viewing: "side" })}
            disabled={!usable}
          >
            Down, watching from the side
          </WidgetButton>
          <WidgetButton
            onClick={() => act({ t: "coarseFocus", delta: 40, viewing: "eyepiece" })}
            disabled={!usable}
          >
            Up, at the eyepiece
          </WidgetButton>
          <WidgetButton
            variant="ghost"
            onClick={() => act({ t: "coarseFocus", delta: -40, viewing: "eyepiece" })}
            disabled={!usable}
          >
            Down, at the eyepiece
          </WidgetButton>
        </div>
      </fieldset>

      <div className="rounded-md border border-[var(--border)] px-3 py-2">
        <label htmlFor="ms-fine" className="text-sm font-medium">
          Fine focus
        </label>
        <input
          id="ms-fine"
          type="range"
          min={STAGE_MIN}
          max={STAGE_MAX}
          step={1}
          value={scope.stageHeight}
          disabled={!usable}
          onChange={(event) =>
            act({ t: "fineFocus", delta: Number(event.target.value) - scope.stageHeight })
          }
          className="mt-1 w-full"
          aria-valuetext={`${optics.focusError === 0 ? "Sharp" : `${Math.round(optics.focusError)} micrometres from sharp`}, ${optics.inFocus ? "in focus" : "not in focus"}`}
        />
      </div>

      <div className="rounded-md border border-[var(--border)] px-3 py-2">
        <label htmlFor="ms-iris" className="text-sm font-medium">
          Condenser iris
        </label>
        <input
          id="ms-iris"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={scope.iris}
          disabled={!usable}
          onChange={(event) => act({ t: "setIris", value: Number(event.target.value) })}
          className="mt-1 w-full"
          aria-valuetext={`${Math.round(scope.iris * 100)} per cent open`}
        />
      </div>

      <fieldset className="rounded-md border border-[var(--border)] px-3 py-2">
        <legend className="px-1 text-sm font-medium">Move the stage</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          <WidgetButton
            variant="ghost"
            onClick={() => act({ t: "panStage", dx: -120, dy: 0 })}
            disabled={!usable}
          >
            ← Left
          </WidgetButton>
          <WidgetButton
            variant="ghost"
            onClick={() => act({ t: "panStage", dx: 120, dy: 0 })}
            disabled={!usable}
          >
            Right →
          </WidgetButton>
          <WidgetButton
            variant="ghost"
            onClick={() => act({ t: "panStage", dx: 0, dy: -120 })}
            disabled={!usable}
          >
            ↑ Up
          </WidgetButton>
          <WidgetButton
            variant="ghost"
            onClick={() => act({ t: "panStage", dx: 0, dy: 120 })}
            disabled={!usable}
          >
            ↓ Down
          </WidgetButton>
        </div>
      </fieldset>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase 4 — measuring and calculating
// ---------------------------------------------------------------------------

function MeasureControls({
  state,
  act,
  divisions,
  setDivisions,
  drawnLength,
  setDrawnLength,
  magnification,
  setMagnification,
  working,
}: {
  state: ReturnType<typeof emptyRun>["state"];
  act: (action: MicroscopeAction) => void;
  divisions: string;
  setDivisions: (value: string) => void;
  drawnLength: string;
  setDrawnLength: (value: string) => void;
  magnification: string;
  setMagnification: (value: string) => void;
  working: ReturnType<typeof magnificationWorking>;
}) {
  const perDivision =
    state.measurement.calibratedUmPerDivision ?? umPerDivision(state.scope.objective);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-[var(--border)] px-3 py-2 text-sm">
        <p className="font-medium">Eyepiece graticule</p>
        <p className="mt-1 text-[var(--muted-foreground)]">
          Calibrated against a stage micrometer: 90 divisions measure 240 µm at ×400. At ×
          {state.scope.objective} one division is {perDivision.toFixed(2)} µm.
        </p>
      </div>

      <NumberField
        id="ms-divisions"
        label="How many divisions does one cell span?"
        value={divisions}
        onChange={setDivisions}
        onCommit={(value) => act({ t: "readGraticule", divisions: value })}
      />

      <NumberField
        id="ms-drawn"
        label="How long is that cell on your drawing, in millimetres?"
        value={drawnLength}
        onChange={setDrawnLength}
        onCommit={(value) => act({ t: "measureDrawing", lengthMm: value })}
      />

      {state.measurement.divisionsRead !== null ? (
        <p className="rounded-md bg-[var(--muted)]/60 px-3 py-2 text-sm">
          {state.measurement.divisionsRead} divisions × {perDivision.toFixed(2)} µm ={" "}
          <strong>{(state.measurement.divisionsRead * perDivision).toFixed(1)} µm</strong> — the
          real length of the cell.
        </p>
      ) : null}

      <NumberField
        id="ms-magnification"
        label="What is the magnification of your drawing?"
        value={magnification}
        onChange={setMagnification}
        onCommit={(value) => act({ t: "submitMagnification", value })}
      />

      {working && state.drawing.statedMagnification !== null ? (
        <div className="rounded-md bg-[var(--muted)]/60 px-3 py-2 text-sm">
          <p className="font-medium">The working</p>
          <p className="mt-1">
            Drawing {working.drawnLengthMm} mm = {(working.drawnLengthMm * 1000).toFixed(0)} µm.
            Real cell {working.actualLengthUm.toFixed(1)} µm.
          </p>
          <p className="mt-1">
            {(working.drawnLengthMm * 1000).toFixed(0)} ÷ {working.actualLengthUm.toFixed(1)} ={" "}
            <strong>×{working.magnification.toFixed(0)}</strong>, with no unit.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A number entry that only commits a value when it parses.
 *
 * `type="number"` with an explicit commit rather than live parsing: half-typed numbers
 * would otherwise land in the state and be marked.
 */
function NumberField({
  id,
  label,
  value,
  onChange,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: (value: number) => void;
}) {
  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed > 0;

  return (
    <div className="rounded-md border border-[var(--border)] px-3 py-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-32 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
        />
        <WidgetButton onClick={() => valid && onCommit(parsed)} disabled={!valid}>
          Record
        </WidgetButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

function Feedback({ result, run }: { result: ReturnType<typeof scoreRun>; run: Run }) {
  return (
    <div className="mt-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Method</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {result.points.map((point) => (
            <li key={point.id} className="flex gap-2">
              <span
                aria-hidden="true"
                className={point.awarded ? "text-[var(--success)]" : "text-[var(--warning)]"}
              >
                {point.awarded ? "✓" : "✗"}
              </span>
              <span>
                <span className={point.awarded ? "" : "font-medium"}>{point.text}</span>
                <span className="sr-only">
                  {point.awarded ? " — mark awarded" : " — not awarded"}
                </span>
                {point.awarded ? null : (
                  <span className="block text-[var(--muted-foreground)]">{point.why}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Your drawing</h3>
        <p className="text-xs text-[var(--muted-foreground)]">
          Advisory only — these never count towards your progress.
        </p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {result.drawing.points.map((point) => (
            <li key={point.id} className="flex gap-2">
              <span
                aria-hidden="true"
                className={
                  point.awarded === null
                    ? "text-[var(--muted-foreground)]"
                    : point.awarded
                      ? "text-[var(--success)]"
                      : "text-[var(--warning)]"
                }
              >
                {point.awarded === null ? "–" : point.awarded ? "✓" : "✗"}
              </span>
              <span>
                {point.text}
                <span className="block text-[var(--muted-foreground)]">{point.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--muted-foreground)]">
          What you did, step by step ({run.trace.length} actions)
        </summary>
        <ol className="mt-2 space-y-1">
          {run.trace.map((entry) => (
            <li
              key={entry.n}
              className={cn(
                "text-sm",
                entry.applied ? "" : "text-[var(--muted-foreground)] line-through",
              )}
            >
              {entry.n}. {entry.description}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
