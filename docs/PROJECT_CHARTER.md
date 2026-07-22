# Learning OS — Project Charter

## Product vision

Learning OS is a reusable, open-source learning platform. It transforms source material and real work context into an adaptive set of missions, practice, reflection, and evidence of capability.

**AI Consultant Mastery** is the first reference template, not a hard-coded product boundary.

## Learner outcome

The AI Consultant template aims to help a learner independently discover enterprise needs, select an appropriate workflow or agent design, diagnose common failures, and deliver an AI solution with measurable value.

## Experience principles

1. **Capability over attendance.** Completion is evidence from explanations, design choices, debugging, and implementation—not merely opening a lesson.
2. **Open world, with honest gates.** Only true prerequisite relationships block a main quest. Side quests stay explorable.
3. **Flexible rhythm.** A daily 21:30 reminder is supportive, not a deadline. A learner may do zero, one, or several missions without a catch-up penalty.
4. **Fold-first.** The compact screen supports quick status and starting; the unfolded 8-inch screen supports deep reading, diagrams, and challenges. Desktop-only work is visibly labelled ahead of time.
5. **Local first.** Personal logs live on the learner's device by default. Sharing and cloud sync remain optional additions.
6. **Gamification serves learning.** XP, maps, calendars, and achievements make progress legible; they do not reward empty activity.
7. **Open source by design.** Domain content lives in templates so a new subject can reuse the engine and dashboard.

## Learning modes

| Mode | Purpose |
| --- | --- |
| Main Quest | Essential concepts with genuine dependencies. |
| Side Quest | Timely or interest-led exploration such as MCP, Bedrock, or LangGraph. |
| Debug Lab | Diagnose deliberate failure cases; record weak reasoning in the review queue. |
| Client Challenge | Apply multiple skills to a realistic client decision. |
| World Event | Time-sensitive industry developments, added without disturbing the core path. |

## Current scope (v0.1)

- Static GitHub Pages PWA
- Local device progress: sessions, XP, completed missions, reflections, and review items
- AI Consultant template with an initial mission map and reading-index fields
- Responsive Fold-first dashboard and automatic Pages deployment

## Deferred deliberately

- Account sign-in and cross-device sync
- Uploading copyrighted learning material to the public repository
- Automated AI-generated curriculum from uploads
- A public portfolio or social sharing feature

## Decision history

### v0.1 — 2026-07-22

- Established Learning OS as a reusable core; AI Consultant Mastery is template one.
- Chose a non-linear, adaptive mission model.
- Chose Fold7 as the primary experience target.
- Chose local-first data storage for the initial public scaffold.
