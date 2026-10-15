# doof.quest

Source for my sysadmin/security portfolio at https://doof.quest: projects, homelab write-ups and my resume.

Plain HTML, CSS and JS. No framework or static site generator.

## Layout

```
content/content.json   cards, notes, certs and bio (edit this)
content/svg/           inline SVGs for project cards
build.js               fills the pages from content.json and checks for leaks
site/                  the published site
```

## Build and preview

```
node build.js
npx serve site        # http://localhost:3000
```

`build.js` fills `<!-- build:NAME -->` markers in `site/`, validates the data, and fails if a private IP address shows up in any page. Its output is committed.

## Deploy

Cloudflare Pages serves `site/` straight from `main`, with no build command, so the live site matches what's in the repo. Security headers are in `site/_headers`.

A mirror on my homelab is planned.
