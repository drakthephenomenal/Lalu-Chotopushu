/* native-online-media.js
   Android app only (no effect on the website): photos that are NOT packed into the app are
   loaded live from the website instead. Works when the app is open and online. */
(function () {
  try {
    var native = false;
    try { native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) {}
    if (!native) native = (location.protocol === 'https:' && location.hostname === 'localhost' && !location.port && /Android/i.test(navigator.userAgent));
    if (!native) return;
    var BASE = 'https://radharadharadha.vercel.app/';
    var RE = /^(?:\.\/)?((?:(?:sampraday|gurudev|hitju_maharaj|radha_vallabh|rashikan)|(?:iskcon|ramanuj|vallabh|nimbark|ramanandi|haridashi|gopeshwar)_[a-z_]+)\/.+|bhagavadik-bank\.png(?:\?.*)?)$/i;
    function fix(u) {
      if (typeof u !== 'string' || !u) return u;
      var p = u, o = location.origin + '/';
      if (p.indexOf(o) === 0) p = p.slice(o.length);
      var m = RE.exec(p);
      return m ? BASE + m[1] : u;
    }
    var d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (d && d.set) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: true, enumerable: d.enumerable, get: d.get,
        set: function (v) { d.set.call(this, fix(v)); }
      });
    }
    var sa = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (n, v) {
      if (this instanceof HTMLImageElement && String(n).toLowerCase() === 'src') v = fix(v);
      return sa.call(this, n, v);
    };
    function fixEl(el) {
      if (!el || el.nodeType !== 1) return;
      if (el.tagName === 'IMG') {
        var s = el.getAttribute('src'), n = fix(s);
        if (n !== s) sa.call(el, 'src', n);
      }
      if (el.querySelectorAll) {
        var l = el.querySelectorAll('img');
        for (var i = 0; i < l.length; i++) {
          var s2 = l[i].getAttribute('src'), n2 = fix(s2);
          if (n2 !== s2) sa.call(l[i], 'src', n2);
        }
      }
    }
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'attributes') fixEl(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) fixEl(m.addedNodes[j]);
      }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    document.addEventListener('DOMContentLoaded', function () { fixEl(document.documentElement); });
  } catch (e) {}
})();
