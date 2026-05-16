// ═══════════════════════════════════════════════════════════════════
//  panchangData.js  —  Panchang Daily Data Module
//  Computes: Tithi (name + end time), Nakshatra, Yoga, Karana,
//            Month name (standard + Gaudiya Vaishnava)
//  Requires: calcSunTimes() already defined in app.js
//  Usage:    const p = await getPanchangData(lat, lng, date);
// ═══════════════════════════════════════════════════════════════════

// ── Ayanamsha (Lahiri) ── degrees to subtract from tropical longitude
// to get sidereal (nirayana) longitude. Approx formula, accurate ~0.1°
function _ayanamsha(T) {
  // Lahiri ayanamsha — standard for Indian Panchang
  return 23.85 + (T + 0.31) * 0.013979;
}

// ── Core: Sun & Moon tropical longitudes ──────────────────────────
function _sunMoonLongitudes(date) {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T  = (JD - 2451545.0) / 36525.0;
  const r  = Math.PI / 180;

  // Sun
  const L0 = ((280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360 + 360) % 360;
  const M  = ((357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360 + 360) % 360;
  const Mr = M * r;
  const C  = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
           + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
           +  0.000289 * Math.sin(3 * Mr);
  const sunTrop = ((L0 + C) % 360 + 360) % 360;

  // Moon
  const Lm = ((218.3164477 + 481267.88123421 * T - 0.0015786 * T * T) % 360 + 360) % 360;
  const Mm = ((134.9633964 + 477198.8675055  * T + 0.0087414 * T * T) % 360 + 360) % 360;
  const F  = (( 93.2720950 + 483202.0175233  * T - 0.0036539 * T * T) % 360 + 360) % 360;
  const D  = ((297.8501921 + 445267.1114034  * T - 0.0018819 * T * T) % 360 + 360) % 360;
  const Mmr = Mm * r, Fr = F * r, Dr = D * r;
  const moonTrop = ((Lm
    + 6.289  * Math.sin(Mmr)
    - 1.274  * Math.sin(2 * Dr - Mmr)
    + 0.658  * Math.sin(2 * Dr)
    - 0.214  * Math.sin(2 * Mmr)
    + 0.059  * Math.sin(2 * Dr - 2 * Mmr + Mmr)
    - 0.057  * Math.sin(2 * Dr - Mr - Mmr)
    + 0.053  * Math.sin(2 * Dr + Mmr)
    + 0.046  * Math.sin(2 * Dr - Mr)
    + 0.041  * Math.sin(Mmr - Mr)
    - 0.034  * Math.sin(Dr)
    + 0.030  * Math.sin(2 * Mmr - Mr)
    - 0.024  * Math.sin(2 * (Dr - Mmr))
    + 0.018  * Math.sin(2 * Dr - 2 * Fr - Mmr)
  ) % 360 + 360) % 360;

  const ayan = _ayanamsha(T);
  return {
    sunSid:  ((sunTrop  - ayan) % 360 + 360) % 360,  // sidereal Sun longitude
    moonSid: ((moonTrop - ayan) % 360 + 360) % 360,  // sidereal Moon longitude
    sunTrop, moonTrop, T
  };
}

// ── Binary search: find when a value crosses a boundary ──────────
function _binarySearch(fn, target, lo, hi, mod) {
  // fn(date) returns the value; find when it crosses `target` in [lo,hi]
  // mod = wrapping modulus (360 or 720 etc.) or 0 for no wrap
  for (let i = 0; i < 52; i++) {
    const mid = new Date((lo.getTime() + hi.getTime()) / 2);
    const v = fn(mid);
    const diff = mod ? ((v - target + mod) % mod) : (v - target);
    if (diff < (mod ? mod / 2 : 0)) hi = mid; else lo = mid;
    if (hi.getTime() - lo.getTime() < 10000) break; // ~10s precision
  }
  return new Date((lo.getTime() + hi.getTime()) / 2);
}

// ── Format a Date to local HH:MM:SS ──────────────────────────────
function _fmt(d) {
  return String(d.getHours()).padStart(2,'0') + ':' +
         String(d.getMinutes()).padStart(2,'0') + ':' +
         String(d.getSeconds()).padStart(2,'0');
}
function _fmtHHMM(d) {
  return String(d.getHours()).padStart(2,'0') + ':' +
         String(d.getMinutes()).padStart(2,'0');
}

// ═══════════════════════════════════════════════════════════════════
//  LOOKUP TABLES
// ═══════════════════════════════════════════════════════════════════

// Tithi names (1–30). 1–15 = Shukla, 16–30 = Krishna
// 15 = Purnima, 30 = Amavasya
const _TITHI_NAMES = [
  '',                                          // 0 unused
  'Pratipada','Dwitiya','Tritiya',             // 1–3
  'Chaturthi','Panchami','Shashthi',           // 4–6
  'Saptami','Ashtami','Navami',                // 7–9
  'Dashami','Ekadashi','Dwadashi',             // 10–12
  'Trayodashi','Chaturdashi','Purnima',        // 13–15
  'Pratipada','Dwitiya','Tritiya',             // 16–18 (Krishna)
  'Chaturthi','Panchami','Shashthi',           // 19–21
  'Saptami','Ashtami','Navami',                // 22–24
  'Dashami','Ekadashi','Dwadashi',             // 25–27
  'Trayodashi','Chaturdashi','Amavasya'        // 28–30
];

// Bengali names for tithis
const _TITHI_BN = [
  '',
  'প্রতিপদা','দ্বিতীয়া','তৃতীয়া',
  'চতুর্থী','পঞ্চমী','ষষ্ঠী',
  'সপ্তমী','অষ্টমী','নবমী',
  'দশমী','একাদশী','দ্বাদশী',
  'ত্রয়োদশী','চতুর্দশী','পূর্ণিমা',
  'প্রতিপদা','দ্বিতীয়া','তৃতীয়া',
  'চতুর্থী','পঞ্চমী','ষষ্ঠী',
  'সপ্তমী','অষ্টমী','নবমী',
  'দশমী','একাদশী','দ্বাদশী',
  'ত্রয়োদশী','চতুর্দশী','অমাবস্যা'
];

// 27 Nakshatras (Moon's sidereal longitude / 13.333°)
const _NAKSHATRA = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra',
  'Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni',
  'Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha',
  'Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha',
  'Purva Bhadrapada','Uttara Bhadrapada','Revati'
];

const _NAKSHATRA_BN = [
  'অশ্বিনী','ভরণী','কৃত্তিকা','রোহিণী','মৃগশিরা','আর্দ্রা',
  'পুনর্বসু','পুষ্যা','আশ্লেষা','মঘা','পূর্ব ফাল্গুনী','উত্তর ফাল্গুনী',
  'হস্তা','চিত্রা','স্বাতী','বিশাখা','অনুরাধা','জ্যেষ্ঠা',
  'মূলা','পূর্ব আষাঢ়া','উত্তর আষাঢ়া','শ্রবণা','ধনিষ্ঠা','শতভিষা',
  'পূর্ব ভাদ্রপদা','উত্তর ভাদ্রপদা','রেবতী'
];

// 27 Yogas (Sun + Moon sidereal longitude / 13.333°)
const _YOGA = [
  'Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda',
  'Sukarman','Dhriti','Shula','Ganda','Vriddhi','Dhruva',
  'Vyaghata','Harshana','Vajra','Siddhi','Vyatipata','Variyana',
  'Parigha','Shiva','Siddha','Sadhya','Shubha','Shukla',
  'Brahma','Indra','Vaidhriti'
];

const _YOGA_BN = [
  'বিষ্কম্ভ','প্রীতি','আয়ুষ্মান','সৌভাগ্য','শোভন','অতিগণ্ড',
  'সুকর্মা','ধৃতি','শূল','গণ্ড','বৃদ্ধি','ধ্রুব',
  'ব্যাঘাত','হর্ষণ','বজ্র','সিদ্ধি','ব্যতীপাত','বরীয়ান',
  'পরিঘ','শিব','সিদ্ধ','সাধ্য','শুভ','শুক্ল',
  'ব্রহ্ম','ইন্দ্র','বৈধৃতি'
];

// 11 Karanas (half-tithis). Cycle: 4 fixed + 7 repeating × 8
const _KARANA_FIXED_START = ['Kimstughna']; // tithi 1 first half
const _KARANA_CYCLE = [
  'Bava','Balava','Kaulava','Taitila','Garaja','Vanija','Vishti'
];
const _KARANA_FIXED_END = ['Shakuni','Chatushpada','Naga']; // last 3 halves of Krishna paksha

const _KARANA_BN_CYCLE = [
  'বব','বালব','কৌলব','তৈতিল','গরজ','বণিজ','বিষ্টি'
];
const _KARANA_BN_FIXED = ['কিংস্তুঘ্ন','শকুনি','চতুষ্পাদ','নাগ'];

// Standard lunar month names (0=Chaitra … 11=Phalguna)
const _MONTH_STD = [
  'Chaitra','Vaishakha','Jyeshtha','Ashadha',
  'Shravana','Bhadrapada','Ashwin','Kartik',
  'Margashirsha','Pausha','Magha','Phalguna'
];
const _MONTH_STD_BN = [
  'চৈত্র','বৈশাখ','জ্যৈষ্ঠ','আষাঢ়',
  'শ্রাবণ','ভাদ্র','আশ্বিন','কার্তিক',
  'অগ্রহায়ণ','পৌষ','মাঘ','ফাল্গুন'
];

// Gaudiya Vaishnava month names (Lord Vishnu's names, same index)
const _MONTH_GAUDIYA = [
  'Vishnu','Madhusudana','Trivikrama','Vamana',
  'Shridhara','Hrishikesha','Padmanabha','Damodara',
  'Keshava','Narayana','Madhava','Govinda'
];
const _MONTH_GAUDIYA_BN = [
  'বিষ্ণু','মধুসূদন','ত্রিবিক্রম','বামন',
  'শ্রীধর','হৃষীকেশ','পদ্মনাভ','দামোদর',
  'কেশব','নারায়ণ','মাধব','গোবিন্দ'
];

// Vaara (day of week) — 0=Sun … 6=Sat
const _VAARA = ['Ravivara','Somavara','Mangalavara','Budhavara','Guruvara','Shukravara','Shanivara'];
const _VAARA_BN = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
const _VAARA_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// Paksha names
const _PAKSHA    = { shukla: 'Shukla Paksha', krishna: 'Krishna Paksha', gaura: 'Gaura Paksha' };
const _PAKSHA_BN = { shukla: 'শুক্ল পক্ষ',  krishna: 'কৃষ্ণ পক্ষ',   gaura: 'গৌর পক্ষ' };
// Gaudiya terms
const _PAKSHA_GAUDIYA    = { shukla: 'Gaura Paksha', krishna: 'Krishna Paksha' };
const _PAKSHA_GAUDIYA_BN = { shukla: 'গৌর পক্ষ',    krishna: 'কৃষ্ণ পক্ষ' };

// ═══════════════════════════════════════════════════════════════════
//  COMPUTATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// Tithi index 1-30 from elongation
function _tithiIdx(date) {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T  = (JD - 2451545.0) / 36525.0;
  const r  = Math.PI / 180;
  const L0 = ((280.46646 + 36000.76983 * T) % 360 + 360) % 360;
  const M  = ((357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360 + 360) % 360;
  const Mr = M * r;
  const C  = (1.914602 - 0.004817*T - 0.000014*T*T)*Math.sin(Mr)
           + (0.019993 - 0.000101*T)*Math.sin(2*Mr)
           +  0.000289*Math.sin(3*Mr);
  const sunLon = L0 + C;
  const Lm = ((218.3164477 + 481267.88123421*T - 0.0015786*T*T) % 360 + 360) % 360;
  const Mm = ((134.9633964 + 477198.8675055 *T + 0.0087414*T*T) % 360 + 360) % 360;
  const F  = (( 93.2720950 + 483202.0175233 *T - 0.0036539*T*T) % 360 + 360) % 360;
  const D  = ((297.8501921 + 445267.1114034 *T - 0.0018819*T*T) % 360 + 360) % 360;
  const Mmr=Mm*r, Fr=F*r, Dr=D*r;
  const moonLon = Lm
    + 6.289*Math.sin(Mmr)  - 1.274*Math.sin(2*Dr-Mmr)
    + 0.658*Math.sin(2*Dr) - 0.214*Math.sin(2*Mmr)
    + 0.059*Math.sin(2*Dr-2*Mmr+Mmr) - 0.057*Math.sin(2*Dr-Mr-Mmr)
    + 0.053*Math.sin(2*Dr+Mmr) + 0.046*Math.sin(2*Dr-Mr)
    + 0.041*Math.sin(Mmr-Mr)   - 0.034*Math.sin(Dr)
    + 0.030*Math.sin(2*Mmr-Mr) - 0.024*Math.sin(2*(Dr-Mmr))
    + 0.018*Math.sin(2*Dr-2*Fr-Mmr);
  const elong = ((moonLon - sunLon) % 360 + 360) % 360;
  return Math.floor(elong / 12) + 1; // 1-30
}

// Find when tithi changes after `from` date (within 2 days)
function _nextTithiChange(from) {
  const current = _tithiIdx(from);
  const targetElong = (current % 30) * 12; // next boundary in degrees
  // Step forward hourly until we see the change, then binary-search
  const hour = 3600000;
  let t = new Date(from.getTime() + hour);
  for (let i = 0; i < 60; i++) {
    if (_tithiIdx(t) !== current) {
      // binary search in [t-1h, t]
      let lo = new Date(t.getTime() - hour), hi = new Date(t);
      for (let j = 0; j < 52; j++) {
        const mid = new Date((lo.getTime() + hi.getTime()) / 2);
        if (_tithiIdx(mid) === current) lo = mid; else hi = mid;
        if (hi.getTime() - lo.getTime() < 10000) break;
      }
      return new Date((lo.getTime() + hi.getTime()) / 2);
    }
    t = new Date(t.getTime() + hour);
  }
  return null;
}

// Nakshatra index 0-26 from sidereal Moon longitude
function _nakshatraIdx(moonSid) {
  return Math.floor(((moonSid % 360) + 360) % 360 / (360 / 27));
}

// Find when Nakshatra changes after `from`
function _nextNakshatraChange(from) {
  const hour = 3600000;
  const currentIdx = _nakshatraIdx(_sunMoonLongitudes(from).moonSid);
  let t = new Date(from.getTime() + hour);
  for (let i = 0; i < 60; i++) {
    if (_nakshatraIdx(_sunMoonLongitudes(t).moonSid) !== currentIdx) {
      let lo = new Date(t.getTime() - hour), hi = new Date(t);
      for (let j = 0; j < 52; j++) {
        const mid = new Date((lo.getTime() + hi.getTime()) / 2);
        if (_nakshatraIdx(_sunMoonLongitudes(mid).moonSid) === currentIdx) lo = mid; else hi = mid;
        if (hi.getTime() - lo.getTime() < 10000) break;
      }
      return new Date((lo.getTime() + hi.getTime()) / 2);
    }
    t = new Date(t.getTime() + hour);
  }
  return null;
}

// Yoga index 0-26: (sunSid + moonSid) / 13.333°
function _yogaIdx(sunSid, moonSid) {
  return Math.floor(((sunSid + moonSid) % 360 + 360) % 360 / (360 / 27));
}

// Find when Yoga changes after `from`
function _nextYogaChange(from) {
  const hour = 3600000;
  const { sunSid, moonSid } = _sunMoonLongitudes(from);
  const currentIdx = _yogaIdx(sunSid, moonSid);
  let t = new Date(from.getTime() + hour);
  for (let i = 0; i < 60; i++) {
    const lon = _sunMoonLongitudes(t);
    if (_yogaIdx(lon.sunSid, lon.moonSid) !== currentIdx) {
      let lo = new Date(t.getTime() - hour), hi = new Date(t);
      for (let j = 0; j < 52; j++) {
        const mid = new Date((lo.getTime() + hi.getTime()) / 2);
        const ml = _sunMoonLongitudes(mid);
        if (_yogaIdx(ml.sunSid, ml.moonSid) === currentIdx) lo = mid; else hi = mid;
        if (hi.getTime() - lo.getTime() < 10000) break;
      }
      return new Date((lo.getTime() + hi.getTime()) / 2);
    }
    t = new Date(t.getTime() + hour);
  }
  return null;
}

// Karana: half-tithi. karanaNum = 0..59 within the lunar month cycle
// Tithi 1 first half = Kimstughna (fixed)
// Tithis 1(2nd half) through 14 (both halves) = 7-cycle repeating (28 karanas)
// Tithi 15 = Bava (first), Balava (second) ... continues cycling
// Last 3 halves (tithi 29 2nd half, 30 1st half, 30 2nd half) = Shakuni, Chatushpada, Naga
function _karanaName(tithiIdx, isSecondHalf) {
  // tithiIdx 1-30, isSecondHalf = true if Moon elongation is in latter 6° of the tithi
  const halfTithi = (tithiIdx - 1) * 2 + (isSecondHalf ? 1 : 0); // 0..59
  if (halfTithi === 0) return { en: 'Kimstughna', bn: 'কিংস্তুঘ্ন' };
  if (halfTithi === 57) return { en: 'Shakuni',    bn: 'শকুনি' };
  if (halfTithi === 58) return { en: 'Chatushpada',bn: 'চতুষ্পাদ' };
  if (halfTithi === 59) return { en: 'Naga',       bn: 'নাগ' };
  // Repeating 7-cycle for half-tithis 1-56
  const idx = (halfTithi - 1) % 7;
  return { en: _KARANA_CYCLE[idx], bn: _KARANA_BN_CYCLE[idx] };
}

// Lunar month index 0-11 from sidereal Sun longitude
// Sun in Aries (0-30°) = Chaitra, Taurus = Vaishakha, etc.
function _lunarMonthIdx(sunSid) {
  return Math.floor(((sunSid % 360) + 360) % 360 / 30);
}

// Gaurabda year: Gregorian year - 1486 (starts ~March)
function _gaurabdaYear(date) {
  // Gaurabda new year is Gaura Purnima (around March)
  // Simple approximation: if month >= 3 (March), use year-1486, else year-1487
  const y = date.getFullYear();
  const m = date.getMonth(); // 0=Jan
  return m >= 2 ? y - 1486 : y - 1487;
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN EXPORT FUNCTION
// ═══════════════════════════════════════════════════════════════════

/**
 * getPanchangData(lat, lng, date)
 * Returns full panchang data for the given location and date.
 * All end times are local device time.
 *
 * @param {number} lat  - Latitude
 * @param {number} lng  - Longitude
 * @param {Date}   date - Date to compute for (defaults to now)
 * @returns {object}
 */
function getPanchangData(lat, lng, date) {
  date = date || new Date();

  const lon = _sunMoonLongitudes(date);
  const { sunSid, moonSid } = lon;

  // ── Tithi ────────────────────────────────────────────────────────
  const tithiNum = _tithiIdx(date);          // 1-30
  const paksha   = tithiNum <= 15 ? 'shukla' : 'krishna';
  // Karana: check if in second half of tithi (elongation % 12 >= 6)
  const JD = date.getTime() / 86400000 + 2440587.5;
  const T  = (JD - 2451545.0) / 36525.0;
  const elong = ((lon.moonTrop - lon.sunTrop) % 360 + 360) % 360;
  const elongInTithi = elong % 12;
  const isSecondHalf = elongInTithi >= 6;
  const tithiEnd = _nextTithiChange(date);

  // ── Nakshatra ────────────────────────────────────────────────────
  const nakshatraIdx = _nakshatraIdx(moonSid);
  const nakshatraEnd = _nextNakshatraChange(date);

  // ── Yoga ─────────────────────────────────────────────────────────
  const yogaIdx = _yogaIdx(sunSid, moonSid);
  const yogaEnd = _nextYogaChange(date);

  // ── Karana ───────────────────────────────────────────────────────
  const karana = _karanaName(tithiNum, isSecondHalf);
  // Karana changes each half-tithi (~6 hours), so end = next 6° boundary
  const karanaEndElong = Math.ceil(elong / 6) * 6;
  // (approximate — exact would need binary search on 6° boundary)

  // ── Month ────────────────────────────────────────────────────────
  const monthIdx = _lunarMonthIdx(sunSid); // 0-11
  // Check Adhik Maas
  const dateStr = date.toISOString().slice(0,10);
  const isAdhik = typeof isAdhikMaasDate === 'function' && isAdhikMaasDate(dateStr);

  // ── Vaara ────────────────────────────────────────────────────────
  const vaaraIdx = date.getDay(); // 0=Sun

  // ── Gaurabda ─────────────────────────────────────────────────────
  const gaurabda = _gaurabdaYear(date);

  // ── Build result ─────────────────────────────────────────────────
  return {
    // Raw numbers for logic
    tithiNum,
    nakshatraIdx,
    yogaIdx,
    monthIdx,
    vaaraIdx,
    paksha,
    isAdhikMaas: isAdhik,
    gaurabda,

    // Tithi
    tithi: {
      num:    tithiNum,
      name:   _TITHI_NAMES[tithiNum],
      nameBn: _TITHI_BN[tithiNum],
      paksha,
      endTime:   tithiEnd ? _fmt(tithiEnd) : null,
      endTimeHM: tithiEnd ? _fmtHHMM(tithiEnd) : null,
      endDate:   tithiEnd ? tithiEnd : null,
    },

    // Nakshatra
    nakshatra: {
      idx:    nakshatraIdx,
      name:   _NAKSHATRA[nakshatraIdx],
      nameBn: _NAKSHATRA_BN[nakshatraIdx],
      endTime:   nakshatraEnd ? _fmt(nakshatraEnd) : null,
      endTimeHM: nakshatraEnd ? _fmtHHMM(nakshatraEnd) : null,
    },

    // Yoga
    yoga: {
      idx:    yogaIdx,
      name:   _YOGA[yogaIdx],
      nameBn: _YOGA_BN[yogaIdx],
      endTime:   yogaEnd ? _fmt(yogaEnd) : null,
      endTimeHM: yogaEnd ? _fmtHHMM(yogaEnd) : null,
    },

    // Karana
    karana: {
      name:   karana.en,
      nameBn: karana.bn,
      isSecondHalf,
    },

    // Month — both naming systems
    month: {
      idx:       monthIdx,
      std:       isAdhik ? 'Purushottama' : _MONTH_STD[monthIdx],
      stdBn:     isAdhik ? 'পুরুষোত্তম'  : _MONTH_STD_BN[monthIdx],
      gaudiya:   isAdhik ? 'Purushottama' : _MONTH_GAUDIYA[monthIdx],
      gaudiyaBn: isAdhik ? 'পুরুষোত্তম'  : _MONTH_GAUDIYA_BN[monthIdx],
      isAdhik,
    },

    // Paksha
    paksha: {
      key:       paksha,
      name:      _PAKSHA[paksha],
      nameBn:    _PAKSHA_BN[paksha],
      gaudiya:   _PAKSHA_GAUDIYA[paksha],
      gaudiyaBn: _PAKSHA_GAUDIYA_BN[paksha],
    },

    // Vaara
    vaara: {
      idx:    vaaraIdx,
      name:   _VAARA[vaaraIdx],
      nameBn: _VAARA_BN[vaaraIdx],
      en:     _VAARA_EN[vaaraIdx],
    },

    // Gaurabda year
    gaurabdaYear: gaurabda,
  };
}

// ── Convenience: format for display (like the ISKCON app) ─────────
function formatPanchang(p) {
  const t = p.tithi;
  const n = p.nakshatra;
  const y = p.yoga;
  const k = p.karana;
  return {
    // English
    tithiLine:      `${t.name} (up to ${t.endTime || '—'})`,
    nakshatraLine:  `${n.name} (up to ${n.endTime || '—'})`,
    yogaLine:       `${y.name} (up to ${y.endTime || '—'})`,
    karanaLine:     k.name,
    monthLine:      `${p.month.std} / ${p.month.gaudiya}`,
    pakshaLine:     `${p.paksha.name} / ${p.paksha.gaudiya}`,
    vaaraLine:      `${p.vaara.name} (${p.vaara.en})`,
    gaurabdaLine:   `${p.gaurabdaYear} Gaurabda`,
    // Bengali
    tithiLineBn:    `${t.nameBn} (${t.endTime || '—'} পর্যন্ত)`,
    nakshatraLineBn:`${n.nameBn} (${n.endTime || '—'} পর্যন্ত)`,
    yogaLineBn:     `${y.nameBn} (${y.endTime || '—'} পর্যন্ত)`,
    karanaLineBn:   k.nameBn,
    monthLineBn:    `${p.month.stdBn} / ${p.month.gaudiyaBn}`,
    pakshaLineBn:   `${p.paksha.nameBn} / ${p.paksha.gaudiyaBn}`,
    vaaraLineBn:    p.vaara.nameBn,
  };
}
