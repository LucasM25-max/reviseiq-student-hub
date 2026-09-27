/**
 * Lesson 3 — Required practical 1: microscopy.
 *
 * Block plan from docs/plan/slices/biology-4.1.1.2-animal-and-plant-cells.md §3.
 * Structurally different from lessons 1 and 2: a short framing, then the simulation,
 * then the write-up.
 *
 * The `microscope-practical` widget is the Phase 4b engine (D50). Until it lands, the
 * renderer shows the method and fault table from the practical definition, which is the
 * same data the engine will consume — so this lesson is useful now and gets better later
 * without being rewritten.
 */
import type { LessonInput } from "@/lib/content/schema";

export const lesson3: LessonInput = {
  id: "bio-4112-l3",
  subTopicId: "aqa-biology-4.1.1",
  slug: "required-practical-microscopy",
  title: "Required practical: microscopy",
  summary:
    "Prepare a slide of onion cells, drive the microscope without breaking anything, draw what you see, and work out the magnification of your drawing.",
  order: 2,
  estMinutes: 30,
  tier: "BOTH",
  blocks: [
    {
      type: "keyIdea",
      specPoints: ["bio-rp-1"],
      body: "Required practicals are examined in the written papers, and practical questions are worth at least 15% of the marks. You will not be asked *did you do it* — you will be asked why a step is done the way it is.\n\nSo as you work through this practical, the question to keep asking is **what would go wrong if I skipped this?** Every step exists because something goes wrong without it, and that is what the exam asks about.",
    },
    {
      type: "prose",
      specPoints: ["bio-rp-1"],
      body: "## What you need\n\nA light microscope with a ×10 eyepiece and ×4, ×10 and ×40 objective lenses. A slide and coverslip. An onion, forceps and a mounted needle. A pipette and water. Iodine solution. A paper towel. Pencil and paper for the drawing.\n\n**Eye protection goes on before the iodine comes out.** Iodine solution is an irritant, and it stains skin and clothes. Putting the goggles on after you have started is not a safety precaution, it is an apology.",
    },
    {
      type: "widget",
      widgetId: "microscope-practical",
      specPoints: ["bio-rp-1"],
      config: {
        practicalId: "bio-rp-1",
        specimen: "onion-epidermis",
        phases: ["prepare", "find", "draw", "measure"],
        drawing: "freehand",
      },
    },
    {
      type: "prose",
      specPoints: ["bio-rp-1"],
      body: '## What makes a biological drawing creditworthy\n\nThe marks for a drawing are not for artistic quality. They are for a specific set of conventions:\n\n- **Pencil, and single clear lines.** No sketchy, feathered, overlapping strokes.\n- **No shading and no colouring in.**\n- **Large enough to see** — a drawing should fill a good part of the space you are given.\n- **Draw what is actually there**, not what the textbook diagram shows. If you can only see cell walls and nuclei, draw cell walls and nuclei.\n- **Label lines are straight, drawn with a ruler, and do not cross each other.** Each one touches the structure it names.\n- **A magnification is written underneath.** The requirement says "a magnification scale must be included", and a drawing without one is incomplete.',
    },
    {
      type: "misconception",
      specPoints: ["bio-rp-1"],
      claim: "The magnification you write under the drawing is the microscope's magnification.",
      correction:
        'It is not. If you viewed the cells at ×400, that is how much the **microscope** magnified them. The number under your drawing is how much larger your **drawing** is than the real cell:\n\n$$\\text{magnification} = \\frac{\\text{length of drawing}}{\\text{actual length of the cell}}$$\n\nThe two are almost never the same, because how big you chose to draw the cell has nothing to do with which lens you used. Writing "×400" under a drawing you made with a pencil is one of the most common errors on this practical.',
    },
    {
      type: "example",
      specPoints: ["bio-rp-1", "bio-4112-est"],
      title: "From graticule divisions to the magnification of your drawing",
      steps: [
        "You are viewing with the ×10 eyepiece and the ×40 objective, so the microscope's total magnification is 10 × 40 = ×400.",
        "At ×400 the eyepiece graticule has been calibrated so that 90 divisions measure 240 µm. One division is therefore 240 ÷ 90 = 2.67 µm.",
        "Your cell measures 90 graticule divisions from end to end, so its actual length is 90 × 2.67 = 240 µm.",
        "Put both lengths in the same unit before dividing. 240 µm = 0.24 mm, because there are 1000 µm in a millimetre.",
        "You measure your drawing of that cell with a ruler: it is 120 mm long.",
        "magnification = length of drawing ÷ actual length = 120 ÷ 0.24 = 500.",
        "Write ×500 under the drawing. Note that it takes no unit — it is a ratio of two lengths, so the units cancel. And note that it is not ×400: the microscope's magnification and the drawing's magnification are different numbers.",
      ],
    },
    {
      type: "summary",
      specPoints: [],
      body: "**The method, in the language the exam uses:**\n\n1. Goggles on, then a drop of water on a clean slide.\n2. Peel a thin layer of epidermis from the **inner** surface of the onion.\n3. Lay it flat on the water — no folds.\n4. Two drops of iodine solution, to increase contrast.\n5. Lower the coverslip from one edge with a mounted needle, to avoid trapping air bubbles.\n6. Blot the excess liquid so the coverslip cannot drift.\n7. **Lowest power objective first.** Rack the lens down close to the slide **while looking from the side**.\n8. Then look down the eyepiece and focus by **increasing** the gap — so you can never drive the lens into the slide.\n9. Centre the cells, switch to a higher power, and refocus with the **fine** dial only.\n10. Draw, label, measure, and write the magnification of the drawing underneath.\n\nThe full method, the sources of error and the exam questions that come from each one are on the [required practical sheet](/revise/biology/practicals/rp-1).",
    },
  ],
};
