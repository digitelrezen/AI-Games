// Filename: Leaderboard.js
// Kitty Vs Everything — v1.0.0
// Persistent high-score tracking via localStorage (top 10).

export const VERSION = 'v1.0.0';

const KEY = 'kitty_vs_everything_scores_v1';

export default class Leaderboard {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  submit(name, score) {
    const list = this.load();
    list.push({ name, score, date: new Date().toISOString().slice(0, 10) });
    list.sort((a, b) => b.score - a.score);
    const top = list.slice(0, 10);
    try { localStorage.setItem(KEY, JSON.stringify(top)); } catch (e) { /* storage unavailable */ }
    return top;
  }
  render(el) {
    if (!el) return;
    el.innerHTML = '';
    const list = this.load();
    if (list.length === 0) { el.innerHTML = '<li>No scores yet</li>'; return; }
    list.forEach((s, i) => {
      const li = document.createElement('li');
      li.textContent = `${i + 1}. ${s.name} — ${s.score.toLocaleString()}`;
      el.appendChild(li);
    });
  }
}