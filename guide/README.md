# The Snowpace guide

The help guide at <https://snowpace.com/guide/>. These files are its source; the pages people
read are built from them, and from the app itself, every time the website is published.

- `pages/` — one Markdown file per page. Edit the words here.
- `contents.json` — the sections and the order of the pages. A new page goes in here too.
- `troubleshooter.json` — the troubleshooter's questions and answers.
- `diagrams/` — the diagrams, as SVG.
- `template.html` and `assets/` — the page shell, styles and search.

## Writing a page

Each page starts with a title and a one-line description:

```markdown
---
title: No webcam, or the wrong one
description: Why a place shows no camera or the wrong view, and how to choose a different one.
---
```

Then plain Markdown. For anything the app already knows, use a placeholder rather than typing it,
so the guide changes when the app does:

- a button or label: `**{{ui.why.show}}**` → **Why?**
- a number: `{{policy.forecastStaleHours}}` → 3
- the contact address: `{{contact.email}}`

Link to other pages as `/guide/page-name/`, or to part of one as `/guide/page-name/#a-heading`.

## Checking your work

```
npm run build-guide
```

It stops with a message if a placeholder, a link or a page is wrong. It also runs before every
publish, so a mistake never reaches the website: the site just stays as it was. More in
CLAUDE.md, under Guide.
