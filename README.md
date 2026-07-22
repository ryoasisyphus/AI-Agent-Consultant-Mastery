# Learning OS

An open, mobile-first learning system built around capability—not a fixed calendar.

**AI Consultant Mastery** is the first template. It helps learners build the judgement to design, diagnose, and deliver valuable AI agent workflows.

## What is included

- Fold-first PWA dashboard with local, private progress tracking
- Main quests with only meaningful prerequisites
- Side quests, review queue, and consultant challenges
- XP, levels, learning minutes, and a visual activity calendar
- A template format designed to support any future learning domain
- GitHub Pages workflow for zero-maintenance hosting

## Start locally

Open `index.html` in a browser for a static preview. For the installable experience, use the GitHub Pages URL after deployment and choose **Add to Home screen** on your Fold.

## Repository map

```text
.
├── index.html                 # Learning OS application shell
├── styles.css                 # Fold-first visual system
├── app.js                     # Local learning engine and interactions
├── templates/
│   └── ai-consultant/         # The first domain template
├── docs/                      # Product decisions and implementation guides
└── .github/workflows/         # GitHub Pages deployment
```

## Privacy model

Your learning log, XP, and session data stay in browser storage on your device. The public repository contains only reusable learning templates and sample data. Sync and account features are intentionally deferred until the local-first experience is proven.

## Create another learning project

Duplicate `templates/ai-consultant`, replace its metadata, skills, missions, and reading index, then point `app.js` at the new template. The dashboard and progression engine remain unchanged.

See [the project charter](docs/PROJECT_CHARTER.md) and [template authoring guide](docs/TEMPLATE_AUTHORING.md).
