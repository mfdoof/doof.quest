/*
 * main.js — small enhancements. The site works without this file.
 * Loaded with `defer`, no inline scripts (CSP: script-src 'self').
 */
(() => {
  'use strict';

  const root = document.documentElement;

  /* ---------- 1. Theme toggle ----------------------------------------
   * No saved choice → CSS follows the system setting.
   * Saved choice    → html[data-theme="light|dark"] wins.
   * localStorage can throw (private mode, blocked storage), so wrap it.
   * ------------------------------------------------------------------ */
  const STORAGE_KEY = 'theme';

  const store = {
    get() { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } },
    set(v) { try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ } },
  };

  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');

  const saved = store.get();
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;

  const toggles = document.querySelectorAll('[data-theme-toggle]');

  function updateToggleLabels() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    toggles.forEach((btn) => {
      btn.textContent = `theme:${currentTheme()}`;
      btn.setAttribute('aria-label', `Switch to ${next} theme`);
    });
  }

  toggles.forEach((btn) =>
    btn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      store.set(next);
      updateToggleLabels();
    })
  );

  // keep the label right if the OS theme changes and no choice is saved
  systemDark.addEventListener('change', updateToggleLabels);
  updateToggleLabels();

  /* ---------- 2. Project filter tabs ---------------------------------
   * Tabs are `hidden` in the HTML; we only show them when JS runs.
   * Cards carry data-category="infra|security|tools|writeups".
   * ------------------------------------------------------------------ */
  document.querySelectorAll('[data-filter]').forEach((tabBar) => {
    const section = tabBar.closest('section') || document;
    const cards = section.querySelectorAll('.card[data-category]');
    const tabs = tabBar.querySelectorAll('[data-filter-value]');

    tabBar.hidden = false;

    tabs.forEach((tab) =>
      tab.addEventListener('click', () => {
        const value = tab.dataset.filterValue;

        tabs.forEach((t) => {
          const active = t === tab;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-pressed', String(active));
        });

        cards.forEach((card) => {
          card.hidden = value !== 'all' && card.dataset.category !== value;
        });
      })
    );
  });

  /* ---------- 3. "Last login" = the visitor's current time ----------- */
  const lastLogin = document.querySelector('[data-last-login]');
  if (lastLogin) {
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'short' });
    const mon = now.toLocaleDateString('en-US', { month: 'short' });
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    lastLogin.textContent = `${day} ${mon} ${now.getDate()} ${time}`;
  }
})();
