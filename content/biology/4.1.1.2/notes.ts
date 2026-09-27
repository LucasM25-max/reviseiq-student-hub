/**
 * Revision notes — 4.1.1.2 Animal and plant cells.
 *
 * Section slugs are **permanent once shipped**: Today deep-links to them, so renaming one
 * breaks every plan item that points at it. Add a new section rather than rename an old one.
 */
import type { NotesPageInput } from "@/lib/content/schema";

export const notes: NotesPageInput = {
  subTopicId: "aqa-biology-4.1.1",
  sections: [
    {
      id: "bio-4112-n1",
      slug: "animal-cells",
      title: "Parts of an animal cell",
      tier: "BOTH",
      specPointCodes: ["4.1.1.2"],
      body: '**Most animal cells have:** a nucleus, cytoplasm, a cell membrane, mitochondria and ribosomes.\n\n"Most", not "all" — a mature red blood cell has no nucleus.\n\nRibosomes are on the list even though a light microscope cannot resolve them. Mitochondria are on the list for animal cells, not just plant cells.',
    },
    {
      id: "bio-4112-n2",
      slug: "plant-cells",
      title: "What plant and algal cells add",
      tier: "BOTH",
      specPointCodes: ["4.1.1.2"],
      body: 'Plant cells have everything an animal cell has, plus:\n\n| Structure | Who has it | Note |\n| --- | --- | --- |\n| Cell wall, made of cellulose | Plant **and algal** cells | Strengthens the cell |\n| Chloroplasts | Plant cells, **often** | Only in cells that receive light |\n| Permanent vacuole, filled with cell sap | Plant cells, often | Helps keep the cell firm |\n\n**Three words carry marks here.**\n\n- **Algal.** The cell wall statement covers plant and algal cells. Algae are not plants.\n- **Often.** Root hair cells are plant cells with no chloroplasts, because there is no light underground. "All plant cells have chloroplasts" is marked wrong.\n- **Permanent.** Animal cells can have small temporary vacuoles; it is the permanent one that is a plant feature.',
    },
    {
      id: "bio-4112-n3",
      slug: "functions",
      title: "Structure and function",
      tier: "BOTH",
      specPointCodes: ["4.1.1.2"],
      body: '| Structure | Function — in the words that earn marks |\n| --- | --- |\n| Nucleus | Contains the genetic material (DNA) as chromosomes; controls the activities of the cell |\n| Cytoplasm | Where most of the chemical reactions of the cell take place |\n| Cell membrane | Controls which substances enter and leave the cell |\n| Mitochondria | The site of aerobic respiration, which transfers energy for the cell to use |\n| Ribosomes | The site of protein synthesis |\n| Chloroplasts | The site of photosynthesis; contain chlorophyll, which absorbs light |\n| Permanent vacuole | Contains cell sap; helps keep the cell firm |\n| Cell wall | Made of cellulose; strengthens the cell |\n\n**Rejected phrasings.** "Powerhouse of the cell", "mitochondria make/produce energy", "the nucleus is the brain of the cell", "the cell wall controls what enters". Energy is transferred, not made, and control of entry belongs to the membrane.\n\n**Chlorophyll is not a chloroplast.** The chloroplast is the structure; chlorophyll is the green pigment inside it that absorbs the light.',
    },
    {
      id: "bio-4112-n4",
      slug: "estimating",
      title: "Judging relative size and area",
      tier: "BOTH",
      specPointCodes: ["4.1.1.2"],
      body: "**Sizes to know**\n\n| Structure | Size |\n| --- | --- |\n| Animal cell | 10–30 µm |\n| Plant cell | 10–100 µm |\n| Nucleus | 5–10 µm |\n| Chloroplast | 3–10 µm |\n| Mitochondrion | 1–2 µm |\n| Ribosome | about 20 nm |\n\n1 mm = 1000 µm, and 1 µm = 1000 nm.\n\n**Three ways to estimate**\n\n1. **Count across a known distance.** Five cells fit along a 300 µm scale bar, so one cell is about 300 ÷ 5 = 60 µm.\n2. **Take a fraction of a known cell.** The cell is 20 µm wide and the nucleus looks like a quarter of it, so the nucleus is about 5 µm.\n3. **Area.** A cell 30 µm by 15 µm has an area of 450 µm². If about 18 nuclei would fit inside it, one nucleus is about 450 ÷ 18 = 25 µm².\n\nAreas are in µm², not µm. Halving a length does not halve an area — it quarters it.\n\n**When to estimate:** when an approximate value answers the question, when you have one known length to compare against, or when you are checking an answer is sensible. **When not to:** when the precision matters, such as calibrating a graticule.\n\n**Comparison symbols:** $=$ equal to · $<$ less than · $\\ll$ much less than · $>$ greater than · $\\gg$ much greater than · $\\propto$ proportional to · $\\sim$ roughly.",
    },
    {
      id: "bio-4112-n5",
      slug: "practical",
      title: "Required practical 1: microscopy",
      tier: "BOTH",
      specPointCodes: ["4.1.1.2"],
      body: "The full sheet — aim, apparatus, method, sources of error, safety and exam questions — is at [/revise/biology/practicals/rp-1](/revise/biology/practicals/rp-1), and is reproduced inline below.\n\n**In short:** water on the slide · peel the **inner** epidermis · lay it flat · **two drops of iodine** · lower the coverslip with a **mounted needle** · blot · **lowest power first** · rack down **watching from the side** · focus by **increasing** the gap · centre, magnify, fine focus only · draw, label, measure, state the drawing's magnification.",
    },
    {
      id: "bio-4112-n6",
      slug: "drawing-rules",
      title: "What makes a biological drawing creditworthy",
      tier: "BOTH",
      specPointCodes: ["4.1.1.2"],
      body: "- Pencil, single clear lines — not sketchy or overlapping.\n- No shading, no colour.\n- Large enough to fill a good part of the space.\n- Draw what you can actually see, not the textbook diagram.\n- Straight, ruled label lines that do not cross, each touching the structure it names.\n- The magnification of the **drawing** written underneath.\n\n$$\\text{magnification of drawing} = \\frac{\\text{length of drawing}}{\\text{actual length of the cell}}$$\n\nThis is **not** the microscope's magnification. Both lengths must be in the same unit before you divide, and the answer takes no unit because it is a ratio.\n\n**Worked example.** A cell measures 90 graticule divisions at ×400, where one division is 2.67 µm. Actual length = 90 × 2.67 = 240 µm = 0.24 mm. The drawing is 120 mm long. Magnification = 120 ÷ 0.24 = **×500**.",
    },
    {
      id: "bio-4112-n7",
      slug: "exam-technique",
      title: "Why naming a part rarely earns full marks",
      tier: "BOTH",
      specPointCodes: ["4.1.1.2"],
      body: '**Match the answer to the command word.**\n\n- **Name / State / Give** — the word alone is enough.\n- **Describe** — say what happens, no reason needed.\n- **Explain** — say *why*. An explanation that never uses "because", "so" or "therefore" is usually a description in disguise.\n- **Compare** — every mark needs a **paired** statement. "A plant cell has a cell wall" scores nothing on a compare question; "a plant cell has a cell wall **whereas** an animal cell does not" scores.\n- **Suggest** — apply what you know to a situation you have not met. There is often more than one creditworthy answer.\n- **Calculate** — show the working. Method marks survive a wrong final answer; a bare wrong number earns nothing.\n\n**A correct statement contradicted by an incorrect one scores zero.** Writing "the membrane controls what enters, and so does the cell wall" loses the mark you had already earned. Do not hedge by listing everything you can think of.\n\n**Keep the hedges.** "Plant cells often have chloroplasts" is right; "all plant cells have chloroplasts" is wrong.\n\n**Units and prefixes are marked.** A correct number with the wrong prefix, or with no unit where one is needed, does not score.',
    },
  ],
};
