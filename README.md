# Editing this site

All the text that changes per-persona or per-country lives in `content/*.md`.
Editing those files is all you need to do — `index.html` and `assets/site.js`
read them at page-load and never need to change for a content edit.

```
index.html
assets/site.js
content/
  personas/
    general.md
    recruiter.md
    techlead.md
    founder.md
  countries/
    DE.md
    SA.md
    PK.md
    US.md
    GB.md
    default.md   <- shown for any country without its own file
```

## Editing a persona (`content/personas/*.md`)

Each file has two parts: a frontmatter block at the top (`--- ... ---`) and a
body below it.

```markdown
---
tagline: One-line subtitle shown under the name
chatSubtitle: One-line subtitle shown above the chat box
note: Optional highlight callout shown under the persona tabs (leave blank to hide it)
---

## Skills
Comma, separated, list, of, skill, tags

## Experience

### Company — Job Title
Date range
- Bullet point
- Another bullet point

### Another Company — Job Title
Date range
- Bullet point

## Projects

### Project Name
Description text, can include [links](https://example.com).
```

- **Skills** must stay a single comma-separated line.
- **Experience** entries start with `### `, then a date line, then `- ` bullets.
  A job can have zero bullets if you just want the title/date to show.
- **Projects** is optional — if you leave it empty, the whole "Projects"
  heading disappears from the page for that persona.
- Leave `note:` empty to hide the highlight card for that persona.

### Adding a brand-new persona (e.g. "Client")

1. Create `content/personas/client.md` following the format above.
2. In `assets/site.js`, add `"client"` to the `PERSONA_KEYS` array near the top.
3. In `index.html`, add a matching chip inside `#viewerTabs`:
   `<button type="button" class="chip" data-persona="client">Client</button>`

## Editing country visa info (`content/countries/*.md`)

The page detects a visitor's country automatically (via IP lookup) and shows
the matching file. Filename = ISO 3166-1 alpha-2 country code, e.g. `DE.md`,
`US.md`, `PK.md`, `GB.md`.

```markdown
---
heading: Hiring from Germany
---
Whatever text/markdown you want shown to a visitor from that country.
```

If there's no file for a visitor's country, `content/countries/default.md`
is shown instead — keep that one general enough to apply to anyone.

The visa box is only shown for the "General" and "Recruiter" persona views
(same behaviour as before). To change which personas see it, edit the
`updateVisaBoxVisibility` function in `assets/site.js`.

**Note on the country detection:** it uses the visitor's IP address as a
proxy for "which country is this hiring opportunity likely based in" — it's
a heuristic, not a guarantee (VPNs, corporate networks, etc. can throw it
off), and if the lookup fails or is blocked it silently falls back to
`default.md`.

## What's still static (not in markdown)

Name, LinkedIn link, Education, and the "Download PDF" button are the same
for every persona, so they're left directly in `index.html`. If you want
those editable too, they could be pulled into a `content/base.md` the same
way — ask if you'd like that added.
