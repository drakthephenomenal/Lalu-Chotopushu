// ═══════════════════════════════════════════════════════════════════
//  Stotram Theme Map  — add to your app.js  openStotram / modal code
//  Works with style-stotram-v89-patch.css
// ═══════════════════════════════════════════════════════════════════

const STOTRAM_THEME = {
  // ── Radha-Madhav / Gaudiya  →  warm saffron-gold parchment ──
  hcj: 'radha',   // Shri Hit Chaurasi Ji
  hmg: 'radha',   // Shri Hit Mangal Gaan
  nmb: 'radha',   // Shri Priya o Lal Jur Namavali
  rsn: 'radha',   // Shri Radha Sudha Nidhi
  svb: 'radha',   // Shri Hit Sevak Vani
  blv: 'radha',   // Bayalis Leela
  sfv: 'radha',   // Shriihit Sphut Vani
  rks: 'radha',   // Shri Radha Kripa Kataksha Stavraajah

  // ── Yamuna  →  river-blue slate ──
  yms: 'yamuna',  // Shri Yamunashtak

  // ── Vishnu / Narayan  →  deep lotus-lavender ──
  gms: 'vishnu',  // Gajendra Moksha Stotram
  nkc: 'vishnu',  // Narayan Kavacham
  vs2: 'vishnu',  // Shri Vishnu Shatnam Stotram

  // ── Shiva  →  dusty rose / deep maroon ──
  bss: 'shiva',   // Vedsaar Shiv Stav
  ans: 'shiva',   // Ardhanarishwara Stotram
  rds: 'shiva',   // Rudrashtakam
  sps: 'shiva',   // Shri Shiv Panchakshar Stotram

  // ── Hanuman  →  blazing saffron-ochre ──
  hnc: 'hanuman', // Shri Hanuman Chalisa
};

/**
 * Call this wherever you open / switch the stotram modal.
 *
 * @param {string} stotramId  — e.g. 'hcj', 'yms', 'hnc' …
 */
function applyStotramTheme(stotramId) {
  const card = document.querySelector('.lm-water-card');
  if (!card) return;
  const theme = STOTRAM_THEME[stotramId] || 'radha';
  card.dataset.theme = theme;
}

// ── USAGE EXAMPLE ────────────────────────────────────────────────────
//
//  // In your existing openStotram / showLyrics function:
//  function openStotram(id) {
//    applyStotramTheme(id);      // ← add this line
//    // … rest of your existing code …
//  }
//
// ─────────────────────────────────────────────────────────────────────
