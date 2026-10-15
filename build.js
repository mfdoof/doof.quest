#!/usr/bin/env node
/*
 * build.js — fills marker blocks in site/*.html with data from content/content.json
 *
 * Usage:   node build.js
 * Markers: <!-- build:NAME --> ... <!-- /build:NAME -->
 *          Everything between a pair is replaced on every run. Everything
 *          outside is hand-written and never touched.
 *
 * No dependencies — Node built-ins only.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const CONTENT_FILE = path.join(ROOT, 'content', 'content.json');
const SITE_DIR = path.join(ROOT, 'site');

const CATEGORIES = ['infra', 'security', 'tools', 'writeups'];

/* =========================================================================
 * 1. Helpers (done)
 * ========================================================================= */

/** Escape text before it goes into HTML. Use on EVERY value from the JSON. */
function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Stop the build with a clear message and a non-zero exit code. */
function fail(message) {
  console.error(`build: ERROR — ${message}`);
  process.exit(1);
}

/* =========================================================================
 * 2. Security: RFC 1918 leak check (done)
 *    Refuses to build if any private IPv4 address appears in the content.
 *    10.0.0.0/8 · 172.16.0.0/12 · 192.168.0.0/16
 * ========================================================================= */

const RFC1918 = [
  /\b10\.(?:\d{1,3}\.){2}\d{1,3}\b/,
  /\b172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/,
  /\b192\.168\.\d{1,3}\.\d{1,3}\b/,
];

function leakCheck(text, where) {
  for (const re of RFC1918) {
    const hit = text.match(re);
    if (hit) fail(`private IP "${hit[0]}" found in ${where}. Scrub it before building.`);
  }
}

/* =========================================================================
 * 3. Load + validate
 * ========================================================================= */

function loadContent() {
  let raw;
  try {
    raw = fs.readFileSync(CONTENT_FILE, 'utf8');
  } catch {
    fail(`cannot read ${CONTENT_FILE}`);
  }
  leakCheck(raw, 'content.json');
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`content.json is not valid JSON: ${err.message}`);
  }
}

/**
 * Check the data before rendering.
 * Ideas:
 *  - every project has slug, title, category, date, blurb, link
 *  - category is one of CATEGORIES
 *  - date matches YYYY-MM-DD
 *  - no duplicate slugs
 * Call fail('...') on the first problem.
 */
function validate(content) {
  // 1. top-level sections exist
  const sections = ['site', 'stack', 'projects', 'notes', 'about', 'certs'];
  for (const key of sections) {
    if (!(key in content)) fail(`content.json is missing "${key}"`);
  }

  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const seen = new Set();

  for (const p of content.projects) {
    const name = p.slug || p.title || '(unnamed project)';

    // 2. required fields
    for (const field of ['slug', 'title', 'category', 'date', 'blurb', 'link']) {
      if (!p[field]) fail(`project "${name}": missing "${field}"`);
    }

    // 3. known category
    if (!CATEGORIES.includes(p.category)) {
      fail(`project "${name}": unknown category "${p.category}" (use: ${CATEGORIES.join(', ')})`);
    }

    // 4. date format
    if (!DATE.test(p.date)) fail(`project "${name}": bad date "${p.date}" (use YYYY-MM-DD)`);

    // 5. unique slug
    if (seen.has(p.slug)) fail(`duplicate project slug "${p.slug}"`);
    seen.add(p.slug);
  }

  // notes need the same basics
  for (const n of content.notes) {
    for (const field of ['slug', 'title', 'tag', 'date']) {
      if (!n[field]) fail(`note "${n.slug || n.title}": missing "${field}"`);
    }
    if (!DATE.test(n.date)) fail(`note "${n.slug}": bad date "${n.date}" (use YYYY-MM-DD)`);
  }
}

/* =========================================================================
 * 4. Renderers — each returns an HTML string
 *    Example done for you: renderStack. Use it as the pattern.
 * ========================================================================= */

function renderStack(stack) {
  return stack
    .map(
      (item) => `
<div class="stack-item">
  <div class="label">${esc(item.label)}</div>
  <div class="value">${esc(item.value)}</div>
</div>`
    )
    .join('');
}

/**
 * One project card. Match the classes in style.css:
 * article.card[data-category] > .card-media, .card-body > .card-meta, h3, p,
 * .card-stack, a.card-link
 */
function renderCard(project) {
  const p = project;
  const href = p.link.href;
  const external = href.startsWith('http');

  // image if we have one, otherwise a text placeholder
  // inline SVG (trusted file in content/svg/, themed by .d-* classes),
  // then image, otherwise a text placeholder
  let media;
  if (p.svg) {
    const file = path.join(ROOT, 'content', 'svg', path.basename(p.svg));
    if (!fs.existsSync(file)) fail(`svg "${p.svg}" for ${p.slug} not found in content/svg/`);
    media = fs.readFileSync(file, 'utf8').trim();
    leakCheck(media, file);
  } else if (p.image) {
    media = `<img src="${esc(p.image)}" alt="${esc(p.imageAlt || p.title)}" loading="lazy">`;
  } else {
    media = `[ ${esc(p.imageAlt || 'image')} ]`;
  }

  const stack = p.stack && p.stack.length
    ? `\n    <div class="card-stack">${p.stack.map(esc).join(' · ')}</div>`
    : '';

  return `
<article class="card" data-category="${esc(p.category)}">
  <div class="card-media${p.svg ? ' card-media--svg' : ''}">${media}</div>
  <div class="card-body">
    <div class="card-meta">${esc(p.perms || '')} · #${esc(p.category)} · ${esc(p.date)}</div>
    <h3><a href="${esc(href)}"${external ? ' rel="noopener"' : ''}>${esc(p.title)}/</a></h3>
    <p>${esc(p.blurb)}</p>${stack}
    <a class="card-link" href="${esc(href)}"${external ? ' rel="noopener"' : ''}>${esc(p.link.label)} →</a>
  </div>
</article>`;
}

/** One <li> in .note-list (★ if pinned). */
function renderNote(note) {
  const pinned = note.pinned ? ' class="pinned"' : '';
  return `
<li>
  <a href="/notes/${esc(note.slug)}.html"${pinned}>${esc(note.title)}</a>
  <span class="note-meta">#${esc(note.tag)} · ${esc(note.date)}</span>
</li>`;
}

/** One <li> in .cert-list (class "done" if finished). */
function renderCert(cert) {
  const done = cert.status === 'done';
  const label = done ? 'earned' : 'in progress';
  return `
<li${done ? ' class="done"' : ''}>${esc(cert.name)} — ${label}</li>`;
}

/* =========================================================================
 * 5. Marker replacement (done)
 * ========================================================================= */

function fillMarker(html, name, inner, file) {
  const re = new RegExp(`(<!-- build:${name} -->)[\\s\\S]*?(<!-- /build:${name} -->)`, 'g');
  if (!re.test(html)) {
    return { html, found: false };
  }
  re.lastIndex = 0;
  // function form so "$" in content isn't treated as a regex backreference
  return { html: html.replace(re, (_, open, close) => `${open}${inner}\n${close}`), found: true };
}

function buildFile(relPath, blocks) {
  const file = path.join(SITE_DIR, relPath);
  let html = fs.readFileSync(file, 'utf8');
  const filled = [];

  for (const [name, inner] of Object.entries(blocks)) {
    leakCheck(inner, `${relPath} → ${name}`);
    const result = fillMarker(html, name, inner, relPath);
    html = result.html;
    if (result.found) filled.push(name);
  }

  fs.writeFileSync(file, html);
  console.log(`build: ${relPath} — ${filled.length ? filled.join(', ') : 'no markers yet'}`);
}

/* =========================================================================
 * 6. Main — which blocks go into which page
 * ========================================================================= */

function main() {
  const content = loadContent();
  validate(content);

  const { site, stack, projects, notes, about, certs } = content;

  // newest first; pinned notes on top
  const byDate = (a, b) => b.date.localeCompare(a.date);
  const sortedProjects = [...projects].sort(byDate);
  const sortedNotes = [...notes].sort((a, b) => (b.pinned === true) - (a.pinned === true) || byDate(a, b));

  const shared = {
    'note-count': `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`,
    'footer-links': [
      `<a href="mailto:${esc(site.links.email)}">mail</a>`,
      `<a href="${esc(site.links.github)}" rel="noopener">github</a>`,
      `<a href="${esc(site.links.linkedin)}" rel="noopener">linkedin</a>`,
    ].join('\n'),
  };

  buildFile('index.html', {
    ...shared,
    motd: esc(site.motd),
    headline: esc(site.headline),
    lead: esc(site.lead),
    stack: renderStack(stack),
    projects: sortedProjects.map(renderCard).join(''),
    notes: sortedNotes.slice(0, 5).map(renderNote).join(''),
    about: about.map((p) => `\n<p>${esc(p)}</p>`).join(''),
    certs: certs.map(renderCert).join(''),
  });

  for (const page of ['projects/doof-homelab.html', 'projects/password-manager.html', 'projects/net-health-monitor.html', 'notes/console-outage.html', 'notes/_template.html']) {
    buildFile(page, shared);
  }

  buildFile('projects/index.html', {
    ...shared,
    projects: sortedProjects.map(renderCard).join(''),
  });

  buildFile('notes/index.html', {
    ...shared,
    notes: sortedNotes.map(renderNote).join(''),
  });

  buildFile('about.html', {
    ...shared,
    about: about.map((p) => `\n<p>${esc(p)}</p>`).join(''),
    certs: certs.map(renderCert).join(''),
  });

  console.log('build: done');
}

main();
