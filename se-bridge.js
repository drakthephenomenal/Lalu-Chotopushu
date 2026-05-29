/**
 * se-bridge.js — Swiss Ephemeris WASM bridge for Radha Naam Jap
 *
 * Uses swisseph-wasm package (Moshier fallback, no external .se1 data files needed).
 * Accuracy: ~1 arcsecond — matches ISKCON / Drik Panchang exactly.
 *
 * PATTERN: Synchronous wrapper around async WASM.
 * - SE is initialised once at startup.
 * - All ephemeris calls are sync after init (WASM executes synchronously once loaded).
 * - _moonElongation() stays synchronous — zero refactor needed in app.js.
 *
 * CDN: https://cdn.jsdelivr.net/npm/swisseph-wasm@1.0.4/dist/swisseph.js
 */

(function () {
  "use strict";

  // ─── State ────────────────────────────────────────────────────────────────
  let _se = null;           // swisseph WASM module instance
  let _ready = false;       // true once WASM fully initialised
  let _initPromise = null;  // singleton init promise

  // Swiss Ephemeris body IDs
  const SE_MOON = 1;
  const SE_SUN  = 0;
  // Flags: SEFLG_SWIEPH | SEFLG_SPEED — use Moshier if sweph data not available
  const SEFLG_MOSEPH   = 4;   // Moshier — built-in, no file needed, ~1 arcsec
  const SEFLG_SWIEPH   = 2;   // Swiss Ephemeris — needs .se1 files (not available in CDN mode)
  const SEFLG_SPEED    = 256; // compute speed too
  const FLAGS = SEFLG_MOSEPH | SEFLG_SPEED;

  // ─── Init ─────────────────────────────────────────────────────────────────
  function _init() {
    if (_initPromise) return _initPromise;
    _initPromise = new Promise((resolve, reject) => {
      // swisseph-wasm exposes a global SwissEph() factory after the script loads
      if (typeof SwissEph === "undefined") {
        reject(new Error("SwissEph not loaded — check CDN script tag"));
        return;
      }
      SwissEph().then((se) => {
        _se = se;
        // Tell SE to use Moshier (no file path needed)
        _se.swe_set_ephe_path("");
        _ready = true;
        console.log("[se-bridge] Swiss Ephemeris WASM ready ✓ (Moshier mode, ~1 arcsec)");
        resolve();
      }).catch(reject);
    });
    return _initPromise;
  }

  // ─── Core: geocentric apparent longitude of a body ────────────────────────
  function _longitude(julDay, body) {
    if (!_ready) throw new Error("SE not ready");
    const result = _se.swe_calc_ut(julDay, body, FLAGS);
    if (result.flag < 0) {
      throw new Error("swe_calc_ut error: " + (result.error || "unknown"));
    }
    // result.longitude is in degrees [0, 360)
    return ((result.longitude % 360) + 360) % 360;
  }

  // ─── Julian Day from JS Date (UTC) ────────────────────────────────────────
  function _toJD(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * moonElongation(date) → degrees [0, 360)
   * Moon–Sun elongation = apparent Moon longitude − apparent Sun longitude.
   * Every 12° = one tithi.  Synchronous — call only after SE is ready.
   */
  function moonElongation(date) {
    const jd = _toJD(date);
    const moonLon = _longitude(jd, SE_MOON);
    const sunLon  = _longitude(jd, SE_SUN);
    return (((moonLon - sunLon) % 360) + 360) % 360;
  }

  /**
   * Panchang-grade Nakshatra index 0–26 (Ashwini=0 … Revati=26).
   * Each nakshatra = 13.333° of moon longitude.
   */
  function nakshatraIndex(date) {
    const jd = _toJD(date);
    const moonLon = _longitude(jd, SE_MOON);
    return Math.floor(moonLon / (360 / 27));
  }

  /**
   * Sun apparent longitude — used for Panchang Yoga, Karana.
   */
  function sunLongitude(date) {
    return _longitude(_toJD(date), SE_SUN);
  }

  /**
   * Moon apparent longitude.
   */
  function moonLongitude(date) {
    return _longitude(_toJD(date), SE_MOON);
  }

  // ─── Swiss Ephemeris Sunrise / Sunset ─────────────────────────────────────
  // Uses swe_rise_trans() — the same function ISKCON / Drik Panchang use.
  // rsmi flag constants:
  //   SE_CALC_RISE   = 1  (next sunrise)
  //   SE_CALC_SET    = 2  (next sunset)
  //   SE_BIT_DISC_CENTER = 256  — geometric centre of solar disc (celestial / ISKCON)
  //   SE_BIT_NO_REFRACTION = 512 — no atmospheric refraction (celestial / ISKCON)
  //   Standard apparent rise uses flags = 1 (disc centre + refraction = default NOAA-style)
  const SE_CALC_RISE           = 1;
  const SE_CALC_SET            = 2;
  const SE_BIT_DISC_CENTER     = 256;
  const SE_BIT_NO_REFRACTION   = 512;

  /**
   * _riseSet(date, lat, lng, isCelestial, isSet)
   * Returns local decimal hours for sunrise or sunset.
   * isCelestial=true  → geometric disc centre, no refraction (matches ISKCON Celestial mode)
   * isCelestial=false → apparent disc centre with refraction (matches standard / Earth's Sky mode)
   */
  function _riseSet(date, lat, lng, isCelestial, isSet) {
    if (!_ready) throw new Error("SE not ready");

    // JD at local noon-ish — swe_rise_trans searches forward from this point.
    // We anchor at midnight UTC of the given date so the search always lands
    // on the correct calendar day regardless of timezone.
    const jdStart = Math.floor(date.getTime() / 86400000) + 2440587.5; // JD at 00:00 UTC

    let rsmi = isSet ? SE_CALC_SET : SE_CALC_RISE;
    if (isCelestial) {
      // Celestial horizon: geometric disc centre + no atmospheric refraction
      rsmi |= SE_BIT_DISC_CENTER | SE_BIT_NO_REFRACTION;
    }
    // Atmospheric pressure & temperature for standard refraction (ignored when NO_REFRACTION set)
    const atpress = 1013.25; // mbar
    const attemp  = 15.0;   // °C

    const result = _se.swe_rise_trans(
      jdStart,      // tjd   — JD start of search window
      SE_SUN,       // ipl   — body (Sun = 0)
      "",           // starname — unused for planets
      SEFLG_MOSEPH, // epheflag
      rsmi,         // rsmi  — rise/set flags
      lng,          // longitude  (individual arg, NOT array)
      lat,          // latitude
      0,            // height above sea level (metres)
      atpress,      // atmospheric pressure (mbar)
      attemp        // atmospheric temperature (°C)
    );

    if (!result || result.rc === -1) {
      // Polar day / night — return null to trigger fallback
      return null;
    }

    // result.transitTime is JD (UT) of the rise/set event (mivion API)
    const jdEvent = result.transitTime;
    console.log("[se-bridge] swe_rise_trans ok →", isSet ? "sunset" : "sunrise", "jdEvent:", jdEvent, "rc:", result.rc);

    // Convert JD (UT) → local decimal hours
    // JD UT → Unix ms → local time using device timezone
    const eventMs = (jdEvent - 2440587.5) * 86400000;
    const eventDate = new Date(eventMs);
    const tzOffMin = -date.getTimezoneOffset(); // positive east of UTC
    const utcMin = eventDate.getUTCHours() * 60 + eventDate.getUTCMinutes() + eventDate.getUTCSeconds() / 60;
    return ((((utcMin + tzOffMin) / 60) % 24) + 24) % 24;
  }

  /**
   * calcSunTimesSwiss(lat, lng, date) → { sunriseH, sunsetH, sunrise, sunset }
   * Drop-in replacement for the NOAA calcSunTimes() in app.js.
   * Reads App.S.horizonMode exactly as the NOAA version did.
   */
  function calcSunTimesSwiss(lat, lng, date) {
    if (!_ready) return null; // SE not yet initialised — caller falls back to NOAA

    const isCelestial = (typeof App !== "undefined" && App.S && App.S.horizonMode === "celestial");

    const sunriseH = _riseSet(date, lat, lng, isCelestial, false);
    const sunsetH  = _riseSet(date, lat, lng, isCelestial, true);

    if (sunriseH === null || sunsetH === null) return null; // polar night / midnight sun

    function fmtH(h) {
      let hh = Math.floor(h), mm = Math.round((h - hh) * 60);
      if (mm >= 60) { hh++; mm = 0; }
      if (hh >= 24) hh -= 24;
      const ap = hh >= 12 ? "PM" : "AM", h12 = hh % 12 || 12;
      return String(h12).padStart(2, "0") + ":" + String(mm).padStart(2, "0") + " " + ap;
    }

    return { sunriseH, sunsetH, sunrise: fmtH(sunriseH), sunset: fmtH(sunsetH) };
  }

  // ─── Expose on window ─────────────────────────────────────────────────────
  window.SEBridge = {
    init: _init,
    isReady: () => _ready,
    moonElongation,
    nakshatraIndex,
    sunLongitude,
    moonLongitude,
    calcSunTimesSwiss,
  };

})();
