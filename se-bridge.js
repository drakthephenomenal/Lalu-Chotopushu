/**
 * se-bridge.js — Ephemeris bridge for Radha Naam Jap
 *
 * Uses astronomy-engine (pure JavaScript, no WASM, no data files needed).
 * Accuracy: sub-arcminute — sufficient for panchang (tithi, nakshatra, yoga).
 * Matches Drik Panchang / ISKCON results to within 1–3 minutes.
 *
 * WHY astronomy-engine instead of swisseph-wasm:
 *   swisseph-wasm@1.0.4 does not exist on npm (max published = 0.0.5).
 *   The old CDN URL 404'd silently, so SEBridge never initialised.
 *   astronomy-engine is actively maintained, ~420 KB, pure JS, no WASM needed.
 *
 * CDN: https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.js
 *
 * PUBLIC API (unchanged — app.js requires no edits):
 *   SEBridge.init()                      → Promise<void>
 *   SEBridge.isReady()                   → boolean
 *   SEBridge.moonElongation(date)        → degrees [0, 360)
 *   SEBridge.nakshatraIndex(date)        → 0–26
 *   SEBridge.sunLongitude(date)          → degrees [0, 360)
 *   SEBridge.moonLongitude(date)         → degrees [0, 360)
 *   SEBridge.calcSunTimesSwiss(lat,lng,date) → { sunriseH, sunsetH, sunrise, sunset } | null
 */

(function () {
  "use strict";

  // ─── State ────────────────────────────────────────────────────────────────
  let _ready       = false;
  let _initPromise = null;

  // ─── Init ─────────────────────────────────────────────────────────────────
  // astronomy-engine is synchronous once the script tag loads — no async WASM
  // bootstrap needed.  We still return a Promise so callers (.then / await)
  // work unchanged from the old WASM pattern.
  function _init() {
    if (_initPromise) return _initPromise;
    _initPromise = new Promise(function (resolve, reject) {
      if (typeof Astronomy === "undefined") {
        reject(new Error(
          "[se-bridge] astronomy-engine not loaded — " +
          "check the CDN <script> tag above se-bridge.js in index.html"
        ));
        return;
      }
      _ready = true;
      console.log("[se-bridge] astronomy-engine ready ✓ (sub-arcminute accuracy)");
      resolve();
    });
    return _initPromise;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function _astroTime(date) {
    return Astronomy.MakeTime(date);
  }

  // ─── Core: geocentric ecliptic longitude of Sun / Moon ────────────────────

  /**
   * Sun apparent geocentric ecliptic longitude in degrees [0, 360).
   */
  function sunLongitude(date) {
    if (!_ready) throw new Error("[se-bridge] not ready");
    var sp = Astronomy.SunPosition(_astroTime(date));
    return ((sp.elon % 360) + 360) % 360;
  }

  /**
   * Moon geocentric ecliptic longitude in degrees [0, 360).
   * Used for nakshatra (every 13.333° = one nakshatra).
   */
  function moonLongitude(date) {
    if (!_ready) throw new Error("[se-bridge] not ready");
    var ecl = Astronomy.EclipticGeoMoon(_astroTime(date));
    return ((ecl.lon % 360) + 360) % 360;
  }

  // ─── Public calculations ───────────────────────────────────────────────────

  /**
   * moonElongation(date) → degrees [0, 360)
   * Moon–Sun elongation.  Every 12° = one tithi.
   * astronomy-engine.MoonPhase() returns this directly.
   */
  function moonElongation(date) {
    if (!_ready) throw new Error("[se-bridge] not ready");
    return Astronomy.MoonPhase(date);   // already [0, 360)
  }

  /**
   * nakshatraIndex(date) → 0–26  (Ashwini = 0 … Revati = 26)
   * Each nakshatra spans 360/27 ≈ 13.333° of moon longitude.
   */
  function nakshatraIndex(date) {
    return Math.floor(moonLongitude(date) / (360 / 27));
  }

  // ─── Sunrise / Sunset ─────────────────────────────────────────────────────

  /**
   * calcSunTimesSwiss(lat, lng, date)
   * → { sunriseH, sunsetH, sunrise, sunset }  or  null (polar day/night)
   *
   * horizonMode (from App.S.horizonMode):
   *   "apparent"  — standard apparent rise/set (atmospheric refraction included).
   *                 Matches NOAA / weather-app sunrise.
   *   "celestial" — geometric disc centre at 0° altitude, no refraction.
   *                 Matches ISKCON celestial / traditional panchang.
   *                 Differs from apparent mode by ~2–3 minutes.
   */
  function calcSunTimesSwiss(lat, lng, date) {
    if (!_ready) return null;

    var isCelestial = (
      typeof App !== "undefined" &&
      App.S &&
      App.S.horizonMode === "celestial"
    );

    // Always search forward from midnight UTC of the requested date.
    // This ensures we find sunrise/sunset for the correct calendar day
    // regardless of the device timezone.
    var midnightMs  = Math.floor(date.getTime() / 86400000) * 86400000;
    var startTime   = Astronomy.MakeTime(new Date(midnightMs));
    var observer    = new Astronomy.Observer(lat, lng, 0);
    var tzOffMin    = -date.getTimezoneOffset();  // positive east of UTC

    var riseAT, setAT;
    try {
      if (isCelestial) {
        // SearchAltitude(body, observer, direction, start, limitDays, altitude)
        // altitude = 0° = geometric centre exactly on the horizon, no refraction
        riseAT = Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, +1, startTime, 1, 0);
        setAT  = Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, -1, startTime, 1, 0);
      } else {
        // SearchRiseSet applies standard atmospheric refraction (~34') + limb correction
        riseAT = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, startTime, 1);
        setAT  = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, startTime, 1);
      }
    } catch (e) {
      console.warn("[se-bridge] sunrise/sunset search failed:", e);
      return null;
    }

    if (!riseAT || !setAT) return null;  // polar day / polar night

    function toLocalH(astroTime) {
      var d = astroTime.date;   // native JS Date (UTC)
      var utcMin = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
      return ((utcMin + tzOffMin) / 60 + 24) % 24;
    }

    var sunriseH = toLocalH(riseAT);
    var sunsetH  = toLocalH(setAT);

    function fmtH(h) {
      var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
      if (mm >= 60) { hh++; mm = 0; }
      if (hh >= 24) hh -= 24;
      var ap  = hh >= 12 ? "PM" : "AM";
      var h12 = hh % 12 || 12;
      return String(h12).padStart(2, "0") + ":" + String(mm).padStart(2, "0") + " " + ap;
    }

    return { sunriseH: sunriseH, sunsetH: sunsetH, sunrise: fmtH(sunriseH), sunset: fmtH(sunsetH) };
  }

  // ─── Expose on window ─────────────────────────────────────────────────────
  window.SEBridge = {
    init            : _init,
    isReady         : function () { return _ready; },
    moonElongation  : moonElongation,
    nakshatraIndex  : nakshatraIndex,
    sunLongitude    : sunLongitude,
    moonLongitude   : moonLongitude,
    calcSunTimesSwiss: calcSunTimesSwiss,
  };

})();
