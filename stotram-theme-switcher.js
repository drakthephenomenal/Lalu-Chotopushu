/* ════════════════════════════════════════════════════════════
   stotram-theme-switcher.js
   Injects a 3-button theme picker (Aurora / Glass / Beam) into
   the stotram modal (.lmo) and persists the choice in
   localStorage. Apply the picked theme as data-stotram-theme
   on the .lmo element.
   Drop into your HTML AFTER stotrams.js:
     <script src="stotram-theme-switcher.js" defer></script>
   Works with the all-in-one style-stotram.css.
   ════════════════════════════════════════════════════════════ */
(function () {
  var THEMES = [
    { id: 'aurora', label: 'Aurora' },
    { id: 'glass',  label: 'Glass'  },
    { id: 'beam',   label: 'Beam'   }
  ];
  var STORAGE_KEY = 'stotram-theme';
  var DEFAULT = 'aurora';

  function getSaved() {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT; }
    catch (e) { return DEFAULT; }
  }
  function save(t) { try { localStorage.setItem(STORAGE_KEY, t); } catch (e) {} }

  function applyTheme(lmo, theme) {
    if (!lmo) return;
    lmo.setAttribute('data-stotram-theme', theme);
    var picker = lmo.querySelector('.lmo-theme-picker');
    if (picker) {
      picker.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('active', b.dataset.theme === theme);
      });
    }
  }

  function buildPicker(lmo) {
    if (lmo.querySelector('.lmo-theme-picker')) return;
    var wrap = document.createElement('div');
    wrap.className = 'lmo-theme-picker';
    THEMES.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.theme = t.id;
      b.textContent = t.label;
      b.addEventListener('click', function () {
        applyTheme(lmo, t.id);
        save(t.id);
      });
      wrap.appendChild(b);
    });
    lmo.appendChild(wrap);
  }

  function init() {
    var lmo = document.getElementById('lmo') || document.querySelector('.lmo');
    if (!lmo) return false;
    buildPicker(lmo);
    applyTheme(lmo, getSaved());
    return true;
  }

  // Try immediately, then observe DOM for late mount
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  if (!init()) {
    var mo = new MutationObserver(function () {
      if (init()) mo.disconnect();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
