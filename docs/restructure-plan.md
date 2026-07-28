# Chatoken Restructure Plan

[English](restructure-plan.md) | [繁體中文](restructure-plan.zh-TW.md)

> Status: **proposal only**. No code, document, or UI has been changed by this plan.
> Nothing will be modified until each phase below is approved individually.

## 1. Why This Plan Exists

The stated purpose of Chatoken is:

> An educational project for building a minimal ChatGPT-like system from scratch. It starts
> with a tiny PyTorch GPT model, exposes it through an AI API backend, and prepares the path
> for a Next.js Web UI. The path goes from random weights, through training, fine-tuning, API,
> and finally a Web UI.

The project now contains all of the material needed to teach that path. It does not present
it as a path. Features were added in the order they were built, not in the order they should
be learned, and every new feature was appended as another peer tab, another peer document,
and another block inside the same files.

The result: a learner opening the console sees sixteen equal-looking tabs and cannot tell
what to do first, what depends on what, or when one idea ends and the next begins.

The single rule this plan applies everywhere:

> **One stage teaches exactly one new idea, built on top of the previous stage.**

## 2. How To Use This Document

This document is the agreement, not the work. It is split into two parts:

- **Sections 3–11: the target design.** What the project should look like when finished.
- **Section 12: the execution phases.** Each phase is small, independently approvable, and
  leaves the project in a working state.

Approve, reject, or amend one phase at a time. No phase starts before its approval.

## 3. Current State (Measured)

These are counted facts from the repository, not impressions.

| Area | Measurement |
| --- | --- |
| Web console | 1 route, 1 file: [`apps/web/app/page.jsx`](../apps/web/app/page.jsx) at **5,425 lines** |
| Web state | **112 `useState`** calls and 8 `useEffect` inside the single `Home()` component |
| Web styling | [`apps/web/app/globals.css`](../apps/web/app/globals.css) at **1,358 lines**, global scope |
| Web navigation | **16 flat tabs** in one `TABS` array, no grouping, no order, no progress |
| API | [`apps/api/main.py`](../apps/api/main.py) at **862 lines**, ~35 endpoints, no routers |
| API jobs | **3 near-identical job systems** (chat / training / pretrained), each with its own class, runner, updater, canceller, and lock |
| Services | [`training_service.py`](../apps/api/services/training_service.py) at **1,158 lines** covering datasets, builder, training, experiments |
| Core library | `packages/llm_core` — 8 modules, 45–558 lines each. **This part is healthy.** |
| Documentation | **18 topics × 2 languages = 36 files**, flat in `docs/`, no numbering |
| README index | **36 links in one flat list**, 18 English then 18 Chinese, in build order |
| Tests | **0** |

### The 16 tabs today, in their current order

`GPT Model` · `Training Config` · `Chat` · `Conversation` · `Prompt Lab` · `External` ·
`Deploy` · `From Scratch` · `Raw Text` · `GPT-2` · `Instruction` · `LoRA` · `Chat SFT` ·
`Dataset Builder` · `Experiments` · `Checkpoints`

Four different kinds of thing are presented as peers:

- **Concepts** — GPT Model, Training Config
- **Tools used at every stage** — Chat, Conversation, Prompt Lab, Checkpoints, Experiments
- **Training stages** — From Scratch, Raw Text, GPT-2, Instruction, LoRA, Chat SFT, Dataset Builder
- **Side topics** — External, Deploy

`Deploy` sits at position 7, before the learner has trained anything. `External` (calling
someone else's hosted model) sits before `From Scratch` (training your own first model).
`Checkpoints` is last, although checkpoints appear from the first training run onward.

## 4. Diagnosis

| # | Problem | Effect on learning |
| --- | --- | --- |
| P1 | No ordering | The learner must guess the sequence. The sequence is the lesson. |
| P2 | No grouping | Sixteen peers exceed working memory. Four or five groups do not. |
| P3 | Mixed altitudes | A concept explainer and a training runner look identical, so neither reads as special. |
| P4 | Multiple ideas per screen | Screens combine dataset choice, base model, hyperparameters, run controls, and comparison at once. |
| P5 | Tools compete with lessons | Chat and Checkpoints are used *during* every stage, but occupy tab slots as if they were stages. |
| P6 | Documents mirror the mess | 36 flat files, named after features, listed in build order, English and Chinese interleaved. |
| P7 | No visible progress | Nothing records or shows what the learner already completed. |
| P8 | No stable vocabulary | A stage is called one thing in the UI, another in the docs, another in the API. |
| P9 | Files too large to teach from | A 5,425-line component cannot be read as an example of anything. |

Problems P1–P7 are curriculum problems. P8–P9 are structural problems that make the
curriculum problems impossible to fix cleanly. Both are addressed below.

## 5. Design Principles

1. **One new idea per stage.** If a stage needs two sentences to state its point, it is two stages.
2. **Every stage adds to the previous one.** Stage N assumes and reuses the artifact from stage N-1.
3. **Stages are ordered and numbered.** Order is visible in the UI, the docs, and the file names.
4. **Lessons and tools are different furniture.** Stages go on the ladder; tools stay always-available.
5. **One primary action per screen.** Everything else is collapsed, secondary, or moved.
6. **Show the evidence.** Each stage names the exact number or output the learner should look at.
7. **One vocabulary.** A stage id is identical in the UI route, the doc filename, and the API tag.
8. **Nothing is deleted.** Every existing feature keeps a home; it is relocated, not removed.
9. **Files stay readable.** Target: no source file over ~300 lines, no stage doc over ~250 lines.

## 6. The Curriculum Spine

Five parts, seventeen stages, plus one optional track. Every existing feature maps onto exactly
one of them.

### Part 1 · Generate — *a model can produce tokens*

| ID | Stage | The one new idea | You do | You observe |
| --- | --- | --- | --- | --- |
| S01 | Tokens | The model never sees text, only integer ids | Encode and decode a sentence | Token count, ids, round-trip back to text |
| S02 | Forward pass | Ids → embeddings → blocks → logits | Inspect the build order, run one forward pass | 136,704 parameters, logits shape, top token |
| S03 | Decoding | Sampling controls shape, not knowledge | Change `max_new_tokens`, `temperature`, `top_k` | Output changes but stays meaningless — weights are random |

### Part 2 · Train — *a model can learn from data*

| ID | Stage | The one new idea | You do | You observe |
| --- | --- | --- | --- | --- |
| S04 | Training loop | Loss is the learning signal | Train `random-tiny-byte` on `every-effort` | Loss falls; same prompt before vs after |
| S05 | Training knobs | Hyperparameters change the loop, not the architecture | Vary `max_steps`, `batch_size`, `block_size`, `learning_rate` | Which knob changes speed, which changes stability |
| S06 | Data scale | Better data beats more steps | Climb `every-effort` → `every-effort-expanded` → `learning-dialogues` → `the-verdict` | Eval loss and sample quality per dataset size |
| S07 | Checkpoints | A model is a file with lineage | Save, list, and load a checkpoint | Version id, base model, training config recorded |

### Part 3 · Reuse — *stand on someone else's training*

| ID | Stage | The one new idea | You do | You observe |
| --- | --- | --- | --- | --- |
| S08 | Pretrained GPT-2 | Same architecture, someone else paid for the compute | Download and load GPT-2 124M | Real English output; vocab 50,257 vs 257 |
| S09 | Prompt format | Formatting changes behavior with zero weight change | Compare `raw` / `chat` / `instruction` / custom templates and inference modes | Identical weights, different behavior |

### Part 4 · Align — *make it follow instructions and hold a conversation*

| ID | Stage | The one new idea | You do | You observe |
| --- | --- | --- | --- | --- |
| S10 | Instruction SFT | Training on (instruction, response) pairs makes a model answer | Full fine-tune GPT-2 on `instruction-following` | Before/after on the same instruction |
| S11 | LoRA | The same behavior change with ~1% trainable parameters | Train LoRA adapters on `instruction-lora` | Trainable parameter % vs full SFT, comparable output |
| S12 | Chat SFT | Multi-turn transcripts teach turn-taking | Train LoRA on `chat-sft-lora` | The model keeps roles and turn structure |
| S13 | Your own dataset | Your data is the product | Build examples, split train/eval, run custom SFT | How few examples already shift behavior |
| S14 | Compare runs | Compare only what is comparable | Diff two saved experiments | Sameness summary first, generated samples second |

### Part 5 · Ship — *turn a model into a system*

| ID | Stage | The one new idea | You do | You observe |
| --- | --- | --- | --- | --- |
| S15 | Conversation memory | The model is stateless; the application supplies memory | Run a multi-turn session and preview the context | What history survives the context window |
| S16 | Streaming & cancel | Tokens arrive one at a time and users must be able to stop | Stream a reply, then cancel it | Event flow, cancellation latency |
| S17 | Deploy & limits | Cost is context length × concurrency | Read the runtime profile, estimate resources | Which dimension grows fastest |

### Optional track

| ID | Track | Idea | Why it is off the spine |
| --- | --- | --- | --- |
| T1 | External providers | Compare your model against a hosted one | It teaches integration, not model building. Useful, but it does not add a layer to the ladder. |

### Coverage check

Every current tab has a destination, and nothing is lost:

| Today's tab | Becomes |
| --- | --- |
| GPT Model | S02 |
| Training Config | S05 |
| Chat | Persistent Playground panel (available in every stage) |
| Conversation | S15 |
| Prompt Lab | S09 |
| External | T1 |
| Deploy | S17 |
| From Scratch | S04 |
| Raw Text | S06 |
| GPT-2 | S08 |
| Instruction | S10 |
| LoRA | S11 |
| Chat SFT | S12 |
| Dataset Builder | S13 |
| Experiments | S14 |
| Checkpoints | S07 (lesson) + Workbench (tool) |
| — | S01, S03 are new stages, split out of material currently buried in `smoke_chat.py` docs |

## 7. Stage Page Contract

Every stage screen and every stage document uses the same six blocks, in the same order.
Consistency is what lets a learner stop navigating and start learning.

```
┌─ Stage 04 · Part 2 Train ───────────────────────────────────┐
│ FOCUS      One sentence. The single new idea.               │
│ CONCEPT    Short explanation. One diagram at most.          │
│ DO         One primary action. Advanced knobs collapsed.    │
│ OBSERVE    The exact values to look at, named.              │
│ EXIT CHECK "You may continue when all of these are true."   │
│ DEEP DIVE  Link to the stage document and the code map.     │
└─────────────────────────────────────────────────────────────┘
```

Rules enforced on every stage screen:

- Exactly **one** primary button.
- At most **six** visible controls; the rest live behind `Advanced`.
- Defaults are the teaching defaults — a learner who changes nothing gets the intended lesson.
- The OBSERVE block never says "look at the result"; it names the field.

## 8. Target UI Architecture

### Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Chatoken   ·   API online   ·   NVIDIA GeForce RTX 5070 Ti   ·   Docs      │
├───────────────────┬────────────────────────────────┬───────────────────────┤
│  LADDER           │  STAGE CANVAS                  │  PLAYGROUND           │
│                   │                                │                       │
│  Part 1 Generate  │  Stage 04 · Training loop      │  Active model:        │
│   01 Tokens     ✓ │                                │   trained-tiny-byte   │
│   02 Forward    ✓ │  FOCUS                         │                       │
│   03 Decoding   ✓ │  CONCEPT                       │  [prompt............] │
│  Part 2 Train     │  DO        [ Run training ]    │  [ Send ]             │
│   04 Loop       ● │  OBSERVE                       │                       │
│   05 Knobs        │  EXIT CHECK                    │  output               │
│   06 Data         │  DEEP DIVE →                   │                       │
│   07 Checkpoints  │                                │  (always visible)     │
│  Part 3 Reuse     │                                │                       │
│   …               │                                │                       │
├───────────────────┴────────────────────────────────┴───────────────────────┤
│  WORKBENCH ▸   Models · Checkpoints · Datasets · Runs · External           │
└────────────────────────────────────────────────────────────────────────────┘
```

### Three regions, three jobs

- **Ladder (left).** The curriculum. Grouped by part, numbered, with per-stage state:
  `done` ✓, `current` ●, `not started`. Collapsed parts keep the visible list short.
- **Stage canvas (center).** One stage, six blocks, one primary action.
- **Playground (right).** The always-available chat against whatever model is currently
  loaded. This replaces the `Chat` tab. Every stage now ends with "talk to what you just made"
  without navigating away.

**Workbench** is a drawer, not a tab row: Models, Checkpoints, Datasets, Runs, External
provider settings. These are inspection tools used at many stages, so they must not compete
with stages for attention.

### Navigation and progress

- Routes: `/` (curriculum map), `/stage/04-training-loop`, `/workbench/checkpoints`, `/track/external`.
- Progress is stored in `localStorage` per stage: `not-started` / `in-progress` / `done`.
- Stages are **ordered but not locked**. A learner may jump; jumping out of order shows a
  one-line banner: *"This stage assumes S03. You have not completed it."*
- The `/` map shows the whole ladder at once, so the shape of the course is visible before
  starting.

## 9. Target Repository Layout

### Web

```
apps/web/
  app/
    layout.jsx
    page.jsx                       # curriculum map only
    stage/[stageId]/page.jsx       # stage shell, driven by content registry
    workbench/[toolId]/page.jsx
    track/[trackId]/page.jsx
  content/
    curriculum.js                  # parts, stages, order, prerequisites
    stages/
      s01-tokens.js                # copy + which panels this stage mounts
      s02-forward-pass.js
      …
  components/
    layout/    TopBar · LadderRail · Playground · WorkbenchDrawer
    stage/     StageHeader · FocusBlock · ConceptBlock · DoBlock ·
               ObserveBlock · ExitCheck · DeepDive
    panels/    TokenizerPanel · ForwardPassPanel · TrainingPanel ·
               DatasetLadderPanel · CheckpointPanel · LoraPanel · …
    ui/        Card · Metric · Knob · JobStatus · CompareColumns
  lib/
    api.js                         # single fetch layer
    hooks/     useJob · useModels · useStream · useProgress
    format.js
  styles/                          # split from the 1,358-line globals.css
```

Line budget: no file over ~300 lines. The existing 5,425-line `page.jsx` becomes roughly
40 files, and each panel becomes a readable example in its own right — which matters, because
this is a teaching repository and the UI code is also teaching material.

### API

```
apps/api/
  main.py            # app factory, CORS, router registration  (~60 lines)
  routers/
    health.py  models.py  chat.py  conversations.py  training.py
    datasets.py  checkpoints.py  pretrained.py  experiments.py
    external.py  deployment.py
  schemas/           # pydantic request/response models, split by domain
  jobs/registry.py   # ONE generic job registry, replacing 3 duplicates
  services/          # unchanged responsibilities, minus job plumbing
```

The three parallel job systems in `main.py` (`ChatJob`, `TrainingJob`, `PretrainedJob`, each
with its own `_run_*`, `_update_*`, `_cancel_*`, `_*_cancel_requested` and lock) collapse into
one generic registry. That is roughly 200 lines of duplication removed with no behavior change.

`training_service.py` (1,158 lines) splits along its existing seams:
`dataset_registry.py` · `dataset_builder.py` · `trainer.py` · `experiment_store.py`.

**Endpoint paths do not change.** The API refactor is internal, so the web migration and the
API refactor never have to land together.

### Docs

```
docs/
  README.md / README.zh-TW.md          # the curriculum index — the single entry point
  stages/
    01-tokens.md            01-tokens.zh-TW.md
    02-forward-pass.md      02-forward-pass.zh-TW.md
    …
    17-deploy-limits.md     17-deploy-limits.zh-TW.md
  tracks/
    external-models.md      external-models.zh-TW.md
  reference/
    setup.md  gpu-runtime.md  api.md  architecture.md  glossary.md  troubleshooting.md
    (each with its .zh-TW.md pair)
  restructure-plan.md       restructure-plan.zh-TW.md   # this document
```

The root `README.md` shrinks to: what Chatoken is, how to set it up, how to start it, and one
link to the curriculum index. The 36-link flat list is deleted from the README, not from the
project — `docs/README.md` becomes the ordered index, and the language switch stays per file
exactly as it works today.

## 10. The Naming Contract

One id per stage, used everywhere. This is what stops the UI, docs, and API from drifting apart.

| Surface | Form |
| --- | --- |
| Stage id | `04-training-loop` |
| Web route | `/stage/04-training-loop` |
| Content module | `apps/web/content/stages/s04-training-loop.js` |
| Document | `docs/stages/04-training-loop.md` (+ `.zh-TW.md`) |
| API tag | `stage:04-training-loop` on the relevant endpoints |
| Progress key | `chatoken.progress.04-training-loop` |

Proposed source of truth: a single `curriculum.json` at the repository root, read by the web
app at build time and by a small check script that verifies every stage has both language
documents and a content module. See decision D4.

## 11. Documentation Plan

### Stage document template

Every stage document has the same ten sections, in the same order:

1. Title, language switch line, `Stage N · Part` line
2. **Focus** — one sentence
3. **Prerequisites** — the previous stage and the artifact it produced
4. **Concept** — ≤ 400 words, at most one diagram
5. **Run it** — Console steps first, CLI/`curl` equivalent second
6. **What to observe** — numbered, each tied to a named value on screen
7. **Exit check** — checklist
8. **Common problems**
9. **Code map** — the files and functions this stage touches
10. **Next stage** — one link

### Migration map

| Current document | Destination |
| --- | --- |
| `learning-experience.md` | Split into the exit checks of S01–S03, plus `reference/troubleshooting.md` |
| `smoke-chat.md` | S01 concept + S02/S03 code map |
| `model-foundations.md` | S02 |
| `training-loop.md` | S04 |
| `smoke-train.md` | S04 code map |
| *(new)* | S05, from the current Training Config tab copy |
| `dataset-ladder-experiments.md` | S06 |
| `model-version-experiment-comparison.md` | Split: versioning → S07, comparison → S14 |
| `gpt2-pretrained.md` | Split: loading → S08, instruction prompts → S09/S10 |
| `inference-prompt-playground.md` | S09 |
| `lora-peft.md` | S11 |
| `minimal-chat-model.md` | S12 |
| `dataset-builder.md` | S13 |
| `conversation-memory.md` | S15 |
| `streaming-chat-cancel.md` | S16 |
| `deployment-resource-limits.md` | S17 |
| `external-model-integration.md` | `tracks/external-models.md` |
| `gpu-runtime.md` | `reference/gpu-runtime.md` |
| `web-console.md` | Split: the 28-step walkthrough becomes `docs/README.md`; the UI description becomes `reference/architecture.md` |

Every current document is either moved, split, or absorbed. None is discarded.

To avoid breaking existing links immediately, each old path may keep a one-line pointer file
for one release. See decision D6.

## 12. Execution Phases

Each phase is separately approvable and leaves the repository working. Sizes are relative
effort, not time estimates.

### Phase 0 — Agree the spine · Size S · No code

Approve section 6 (the 17 stages, their order, and the one idea each) and the naming contract
in section 10. Everything downstream depends on this and nothing else can start first.

**Deliverable:** an approved stage table.
**Verification:** you confirm the list.

---

### Phase 1 — Documentation restructure · Size M · Docs only, zero code change

Create `docs/stages/`, `docs/tracks/`, `docs/reference/`. Move and rewrite the 18 existing
topics into the 17 stage documents plus 1 track and the reference set, in both languages,
using the section 11 template. Write the new `docs/README.md` curriculum index. Trim the root
`README.md` to setup plus one link.

**Why first:** it is the cheapest phase, it validates the curriculum before any code moves,
and if the ladder is wrong it is far cheaper to find out here.
**Verification:** every stage has both language files; every link resolves; the ordered index
reads as a course.

---

### Phase 2 — Web shell · Size L · New UI skeleton, old console still reachable

Build `curriculum.js`, the routing (`/`, `/stage/[stageId]`), the LadderRail, TopBar,
Playground, WorkbenchDrawer, `lib/api.js`, and the six stage blocks. Migrate **S01–S03** as
the first real stages. Keep the current console reachable at `/legacy` so nothing is lost
mid-migration.

**Verification:** stages 01–03 work end to end against the unchanged API; `/legacy` still works.

---

### Phase 3 — Migrate Part 2 and Part 3 · Size L

Move S04–S07 (training loop, knobs, data scale, checkpoints) and S08–S09 (pretrained GPT-2,
prompt format) out of `page.jsx` into panels. Move the Checkpoints and Models browsers into
the Workbench.

**Verification:** each migrated stage reproduces the behavior of its old tab, with the
extra controls collapsed behind `Advanced`.

---

### Phase 4 — Migrate Part 4 and Part 5 · Size L

Move S10–S14 (instruction SFT, LoRA, chat SFT, dataset builder, experiment comparison) and
S15–S17 (conversation memory, streaming and cancel, deploy and limits), plus track T1
(external providers). Delete `/legacy` and the old `page.jsx` once every tab has a home.

**Verification:** the coverage table in section 6 is fully satisfied; nothing from the old
console is unreachable.

---

### Phase 5 — API refactor · Size M · No endpoint changes

Split `main.py` into routers, extract the generic job registry, split `training_service.py`,
add OpenAPI tags matching stage ids. Add a small `tests/` suite first — roughly 6–10 API
smoke tests — so the refactor is verifiable rather than hopeful.

**Verification:** tests pass before and after; every endpoint path and response shape is
unchanged; the web app needs no edits.

---

### Phase 6 — Consistency pass · Size S

Align remaining names (dataset ids, model ids, script names), add the curriculum check script,
add `reference/glossary.md`, and walk the entire ladder from S01 to S17 as a new learner would,
fixing whatever breaks the flow.

**Verification:** a clean-clone walkthrough completes without consulting anything outside
`docs/README.md`.

## 13. Non-Goals

This plan explicitly does **not**:

- add any new machine-learning capability, dataset, or model;
- remove any existing feature — everything is relocated;
- rewrite `packages/llm_core`, which is already small and readable;
- introduce a database, authentication, or cloud deployment;
- change any API endpoint path or response shape;
- change training behavior or numerical results.

## 14. Open Decisions

These change the work and are yours to settle. Recommendations are marked.

| # | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| D1 | Stage granularity | 17 stages as listed, or merge to ~12 by folding S05 into S04, S09 into S08, S14 into S13, S16 into S15 | **17.** Each merge puts two ideas on one screen, which is the problem being fixed. |
| D2 | UI language | English UI + bilingual docs (as today), or a bilingual UI with a language toggle | **English UI first.** A UI i18n layer touches every stage string; it is a clean follow-up phase once the ladder is settled. |
| D3 | Progress gating | Soft (ordered, jumpable, with a warning banner) or hard (locked until the previous stage is done) | **Soft.** Learners revisit and skip; hard locks punish that. |
| D4 | Curriculum source of truth | One `curriculum.json` at the repo root consumed by web and a doc-check script, or separate lists in web and docs | **`curriculum.json`.** Drift between UI and docs is exactly problem P8. |
| D5 | Script names | Keep `smoke_chat.py` / `smoke_train.py`, or rename to stage-aligned names | **Keep.** They are cited across many documents and the rename buys little. |
| D6 | Old doc paths | Keep one-line pointer files for one release, or delete immediately | **Keep pointers.** Cheap, and external links keep working. |

## 15. Risks

| Risk | Mitigation |
| --- | --- |
| The curriculum order turns out to be wrong after code has moved | Phase 1 is docs-only and comes first; the order is validated in prose before any component moves. |
| The `page.jsx` split loses behavior | Migrate stage by stage; keep `/legacy` reachable through Phases 2–3; delete only after the coverage table is satisfied. |
| The API refactor changes training results | Endpoint paths and response shapes are frozen; tests land before the refactor; `llm_core` is untouched. |
| Documentation churn breaks existing links | One-line pointer files at old paths for one release (D6). |
| The restructure stalls halfway | Every phase ends in a working state, and phases 1, 5, and 6 are independently valuable even if the rest is deferred. |

## 16. What Success Looks Like

A developer who has never seen this repository:

1. Opens `docs/README.md` and sees a 17-stage course, grouped into five parts.
2. Opens the console and sees the same ladder, with stage 01 highlighted.
3. Completes stage 01 in a few minutes, knowing exactly what one idea they just learned.
4. Reaches stage 17 without ever having to ask "what should I do next?".
5. Can read any single source file in the project in one sitting.
