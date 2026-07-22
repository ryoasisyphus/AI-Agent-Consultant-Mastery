# Template authoring

A template supplies domain knowledge while the Learning OS application supplies the interface, local progress model, calendar, XP, and review loop.

## Create a new template

1. Copy `templates/ai-consultant` to `templates/<your-domain>`.
2. Update the `id`, name, tagline, skills, and missions in `template.json`.
3. Make each mission small enough to be useful in one focused sitting (usually 10–20 minutes).
4. Add prerequisites only when failing to learn them first would genuinely make the mission incomprehensible.
5. Include the source title, page range, and reading depth if a copyrighted source is privately available to the learner. Do not commit the source itself without distribution rights.
6. Change the template path in `app.js` when the new template becomes the active project.

## Mission schema

```json
{
  "id": "stable-domain-id",
  "type": "main | side | debug | challenge",
  "title": "Outcome-oriented title",
  "summary": "What the learner will decide, explain, or make.",
  "minutes": 15,
  "xp": 120,
  "skills": ["skill-id"],
  "reading": { "label": "Source section", "pages": "12–18", "depth": "Essential" },
  "prerequisites": []
}
```

## Reading depths

- **Essential** — read before applying the concept.
- **Deep read** — build durable judgement and reusable mental models.
- **Recommended** — broadens context after the mission.
- **Explore** — optional discovery for a current interest or work need.
