/**
 * Required practical activity 1 — Microscopy.
 *
 * Authored from the AQA GCSE Biology (8461) required practical activities handbook:
 * teachers' notes and the 20-step student sheet.
 *
 * **D50.** The fault table below is content data, authored now in Phase 3. The
 * simulation that renders it is the Phase 4b engine. One source, three consumers — the
 * visible consequence in the simulation, the mark-scheme point in the question bank, and
 * the "sources of error" section of the revision sheet — so they cannot drift apart.
 *
 * **D48.** Onion epidermal cells only. The AQA requirement says "plant *and* animal
 * cells", so `bio-rp-1` is declared PARTIAL in the taxonomy and reported as a gap rather
 * than quietly counted as done.
 */
import type { PracticalInput } from "@/lib/content/schema";

export const rp1Microscopy: PracticalInput = {
  id: "bio-rp-1",
  subjectId: "aqa-biology",
  number: 1,
  title: "Microscopy",
  requirement:
    "Use a light microscope to observe, draw and label a selection of plant and animal cells. A magnification scale must be included.",
  aim: "Prepare a temporary mount of onion epidermal cells, observe them under a light microscope, produce a labelled biological drawing and calculate the magnification of that drawing.",
  apparatus: [
    "Light microscope with ×10 eyepiece and ×4, ×10 and ×40 objective lenses",
    "Microscope slide and coverslip",
    "Onion",
    "Forceps and a scalpel or knife",
    "Mounted needle",
    "Dropping pipette and distilled water",
    "Iodine solution",
    "Paper towel",
    "Eyepiece graticule and stage micrometer",
    "Pencil and plain paper for the drawing",
    "Eye protection",
  ],
  method: [
    {
      n: 1,
      text: "Put on eye protection before handling iodine solution.",
      why: "Iodine solution is an irritant and stains skin and clothing.",
    },
    {
      n: 2,
      text: "Use a dropping pipette to place one drop of water in the middle of a clean microscope slide.",
      why: "The water supports the specimen and stops the cells drying out and shrivelling.",
    },
    { n: 3, text: "Cut a small square from a layer of onion." },
    {
      n: 4,
      text: "Use forceps to peel a thin layer of epidermis from the inner surface of the onion square.",
      why: "The inner epidermis peels away as a single layer of cells, thin enough for light to pass through.",
    },
    {
      n: 5,
      text: "Place the epidermis flat on the drop of water, using the forceps to unfold any creases.",
      why: "A folded specimen has cells at several depths, so they cannot all be in focus at once.",
    },
    {
      n: 6,
      text: "Add two drops of iodine solution to the specimen.",
      why: "Iodine stains the cells and increases contrast, so the nuclei and cell walls become visible.",
    },
    {
      n: 7,
      text: "Stand a coverslip on one edge next to the specimen and use a mounted needle to lower it slowly onto the slide.",
      why: "Lowering from one edge pushes the air out ahead of the coverslip, so no bubbles are trapped.",
    },
    {
      n: 8,
      text: "Blot away any liquid that has spread beyond the coverslip with a paper towel.",
      why: "Excess liquid lets the coverslip float and drift, so the field of view will not stay still.",
    },
    {
      n: 9,
      text: "Place the slide on the microscope stage and secure it with the stage clips.",
    },
    {
      n: 10,
      text: "Select the lowest power objective lens.",
      why: "The field of view is widest at low power, so the cells are easy to find. At high power there is nothing to aim at.",
    },
    {
      n: 11,
      text: "Looking at the microscope from the side, turn the coarse focusing dial to bring the objective lens close to the slide.",
      why: "Watching from the side is the only way to see how close the lens is. Racking down while looking through the eyepiece cracks the slide.",
    },
    {
      n: 12,
      text: "Now look down the eyepiece and turn the coarse focusing dial to increase the distance between the lens and the slide until the cells come into focus.",
      why: "Focusing by moving away from the slide can never drive the lens into it.",
    },
    {
      n: 13,
      text: "Move the slide until a clear group of cells is in the centre of the field of view.",
    },
    {
      n: 14,
      text: "Switch to the next objective lens and bring the image back into focus with the fine focusing dial only.",
      why: "Depth of field shrinks as magnification rises, so only the fine adjustment is precise enough.",
    },
    { n: 15, text: "Repeat to reach the highest power, ×400 in total." },
    {
      n: 16,
      text: "Make a large, clear pencil drawing of a few cells and label the structures you can see.",
    },
    {
      n: 17,
      text: "Line up the eyepiece graticule with one cell and record its length in graticule divisions.",
    },
    {
      n: 18,
      text: "Use the calibration for this objective to convert the reading to micrometres.",
    },
    {
      n: 19,
      text: "Measure the length of the same cell on your drawing in millimetres, and convert to the same unit as the actual length.",
    },
    {
      n: 20,
      text: "Calculate the magnification of your drawing using magnification = length of drawing ÷ actual length of the cell, and write it under the drawing.",
    },
  ],
  safety: [
    "Wear eye protection whenever iodine solution is in use — it is an irritant.",
    "Iodine solution stains skin, clothing and bench surfaces; wipe up spills immediately.",
    "Cut the onion on a tile with the blade moving away from your fingers.",
    "Coverslips are thin glass and break easily; report and clear breakages at once.",
    "Never focus downwards while looking through the eyepiece — the lens can break the slide and send glass towards your eye.",
  ],

  /**
   * The fault table (D50).
   *
   * Each row is one mistake, one visible consequence and one reason the correct technique
   * exists — and that reason is what the exam actually asks for. `questionIds` is checked
   * against the real question bank by `npm run content:validate`, so a question that is
   * renamed or deleted breaks the build instead of silently orphaning a fault.
   */
  faults: [
    {
      id: "air-bubbles",
      trigger:
        "The coverslip is dropped flat onto the specimen instead of being lowered from one edge with a mounted needle.",
      effect:
        "Two to five perfectly round, dark-rimmed circles sit over the field of view and cannot be focused away.",
      reason:
        "Lowering the coverslip slowly from one edge pushes air out ahead of it, so no bubbles are trapped. Trapped bubbles obscure the cells and are commonly mistaken for cells, because they are round with a thick dark outline.",
      questionIds: ["bio-4112-q13", "bio-4112-q14"],
      fatal: false,
    },
    {
      id: "no-stain",
      trigger: "No iodine solution is added before the coverslip goes on.",
      effect:
        "The cells are almost transparent. Outlines are faint and the nuclei cannot be seen at all.",
      reason:
        "Iodine stains the cell contents and increases contrast. Without it there is too little difference in colour between the structures and the background for them to be distinguished.",
      questionIds: ["bio-4112-q13", "bio-4112-q15"],
      fatal: false,
    },
    {
      id: "over-stained",
      trigger: "More than three drops of iodine solution are added.",
      effect:
        "The specimen goes dark orange-brown and opaque; the structures merge into one another and nothing can be resolved.",
      reason:
        "Stain increases contrast only up to a point. Too much of it absorbs the light passing through the specimen, so no detail reaches the eyepiece.",
      questionIds: ["bio-4112-q16"],
      fatal: false,
    },
    {
      id: "too-thick",
      trigger:
        "The epidermis is peeled from the outer surface of the onion, or it is placed on the slide folded.",
      effect:
        "Cells lie at several different depths. Some are sharp while others are blurred, and no setting of the focus makes them all clear at once.",
      reason:
        "A light microscope forms an image of one thin focal plane. The specimen must be a single layer of cells so that all of it can be in focus, and so that light can pass through it.",
      questionIds: ["bio-4112-q13"],
      fatal: false,
    },
    {
      id: "dry-mount",
      trigger: "The specimen is placed on the slide with no drop of water.",
      effect:
        "The cells shrivel, the edges darken, and the specimen curls away from the slide.",
      reason:
        "Water supports the tissue and stops it drying out, so the cells keep their normal shape while they are being observed.",
      questionIds: ["bio-4112-q13"],
      fatal: false,
    },
    {
      id: "drifting-coverslip",
      trigger: "Liquid spreading beyond the edge of the coverslip is not blotted away.",
      effect:
        "The coverslip floats. The field of view drifts slowly and will not stay still long enough to draw.",
      reason:
        "Blotting removes the excess liquid so the coverslip settles onto the slide and the specimen stays in one position.",
      questionIds: [],
      fatal: false,
    },
    {
      id: "cracked-slide",
      trigger:
        "The coarse focusing dial is turned to move the objective lens downwards while looking through the eyepiece.",
      effect:
        "The objective lens is driven into the slide. The slide cracks, the run ends, and a fresh slide must be prepared.",
      reason:
        "You cannot judge the gap between the lens and the slide through the eyepiece. The lens is brought close while watching from the side, and focusing is then done by increasing the gap, so the lens can never be driven into the glass.",
      questionIds: [],
      fatal: true,
    },
    {
      id: "lost-at-high-power",
      trigger:
        "An objective lens other than the lowest power is selected before any cells have been found and focused.",
      effect:
        "The field of view is dark and empty. Moving the stage sweeps past everything too quickly to catch.",
      reason:
        "The field of view narrows as magnification rises, so at high power only a tiny area of the slide is visible and it is unlikely to contain the specimen. The cells are found and centred at low power first, then magnified.",
      questionIds: ["bio-4112-q16"],
      fatal: false,
    },
    {
      id: "no-goggles",
      trigger: "Iodine solution is added before eye protection is put on.",
      effect:
        "A safety breach is recorded on the method trace and the run cannot score the safety mark.",
      reason:
        "Iodine solution is an irritant. Eye protection is put on before it is handled, not after.",
      questionIds: [],
      fatal: false,
    },
  ],

  subTopicIds: ["aqa-biology-4.1.1"],
  atSkills: ["AT 1", "AT 7"],
  // D48 — the requirement names plant *and* animal cells; we cover the plant half only.
  coverage: "PARTIAL",
  blockedBy: ["Onion epidermal cells only — animal cells are deliberately out of scope (D48)"],
};
