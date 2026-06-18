/* ══════════════════════════════════════════════════════════════
   Vedic Panchanga — self-contained module
   Loads:  panchanga.html  (HTML fragment, injected into #vpanchanga-mount)
           panchanga.css   (linked from index.html)
           panchanga.js    (this file — engine + loader)
   Wiring in index.html requires only:
     <link rel="stylesheet" href="./vedic-panchanga/panchanga.css">
     <div id="vpanchanga-mount"></div>
     <script defer src="./vedic-panchanga/panchanga.js"></script>
   The B&C sub-tab buttons (vpSwitchTab) stay in index.html as wiring.
   ══════════════════════════════════════════════════════════════ */
(function () {
  // ── Resolve own folder so fetch works regardless of host path ──
  const _selfSrc = (document.currentScript && document.currentScript.src) || '';
  const _baseURL = _selfSrc ? _selfSrc.replace(/[^/]*$/, '') : './vedic-panchanga/';

  // ── Inject HTML fragment into the mount point, then boot the engine ──
  function _bootPanchanga() {
    const mount = document.getElementById('vpanchanga-mount');
    if (!mount) {
      console.warn('[panchanga] #vpanchanga-mount not found in DOM — skipping.');
      _initEngine();
      return;
    }
    fetch(_baseURL + 'panchanga.html', { cache: 'no-cache' })
      .then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(html => {
        mount.innerHTML = html;
        _initEngine();
      })
      .catch(err => {
        console.error('[panchanga] Failed to load panchanga.html:', err);
        mount.innerHTML =
          '<div style="padding:20px;text-align:center;color:#f87171">Vedic Panchanga module failed to load.</div>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _bootPanchanga);
  } else {
    _bootPanchanga();
  }

  // ── Engine ────────────────────────────────────────────────────
  function _initEngine() {
    /* === BEGIN ORIGINAL ENGINE (extracted unchanged) === */
(function() {
// ── Vedic Panchanga Engine (scoped) ─────────────────────────
// All globals renamed with VP_ prefix internally


// ═══════════════════════════════════════════════════════════════
// ASTRONOMY
// ═══════════════════════════════════════════════════════════════
function toRad(d){return d*Math.PI/180}
function norm(d){let x=d%360;return x<0?x+360:x}
function dateToJD(date){
  const Y=date.getUTCFullYear(),M=date.getUTCMonth()+1;
  const day=date.getUTCDate()+date.getUTCHours()/24+date.getUTCMinutes()/1440+date.getUTCSeconds()/86400;
  let y=Y,m=M;if(m<=2){y--;m+=12}
  const A=Math.floor(y/100),B=2-A+Math.floor(A/4);
  return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+day+B-1524.5;
}
function jdToDate(jd){return new Date((jd-2440587.5)*86400000)}

// ── Lahiri Ayanamsa (IAU standard for Vedic calculations) ────────────────
// Subtracts from tropical to get sidereal longitude
function lahiriAyanamsa(jd){
  // Chitrapaksha/Lahiri — J2000.0 epoch 23.85358°, rate 50.2564"/yr (0.013597°/yr)
  return 23.85358+0.013597*(jd-2451545.0)/365.25;
}





// Sidereal versions used for Nakshatra/Yoga/Karana (Vedic)
function moonLongSid(jd){return norm(moonLong(jd)-lahiriAyanamsa(jd));}
function sunLongSid(jd){return norm(sunLong(jd)-lahiriAyanamsa(jd));}
function sunLong(jd){
  const T=(jd-2451545)/36525;
  let L=280.46646+36000.76983*T+.0003032*T*T;
  let M=norm(357.52911+35999.05029*T-.0001537*T*T);
  const Mr=toRad(M);
  const C=(1.914602-.004817*T-.000014*T*T)*Math.sin(Mr)+(0.019993-.000101*T)*Math.sin(2*Mr)+.000289*Math.sin(3*Mr);
  return norm(L+C);
}
function moonLong(jd){
  const T=(jd-2451545)/36525;
  let L=norm(218.3164477+481267.88123421*T-.0015786*T*T+T*T*T/538841-T*T*T*T/65194000);
  let M=norm(357.5291092+35999.0502909*T-.0001536*T*T+T*T*T/24490000);
  let Mp=norm(134.9633964+477198.8675055*T+.0087414*T*T+T*T*T/69699-T*T*T*T/14712000);
  let F=norm(93.292095+483202.0175233*T-.0036539*T*T-T*T*T/3526000+T*T*T*T/863310000);
  let D=norm(297.8501921+445267.1114034*T-.0018819*T*T+T*T*T/545868-T*T*T*T/113065000);
  const A1=toRad(norm(119.75+131.849*T)),A2=toRad(norm(53.09+479264.29*T));
  const Mr2=toRad(M),Mpr=toRad(Mp),Fr=toRad(F),Dr=toRad(D),L0r=toRad(L);
  let s=0;
  s+=6288774*Math.sin(Mpr);s+=1274027*Math.sin(2*Dr-Mpr);s+=658314*Math.sin(2*Dr);
  s+=213618*Math.sin(2*Mpr);s-=185116*Math.sin(Mr2);s-=114332*Math.sin(2*Fr);
  s+=58793*Math.sin(2*Dr-2*Mpr);s+=57066*Math.sin(2*Dr-Mr2-Mpr);s+=53322*Math.sin(2*Dr+Mpr);
  s+=45758*Math.sin(2*Dr-Mr2);s-=40923*Math.sin(Mr2-Mpr);s-=34720*Math.sin(Dr);
  s-=30383*Math.sin(Mr2+Mpr);s+=15327*Math.sin(2*Dr-2*Fr);s-=12528*Math.sin(Mpr+2*Fr);
  s+=10980*Math.sin(Mpr-2*Fr);s+=10675*Math.sin(4*Dr-Mpr);s+=10034*Math.sin(3*Mpr);
  s+=8548*Math.sin(4*Dr-2*Mpr);s-=7888*Math.sin(2*Dr+Mr2-Mpr);s-=6766*Math.sin(2*Dr+Mr2);
  s-=5163*Math.sin(Dr-Mpr);s+=4987*Math.sin(Dr+Mr2);s+=4036*Math.sin(2*Dr-Mr2+Mpr);
  s+=3994*Math.sin(2*Dr+2*Mpr);s+=3861*Math.sin(4*Dr);s+=3665*Math.sin(2*Dr-3*Mpr);
  s-=2689*Math.sin(Mr2-2*Mpr);s-=2602*Math.sin(2*Dr-Mpr+2*Fr);
  s+=2390*Math.sin(2*Dr-Mr2-2*Mpr);s-=2348*Math.sin(Dr+Mpr);s+=2236*Math.sin(2*Dr-2*Mr2);
  s-=2120*Math.sin(Mr2+2*Mpr);s-=2069*Math.sin(2*Mr2);s+=2048*Math.sin(2*Dr-2*Mr2-Mpr);
  s-=1773*Math.sin(2*Dr+Mpr-2*Fr);s-=1595*Math.sin(2*Dr+2*Fr);s+=1215*Math.sin(4*Dr-Mr2-Mpr);
  s-=1110*Math.sin(2*Mpr+2*Fr);
  s+=3958*Math.sin(A1);s+=1962*Math.sin(L0r-Fr);s+=318*Math.sin(A2);
  return norm(L+s/1000000);
}
function findElong(jdS,jdE,target){
  let lo=jdS,hi=jdE;
  for(let i=0;i<52;i++){const m=(lo+hi)/2;const d=norm(norm(moonLong(m)-sunLong(m))-target);d<180?hi=m:lo=m}
  return(lo+hi)/2;
}
function findMoonLng(jdS,jdE,target){
  let lo=jdS,hi=jdE;
  for(let i=0;i<52;i++){const m=(lo+hi)/2;const d=norm(moonLongSid(m)-target);d<180?hi=m:lo=m}
  return(lo+hi)/2;
}
function findYoga(jdS,jdE,target){
  let lo=jdS,hi=jdE;
  for(let i=0;i<52;i++){const m=(lo+hi)/2;const d=norm(norm(moonLongSid(m)+sunLongSid(m))-target);d<180?hi=m:lo=m}
  return(lo+hi)/2;
}

// ═══════════════════════════════════════════════════════════════
// NAMES & CONSTANTS
// ═══════════════════════════════════════════════════════════════
const TITHI=['Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima','Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami','Shashthi','Saptami','Ashtami','Navami','Dashami','Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Amavasya'];
const NAKSHATRA=['Ashwini','Bharani','Krittika','Rohini','Mrigashirsha','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const YOGA_N=['Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarma','Dhriti','Shula','Ganda','Vriddhi','Dhruva','Vyaghata','Harshana','Vajra','Siddhi','Vyatipata','Variyan','Parigha','Shiva','Siddha','Sadhya','Shubha','Shukla','Brahma','Indra','Vaidhriti'];
const KAR_MOV=['Bava','Balava','Kaulava','Taitila','Garija','Vanija','Vishti'];
const KAR_END=['Chatushpada','Naga','Kimstughna'];
function karName(i){if(i===0)return'Kimstughna';if(i>=57)return KAR_END[i-57];return KAR_MOV[(i-1)%7]}
const VAAR=['Rabi','Som','Mangol','Budh','Brihaspati','Sukro','Shani'];
const VAAR_ICON=['☀️','🌙','🔥','🌿','🪐','✨','⏳'];
const VAAR_BN=['রবি','সোম','মঙ্গল','বুধ','বৃহস্পতি','শুক্র','শনি'];
const HM=['Chaitra','Vaishakha','Jyeshtha','Ashadha','Shravana','Bhadrapada','Ashwina','Kartika','Margashirsha','Pausha','Magha','Phalguna'];
const VM=['Vishnu','Madhusudana','Trivikrama','Vamana','Shridhara','Hrishikesha','Padmanabha','Damodara','Keshava','Narayana','Madhava','Govinda'];

// Tithi effects
const TITHI_FX=['New beginning, auspicious start','Prosperity & growth','Victory & success','Danger — avoid important work','Auspicious for all good deeds','Good for social gatherings','Win over enemies, good travel','Mixed — caution for new work','Completing pending tasks','Excellent for all activities','Ekadashi fast — highly sacred','Breaking fast, gifts & charity','Avoid new ventures','Ancestral worship, sacred','Full Moon — very auspicious',
'New beginning after full moon','Growth of plans','Success in undertakings','Obstacle — delay decisions','Auspicious, creative work','Pleasant, social activities','Overcoming adversaries','Eight directions — be cautious','Completion of tasks','Good for regular activities','Ekadashi fast — sacred vrat','Post Ekadashi, charity','Avoid new ventures','Ancestral rites','New Moon — worship ancestors'];
const NAK_FX=['Swift & fierce, good for bold acts','Fierce, avoid auspicious deeds','Mixed, good for cooking & fire','Very auspicious, love & growth','Gentle, good for creativity','Sharp, removal & healing work','Auspicious, renew & restore','Excellent for all beginnings','Sharp, avoid new activities','Good for old work & traditions','Pleasant, arts & romance','Stable, sacred ceremonies','Mobile, journey & trading','Sharp, piercing tasks','Good for moving & travel','Auspicious, spiritual growth','Devotion & fixed tasks','Sharp, fierce activities','Fierce, avoid auspicious deeds','Speed & travel, good for haste','Fixed, stable ceremonies','Good for learning & devotion','Quick, good for moving tasks','Severe, purification tasks','Fierce, avoid major starts','Fixed, stable ceremonies','Gentle, renewal & auspicious'];
const YOGA_FX=['Inauspicious — obstacles likely','Love & friendliness abound','Longevity & health favored','Good fortune in all matters','Prosperous & beautiful time','Anger & sudden obstacles','Good deeds bring results','Stability & determination','Thorny path — avoid big moves','Obstacles & health issues','Growth & financial gain','Fixed & stable, good for vows','Sudden setbacks possible','Joy & happiness prevail','Sudden dangers — be careful','Success in all endeavors','Highly inauspicious — avoid','Very auspicious & favorable','Encircling obstacles to remove','Auspicious, Shiva-blessed','Success with effort','Achievement of goals','Auspicious for good deeds','Pure & clean time','Brahma-blessed — sacred deeds','Indra-blessed — victory','Highly inauspicious — avoid'];
const KARANA_FX_LOOKUP={
  'Bava':'Auspicious for all works — good for new beginnings & prosperity',
  'Balava':'Favorable for love, arts & pleasant activities',
  'Kaulava':'Good for friends, family matters & gentle pursuits',
  'Taitila':'Auspicious for agriculture, trade & steady work',
  'Garija':'Suitable for travel, seeking boons & religious acts',
  'Vanija':'Excellent for commerce, trade & financial dealings',
  'Vishti':'Inauspicious (Bhadra) — avoid new work & important decisions',
  'Kimstughna':'Fixed — auspicious start of lunar cycle, good for sacred rites',
  'Chatushpada':'Fixed — auspicious for animal-related & agricultural work',
  'Naga':'Fixed — good for mantra, tantra & occult practices',
};
const MEFF={
  'Brahma Muhurta':'Best for meditation, study & prayer. Spiritual practices begun now bear great fruit.',
  'Abhijit Muhurta':'Victory muhurta. Excellent for important work, meetings & new starts.',
  'Vijaya Muhurta':'Afternoon victory period. Good for negotiations, signing agreements.',
  'Godhuli Muhurta':'Sacred cow-dust time. Auspicious for prayers, marriages & new ventures.',
  'Nishita Muhurta':'Midnight — for Tantra, Mantra & deep Sadhana. Highly sacred.',
  'Amrita Kala':'Nectar time — all deeds performed now give abundant results.',
  'Rahu Kalam':'Rahu rules this period. Strictly avoid new beginnings & auspicious work.',
  'Yamaganda':'Yama\'s period — inauspicious. Avoid travel & important decisions.',
  'Gulika (Mandi)':'Saturn-influenced — delays & obstacles. Avoid auspicious activities.',
  'Varjyam / Tyajya':'Moon-based inauspicious window. Avoid important & sacred activities.',
  'Dur Muhurta 1':'Daily inauspicious slot — avoid new ventures & rituals.',
  'Dur Muhurta 2':'Daily inauspicious slot — avoid new ventures & rituals.',
};

// ═══════════════════════════════════════════════════════════════
// VEDIC CALCULATIONS
// ═══════════════════════════════════════════════════════════════
function tithiIdx(jd){return Math.floor(norm(moonLong(jd)-sunLong(jd))/12)}

function getTithiPeriods(jd,count=10){
  const periods=[];let s=jd-0.5;
  for(let i=0;i<count+1;i++){
    const idx=tithiIdx(s);
    const end=findElong(s,s+2,((idx+1)%30)*12);
    periods.push({index:idx,name:TITHI[idx],paksha:idx<15?'Sukla':'Krishna',startJD:s,endJD:end});
    s=end+.0001;
  }
  for(let i=1;i<periods.length;i++)periods[i].startJD=periods[i-1].endJD;
  periods[0].startJD=findElong(jd-2,jd,periods[0].index*12);
  return periods;
}

function getLunarMonthTithis(jd){
  const elong=norm(moonLong(jd)-sunLong(jd));
  // Use -3 guard (was -2) so we don't miss New Moon when elong is very small
  const prevNM=findElong(jd-(elong/360)*29.53-3,jd,0);
  const periods=[];let s=prevNM+.0001;
  for(let i=0;i<30;i++){
    const idx=tithiIdx(s);
    const end=findElong(s,s+2,((idx+1)%30)*12);
    periods.push({index:idx,name:TITHI[idx],paksha:idx<15?'Sukla':'Krishna',startJD:s,endJD:end});
    s=end+.0001;
  }
  for(let i=1;i<periods.length;i++)periods[i].startJD=periods[i-1].endJD;
  periods[0].startJD=prevNM;
  return periods;
}

function getNakshatraPeriods(jd,count=3){
  const SPAN=360/27;const periods=[];
  // Search up to 3 days back; use jd+0.5 as upper bound so bisection
  // doesn't collapse to jd when the current nakshatra is still ongoing
  const curNakStart=Math.floor(moonLongSid(jd)/SPAN)*SPAN;
  let trueStart=findMoonLng(jd-3,jd+0.5,curNakStart);
  // Safety: if bisection returned a start that's after jd (no crossing found
  // in window), fall back one full nakshatra span earlier
  if(trueStart>jd) trueStart=findMoonLng(jd-4,jd,curNakStart);
  let s=trueStart;
  for(let i=0;i<count;i++){
    const idx=Math.floor(moonLongSid(s)/SPAN)%27;
    const end=findMoonLng(s,s+3,((idx+1)%27)*SPAN);
    periods.push({index:idx,name:NAKSHATRA[idx],startJD:s,endJD:end});
    s=end+.0001;
  }
  return periods;
}

function getYogaPeriods(jd,count=3){
  const SPAN=360/27;const periods=[];
  const c0=norm(moonLongSid(jd)+sunLongSid(jd));
  const curYogaStart=Math.floor(c0/SPAN)*SPAN;
  let trueStart=findYoga(jd-3,jd+0.5,curYogaStart);
  if(trueStart>jd) trueStart=findYoga(jd-4,jd,curYogaStart);
  let s=trueStart;
  for(let i=0;i<count;i++){
    const c=norm(moonLongSid(s)+sunLongSid(s));
    const idx=Math.floor(c/SPAN)%27;
    const end=findYoga(s,s+4,((idx+1)%27)*SPAN);
    periods.push({index:idx,name:YOGA_N[idx],startJD:s,endJD:end});
    s=end+.0001;
  }
  return periods;
}

function getKaranaPeriods(jd,count=5){
  const periods=[];
  const idx0=Math.floor(norm(moonLong(jd)-sunLong(jd))/6);
  // Extend window to jd+0.5 so bisection doesn't collapse when karana
  // boundary is right around now; also search 2 days back (karana ~6h)
  let trueStart=findElong(jd-2,jd+0.5,idx0*6);
  if(trueStart>jd) trueStart=findElong(jd-2,jd,idx0*6);
  let s=trueStart;
  for(let i=0;i<count;i++){
    const idx=Math.floor(norm(moonLong(s)-sunLong(s))/6);
    const end=findElong(s,s+1.5,((idx+1)%60)*6);
    periods.push({index:idx,name:karName(idx),startJD:s,endJD:end});
    s=end+.0001;
  }
  return periods;
}

function gaurabda(date){
  // Gaurabda year starts on Gaura Purnima = Phalguna Purnima (Sukla Purnima when Sun is in Aquarius/Pisces ~Feb-Mar)
  // Approximate: find the Purnima (Full Moon, elong≈180°) closest before/on this date in the Feb–Apr window
  const y=date.getFullYear();
  // Search for Purnima between Jan 15 and Apr 20 of current year
  const winStart=dateToJD(new Date(y,0,15));
  const winEnd=dateToJD(new Date(y,3,20));
  // Find all Purnimas in window (elong = 180°, tithi index 14)
  let gauPurnimaJD=null;
  let s=winStart;
  while(s<winEnd){
    const idx=tithiIdx(s);
    const end=findElong(s,s+2,((idx+1)%30)*12);
    if(idx===14){gauPurnimaJD=s+(end-s)/2;break;} // found Purnima; take midpoint
    s=end+.0001;
  }
  if(!gauPurnimaJD){
    // Fallback: crude March 15 cutoff
    const m=date.getMonth()+1,d=date.getDate();
    return y-1486-((m<3||(m===3&&d<15))?1:0);
  }
  const gauPurnima=jdToDate(gauPurnimaJD);
  return y-1486-(date<gauPurnima?1:0);
}
function hinduMonth(jd){const idx=Math.floor(sunLongSid(jd)/30)%12;return{name:HM[idx],vaishnavName:VM[idx]}}
// Find the most recent New Moon at or before jd, and the next New Moon at or
// after jd, using a tight ±2.5-day bisection window centred on a synodic-rate
// estimate. A wide blind window (the old approach) could accidentally skip
// over the nearby conjunction and lock onto the NEXT one instead whenever jd
// sat within ~1-2 days of an upcoming New Moon — silently merging two lunar
// months into one and breaking Adhik Maas (leap month) detection.
const SYNODIC_MONTH=29.530589;
function prevNewMoon(jd){
  const elong=norm(moonLong(jd)-sunLong(jd));
  const estDays=elong/360*SYNODIC_MONTH;
  let lo=jd-estDays-2.5,hi=jd-estDays+2.5;
  if(hi>jd)hi=jd;
  return findElong(lo,hi,0);
}
function nextNewMoon(jd){
  const elong=norm(moonLong(jd)-sunLong(jd));
  const estDays=(360-elong)/360*SYNODIC_MONTH;
  let lo=jd+estDays-2.5,hi=jd+estDays+2.5;
  if(lo<jd)lo=jd;
  return findElong(lo,hi,0);
}
function adhikMaas(jd){
  const prevNM=prevNewMoon(jd);
  const nextNM=nextNewMoon(jd);
  const sS=sunLongSid(prevNM),sE=sunLongSid(nextNM);
  const moved=norm(sE-sS);
  const dist=norm((Math.floor(sS/30)+1)*30-sS);
  const isAdhik=dist>=moved;
  const sunMid=norm(sS+moved/2);
  // Adhik Maas takes the name of the FOLLOWING Nija month (the next sankranti's rashi),
  // not the sign the sun is currently in. e.g. Adhik between Vaishakha & Jyeshtha 2026
  // is "Adhik Jyeshtha", matching Drik Panchang.
  return{isAdhik,nextMonthName:HM[(Math.floor(sE/30)+(isAdhik?1:0))%12],isPurushottam:isAdhik&&sunMid>=60&&sunMid<90};
}

// ═══════════════════════════════════════════════════════════════
// MUHURTA — computed from a SPECIFIC vaar's sunrise/sunset
// ═══════════════════════════════════════════════════════════════
const RAHU=[8,2,7,5,6,4,3],YAMA=[4,8,3,7,2,6,5],GULI=[7,6,5,4,3,2,1];
function dayParts(sr,ss){
  const parts=[new Date(+sr)];const ms=+ss-+sr;
  for(let i=1;i<=8;i++)parts.push(new Date(+sr+i*(ms/8)));
  return parts;
}
function partPeriod(arr,wd,sr,ss){const p=dayParts(sr,ss);const i=arr[wd]-1;return{start:p[i],end:p[i+1]}}
const DUR={0:[5,8],1:[7,15],2:[1,8],3:[3,11],4:[6,14],5:[7,9],6:[3,15]};
const VARJ_OFF=[7,4,10,4,14,8,6,2,4,4,12,2,6,4,4,6,2,4,4,4,4,4,4,4,2,4,4];

function getMuhurtaData(vaar,lat,lng){
  const{sunrise,sunset,brahmaMuhurtaStart,brahmaMuhurtaEnd}=vaar;
  const wd=sunrise.getDay();
  // Get accurate solar noon and moon times for THIS vaar's date
  const t=SunCalc.getTimes(sunrise,lat,lng);
  const noon=t.solarNoon;
  const mt=SunCalc.getMoonTimes(sunrise,lat,lng);
  const moonrise=mt.rise||null,moonset=mt.set||null;
  // Next day sunrise for nishita
  const nextDay=new Date(+sunrise+86400000);
  const nextSR=SunCalc.getTimes(nextDay,lat,lng).sunrise;
  const midnight=new Date((+sunset+nextSR.getTime())/2);
  const durMs=(+sunset-+sunrise)/15;
  // Nakshatra index for this vaar (use JD of this vaar's sunrise)
  const jdSR=dateToJD(sunrise);
  const nakIdx=Math.floor(moonLongSid(jdSR)/(360/27))%27;
  const varjOff=VARJ_OFF[nakIdx]*48*60*1000;
  return{
    sunrise,sunset,noon,moonrise,moonset,wd,
    brahmaMuhurta:{start:brahmaMuhurtaStart,end:brahmaMuhurtaEnd},
    sandhyaEnd:new Date(+sunrise+48*60*1000),
    sunsetSandhyaStart:new Date(+sunset-48*60*1000),
    rahuKalam:partPeriod(RAHU,wd,sunrise,sunset),
    yamaganda:partPeriod(YAMA,wd,sunrise,sunset),
    gulika:partPeriod(GULI,wd,sunrise,sunset),
    abhijit:{start:new Date(+noon-24*60*1000),end:new Date(+noon+24*60*1000)},
    vijaya:{start:new Date(+noon+(+sunset-+noon)*2/5),end:new Date(+noon+(+sunset-+noon)*2/5+48*60*1000)},
    godhuli:{start:new Date(+sunset-24*60*1000),end:new Date(+sunset+24*60*1000)},
    nishita:{start:new Date(+midnight-24*60*1000),end:new Date(+midnight+24*60*1000)},
    durMuhurtas:(DUR[wd]||[]).map(pos=>({start:new Date(+sunrise+(pos-1)*durMs),end:new Date(+sunrise+pos*durMs)})),
    // Only use moonrise if it falls within this vaar's day window (sunrise → next sunrise ~24h)
    // SunCalc can return yesterday's moonrise if moon hasn't risen yet today
    varjyam:(moonrise&&+moonrise>=+sunrise&&+moonrise<+sunrise+86400000)?{start:new Date(+moonrise+varjOff),end:new Date(+moonrise+varjOff+38*60*1000)}:null,
    amritaKala:(moonrise&&+moonrise>=+sunrise&&+moonrise<+sunrise+86400000)?{start:new Date(+moonrise+varjOff+68*60*1000),end:new Date(+moonrise+varjOff+106*60*1000)}:null,
  };
}

// ═══════════════════════════════════════════════════════════════
// VAAR STRIP — each button represents a DIFFERENT calendar day
// ═══════════════════════════════════════════════════════════════
function getBM(date,lat,lng){
  const t=SunCalc.getTimes(date,lat,lng);
  return new Date(+t.sunrise-96*60*1000);
}
function getVedicVaarIdx(now,lat,lng){
  const todayBM=getBM(now,lat,lng);
  const tomorrow=new Date(+now+86400000);
  const tomorrowBM=getBM(tomorrow,lat,lng);
  if(now>=tomorrowBM)return tomorrow.getDay();
  if(now<todayBM){const y=new Date(+now-86400000);return y.getDay();}
  return now.getDay();
}
function getVaarStrip(now,lat,lng){
  const activeIdx=getVedicVaarIdx(now,lat,lng);
  return VAAR.map((name,i)=>{
    // Offset from today: 0=today, 1=tomorrow, -1=yesterday etc wrapped in 7
    const diff=((i-activeIdx)+7)%7;
    const dayOffset=diff>3?diff-7:diff;  // -3 to +3
    const td=new Date(now);
    td.setDate(td.getDate()+dayOffset);
    // Use noon of that day so sunrise is reliable
    const noon=new Date(td.getFullYear(),td.getMonth(),td.getDate(),12,0,0);
    const t=SunCalc.getTimes(noon,lat,lng);
    const sunrise=t.sunrise,sunset=t.sunset;
    const bm=new Date(+sunrise-96*60*1000);
    return{index:i,name,isActive:i===activeIdx,dayOffset,
      brahmaMuhurtaStart:bm,brahmaMuhurtaEnd:new Date(+bm+48*60*1000),sunrise,sunset};
  });
}

// Special yogas
const SARV=[[0,[0,7,20,21,22,23,26]],[1,[3,6,7,22,23,24,25,26]],[2,[0,3,15,16,17,26]],[3,[3,6,7,15,22,23,24,25,26]],[4,[3,6,7,15,22,23,24,25,26]],[5,[3,6,7,15,22,23,24,25,26]],[6,[7,15,26]]];
const AMRT=[[0,[23]],[1,[3]],[2,[3]],[3,[6]],[4,[6]],[5,[7]],[6,[26]]];
function specialYogas(vaarIdx,nakIdx,vaarStart,vaarEnd){
  // vaarStart/vaarEnd = Brahma Muhurta start to next day BM — the full Vedic day span
  const r=[];
  const t=vaarStart?{start:vaarStart,end:vaarEnd}:{};
  if(vaarIdx===0&&nakIdx===7)r.push({name:'Ravi Pushya Yoga',symbol:'☀️',desc:'Sunday + Pushya — extremely auspicious',...t});
  if(vaarIdx===4&&nakIdx===7)r.push({name:'Guru Pushya Yoga',symbol:'🪔',desc:'Thursday + Pushya — highly auspicious',...t});
  const sc=SARV.find(([d])=>d===vaarIdx);if(sc&&sc[1].includes(nakIdx))r.push({name:'Sarvartha Siddhi Yoga',symbol:'🌺',desc:'Favorable for accomplishing all goals',...t});
  const ac=AMRT.find(([d])=>d===vaarIdx);if(ac&&ac[1].includes(nakIdx))r.push({name:'Amrita Siddhi Yoga',symbol:'🌼',desc:'Very auspicious — removes obstacles',...t});
  return r;
}

// ═══════════════════════════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════════════════════════
function fmt12(d){if(!d||isNaN(+d))return'—';return d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',hour12:true})}
function fmtDate(d){if(!d||isNaN(+d))return'—';return d.toLocaleDateString('en-IN',{month:'short',day:'numeric'})}
function fmtDT(d){return fmtDate(d)+' '+fmt12(d)}
function sameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function fmtEnd(end,ref){return sameDay(end,ref)?fmt12(end):fmtDate(end)+' '+fmt12(end)}
function dur(s,e){const m=Math.round((+e-+s)/60000);return m<60?m+'m':Math.floor(m/60)+'h '+(m%60?m%60+'m':'')}
// Relative-time pill — "starts in 2h 14m" / "3h 41m left" / "ended 12m ago"
function relStr(s,e,now){
  if(!s||!e||isNaN(+s)||isNaN(+e))return{cls:'past',txt:''};
  const nm=+now;
  if(nm<+s){const m=Math.round((+s-nm)/60000);return{cls:'soon',txt:'starts in '+(m<60?m+'m':Math.floor(m/60)+'h '+(m%60?m%60+'m':''))}}
  if(nm<+e){const m=Math.round((+e-nm)/60000);return{cls:'live',txt:(m<60?m+'m':Math.floor(m/60)+'h '+(m%60?m%60+'m':''))+' left'}}
  const m=Math.round((nm-+e)/60000);return{cls:'past',txt:'ended '+(m<60?m+'m':Math.floor(m/60)+'h '+(m%60?m%60+'m':''))+' ago'};
}
function relHTML(s,e,now){const r=relStr(s,e,now);if(!r.txt)return'';return`<span class="vp-rel vp-rel-${r.cls}">${r.txt}</span>`}

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let LAT=22.5726,LNG=88.3639;
let selectedVaarIdx=null;
let selectedAnga='tithi'; // tithi | nakshatra | yoga | karana — option-driven anga view
let DATA=null;

// GPS
// location handled by main app via window._appLat/_appLng

// Clock
function tickClock(){
  document.getElementById('vp-clock').textContent=new Date().toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true});
}
// clock handled by vpStartClock

// Grid toggle
function toggleGrid(){
  const w=document.getElementById('vp-month-grid-wrap'),b=document.getElementById('vp-tithi-toggle');
  w.classList.toggle('open');b.classList.toggle('open');
}

// Vaar selection
function selectVaar(idx){
  selectedVaarIdx=(selectedVaarIdx===idx)?null:idx;
  renderAll();
}
function clearSelectedVaar(){selectedVaarIdx=null;renderAll();}

// Step the displayed day forward (+1) or backward (-1) around the 7-day
// orbit ring, relative to whichever day is currently shown — used by the
// swipe gesture on the dial. Mirrors tap selection (an explicit index equal
// to activeVaarIdx renders identically to the null/"today" state).
function swipeVaar(delta){
  if(!DATA)return;
  const activeVaarIdx=DATA.activeVaarIdx;
  const curIdx=selectedVaarIdx!==null?selectedVaarIdx:activeVaarIdx;
  const curPos=((curIdx-activeVaarIdx)+7)%7;
  const nextPos=((curPos+delta)%7+7)%7;
  selectedVaarIdx=(activeVaarIdx+nextPos)%7;
  renderAll();
}

// Pointer-based swipe (covers touch + mouse) on the orbit dial: a horizontal
// drag past a small threshold steps to the next/previous day, with a damped
// live nudge while dragging and a spring-back snap on release. Bound once
// per wrap element (guarded) since renderAll() only replaces the orbit
// BUTTONS, not the wrap itself, on every re-render.
function initOrbitSwipe(wrap){
  if(!wrap||wrap._vpSwipeBound)return;
  wrap._vpSwipeBound=true;
  const THRESH=42,NUDGE_MAX=26,NUDGE_RATIO=.3,DEADZONE=6;
  let sx=0,sy=0,tracking=false,swiped=false,captured=false;
  function onDown(e){
    if(e.pointerType==='mouse'&&e.button!==0)return;
    sx=e.clientX;sy=e.clientY;tracking=true;swiped=false;captured=false;
  }
  function onMove(e){
    if(!tracking)return;
    const dx=e.clientX-sx,dy=e.clientY-sy;
    if(Math.abs(dx)<=Math.abs(dy))return; // more vertical than horizontal — leave it to page scroll
    if(Math.abs(dx)>DEADZONE){
      if(!captured){
        // Only now do we know this is a genuine drag, not a tap — capture
        // the pointer so the gesture tracks correctly even if it leaves the
        // dial. Capturing unconditionally on pointerdown would retarget the
        // native click event of a plain tap away from the button it hit.
        captured=true;
        wrap.classList.add('vp-dragging');
        try{wrap.setPointerCapture(e.pointerId);}catch(err){}
      }
      const nudge=Math.max(-NUDGE_MAX,Math.min(NUDGE_MAX,dx*NUDGE_RATIO));
      wrap.style.transform=`translateX(${nudge}px)`;
    }
    if(Math.abs(dx)>THRESH)swiped=true;
  }
  function onUp(e){
    if(!tracking)return;
    tracking=false;
    if(captured){
      wrap.classList.remove('vp-dragging');
      wrap.style.transform='';
      try{wrap.releasePointerCapture(e.pointerId);}catch(err){}
      captured=false;
    }
    if(swiped){
      const dx=e.clientX-sx;
      swipeVaar(dx<0?1:-1); // swipe left = next day, swipe right = previous day
    }
  }
  function onCancel(e){
    tracking=false;
    if(captured){
      wrap.classList.remove('vp-dragging');wrap.style.transform='';
      try{wrap.releasePointerCapture(e.pointerId);}catch(err){}
      captured=false;
    }
  }
  wrap.addEventListener('pointerdown',onDown,{passive:true});
  wrap.addEventListener('pointermove',onMove,{passive:true});
  wrap.addEventListener('pointerup',onUp,{passive:true});
  wrap.addEventListener('pointercancel',onCancel,{passive:true});
}

// ═══════════════════════════════════════════════════════════════
// COMPUTE
// ═══════════════════════════════════════════════════════════════
function computeAll(){
  const now=new Date();
  const jd=dateToJD(now);
  const vaarStrip=getVaarStrip(now,LAT,LNG);
  const activeVaarIdx=getVedicVaarIdx(now,LAT,LNG);
  const activeVaar=vaarStrip[activeVaarIdx];
  // Compute tithi/nakshatra/yoga for NOW (always today's data)
  const tithiPeriods=getTithiPeriods(jd,10);
  const currentTithiIdx=tithiIdx(jd);
  const nakshatraPeriods=getNakshatraPeriods(jd,4);
  const yogaPeriods=getYogaPeriods(jd,4);
  const karanaPeriods=getKaranaPeriods(jd,6);
  const lunarMonthTithis=getLunarMonthTithis(jd);
  const hm=hinduMonth(jd);
  const am=adhikMaas(jd);
  const ga=gaurabda(now);
  const spVaarEnd=new Date(+activeVaar.sunrise+86400000-96*60*1000);
  const sp=specialYogas(activeVaarIdx,nakshatraPeriods[0]?.index??0,activeVaar.brahmaMuhurtaStart,spVaarEnd);
  return{now,jd,vaarStrip,activeVaarIdx,activeVaar,tithiPeriods,currentTithiIdx,
    nakshatraPeriods,yogaPeriods,karanaPeriods,lunarMonthTithis,hm,am,ga,sp};
}

// ═══════════════════════════════════════════════════════════════
// HELPERS — muhurta list builder (shared)
// ═══════════════════════════════════════════════════════════════
function buildAllMuhurtas(mdToday){
  const nextDayDate=new Date(+mdToday.sunrise+86400000);
  const nextBMStart=new Date(+SunCalc.getTimes(nextDayDate,LAT,LNG).sunrise-96*60*1000);
  const nextBMEnd=new Date(+nextBMStart+48*60*1000);
  const abhijitType=mdToday.wd===2?'warn':'good';
  return[
    {icon:'🌅',label:'Brahma Muhurta',s:mdToday.brahmaMuhurta.start,e:mdToday.brahmaMuhurta.end,type:'good'},
    {icon:'🏆',label:'Abhijit Muhurta',s:mdToday.abhijit.start,e:mdToday.abhijit.end,type:abhijitType},
    {icon:'⚔️',label:'Vijaya Muhurta',s:mdToday.vijaya.start,e:mdToday.vijaya.end,type:'good'},
    {icon:'🌄',label:'Godhuli Muhurta',s:mdToday.godhuli.start,e:mdToday.godhuli.end,type:'good'},
    {icon:'🌙',label:'Nishita Muhurta',s:mdToday.nishita.start,e:mdToday.nishita.end,type:'good'},
    ...(mdToday.amritaKala?[{icon:'✨',label:'Amrita Kala',s:mdToday.amritaKala.start,e:mdToday.amritaKala.end,type:'good'}]:[]),
    {icon:'☠️',label:'Rahu Kalam',s:mdToday.rahuKalam.start,e:mdToday.rahuKalam.end,type:'warn'},
    {icon:'⚰️',label:'Yamaganda',s:mdToday.yamaganda.start,e:mdToday.yamaganda.end,type:'warn'},
    {icon:'🐍',label:'Gulika (Mandi)',s:mdToday.gulika.start,e:mdToday.gulika.end,type:'warn'},
    ...(mdToday.varjyam?[{icon:'🚫',label:'Varjyam / Tyajya',s:mdToday.varjyam.start,e:mdToday.varjyam.end,type:'warn'}]:[]),
    ...mdToday.durMuhurtas.map((d,i)=>({icon:'⚠️',label:`Dur Muhurta ${i+1}`,s:d.start,e:d.end,type:'warn'})),
    {icon:'🌅',label:'Brahma Muhurta',s:nextBMStart,e:nextBMEnd,type:'good'},
  ];
}

// ═══════════════════════════════════════════════════════════════
// ANGA ROW CARDS — 4 angas in a single horizontal row
// each with a collapsible "upcoming" section beneath
// ═══════════════════════════════════════════════════════════════
function buildAngaRowCards(now,tithiPeriods,nakshatraPeriods,yogaPeriods,karanaPeriods,isSelected){
  // Current anga finders
  function curP(arr){return arr.find(p=>+jdToDate(p.startJD)<=+now&&+now<+jdToDate(p.endJD))||arr[0]}
  function nextP(arr,cur){return arr.filter(p=>+jdToDate(p.startJD)>+now).slice(0,3)}
  const timeLeftLabel=isSelected?'at sunrise':'left';

  function durLeft(endJD){
    const ed=jdToDate(endJD);
    if(+ed<=+now)return'';
    return dur(now,ed)+' '+timeLeftLabel;
  }

  const curTithi=curP(tithiPeriods);
  const curNak=curP(nakshatraPeriods);
  const curYoga=curP(yogaPeriods);
  const curKar=curP(karanaPeriods);
  const karFx=KARANA_FX_LOOKUP[curKar.name]||'Half-tithi unit — governs the quality of the lunar half';
  const karWarn=curKar.name==='Vishti';

  // Auspicious/inauspicious colour class per anga current
  const inauspiciousYoga=['Vishkambha','Atiganda','Shula','Ganda','Vajra','Vyatipata','Parigha','Vaidhriti'];
  const yogaWarn=inauspiciousYoga.includes(curYoga.name);

  function angaCard(label,cur,fx,periods,warn){
    const upcoming=periods.filter(p=>+jdToDate(p.startJD)>+now).slice(0,3);
    const endDate=jdToDate(cur.endJD);
    const id='vpc-'+label.toLowerCase().replace(/\s/g,'');
    const leftTxt=durLeft(cur.endJD);
    const upcomingHtml=upcoming.map(p=>{
      const ps=jdToDate(p.startJD),pe=jdToDate(p.endJD);
      return`<div class="vp-anga-upcoming-item">
        <div class="vp-anga-upcoming-dot"></div>
        <div>
          <div class="vp-anga-upcoming-name">${p.name}${p.paksha?' <span style="font-size:.5rem;color:var(--vp-ink-faint)">('+p.paksha+')</span>':''}</div>
          <div class="vp-anga-upcoming-time">${fmt12(ps)} – ${fmtEnd(pe,ps)}</div>
        </div>
      </div>`;
    }).join('');
    return`<div class="vp-anga-card ${warn?'warn':'good'}">
      <div class="vp-anga-card-label">${label} Now</div>
      <div class="vp-anga-card-name">${cur.name}</div>
      ${cur.paksha?`<div class="vp-anga-card-paksha">${cur.paksha} Paksha</div>`:''}
      <div class="vp-anga-card-fx">${fx}</div>
      <div class="vp-anga-card-time">ends ${fmtEnd(endDate,now)}</div>
      ${leftTxt?`<div class="vp-anga-card-left">${leftTxt}</div>`:''}
      ${upcoming.length?`
      <button class="vp-anga-card-toggle" id="btn-${id}" onclick="vpToggleAngaCard('${id}')">
        Next <span class="vp-chevron-sm">▾</span>
      </button>
      <div class="vp-anga-upcoming-wrap" id="${id}">
        ${upcomingHtml}
      </div>`:''}
    </div>`;
  }

  let html='';
  html+=angaCard('Tithi',curTithi,TITHI_FX[curTithi.index],tithiPeriods,false);
  html+=angaCard('Nakshatra',curNak,NAK_FX[curNak.index],nakshatraPeriods,false);
  html+=angaCard('Yoga',curYoga,YOGA_FX[curYoga.index],yogaPeriods,yogaWarn);
  html+=angaCard('Karana',curKar,karFx,karanaPeriods,karWarn);
  return html;
}

window.vpToggleAngaCard=function(id){
  const wrap=document.getElementById(id);
  const btn=document.getElementById('btn-'+id);
  if(!wrap)return;
  wrap.classList.toggle('open');
  if(btn)btn.classList.toggle('vp-anga-toggle-open');
};

// ═══════════════════════════════════════════════════════════════
// CURRENT MUHURTA BANNER — smart conflict resolution
// ═══════════════════════════════════════════════════════════════
function buildCurrentMuhurtaBanner(now,allM,isSelected){
  if(isSelected)return'';
  const active=allM.filter(m=>now>=m.s&&now<m.e);
  if(!active.length)return'';

  const goods=active.filter(m=>m.type==='good');
  const warns=active.filter(m=>m.type==='warn');

  function timeRemaining(m){
    const mins=Math.round((+m.e-+now)/60000);
    return mins<60?mins+'m left':Math.floor(mins/60)+'h '+(mins%60?mins%60+'m':'')+' left';
  }
  function timeRange(m){return`${fmt12(m.s)} – ${fmtEnd(m.e,m.s)}`}

  // Conflict: both good and warn active simultaneously
  if(goods.length&&warns.length){
    const g=goods[0];
    const w=warns[0];
    // Decision: inauspicious overrides for new starts; auspicious good for ongoing work
    const adviceGood='✅ Good for ongoing work & prayer';
    const adviceWarn='⛔ Avoid new starts & decisions';
    let html=`<div class="vp-current-banner conflict">
      <div class="vp-cb-dot"></div>
      <div class="vp-cb-body">
        <div class="vp-cb-eyebrow">⚖️ Mixed — Good &amp; Inauspicious Overlap</div>
        <div class="vp-cb-name">${g.icon||'🌅'} ${g.label} &amp; ${w.icon||'⚠️'} ${w.label}</div>
        <div class="vp-cb-desc">${MEFF[g.label]||''} — but ${(MEFF[w.label]||'inauspicious period').toLowerCase()} is also active.</div>
        <div class="vp-cb-advice">${adviceGood}</div>
        <div class="vp-cb-advice" style="margin-top:4px">${adviceWarn}</div>
        <div class="vp-cb-time">${g.label}: ${timeRange(g)} · ${timeRemaining(g)}</div>
        <div class="vp-cb-time">${w.label}: ${timeRange(w)} · ${timeRemaining(w)}</div>
      </div>
    </div>`;
    // Additional overlapping items
    const extras=[...goods.slice(1),...warns.slice(1)];
    if(extras.length){
      html=html.slice(0,-6)+'<div class="vp-cb-also">Also active: '+
        extras.map(e=>`<span class="vp-cb-also-item ${e.type==='good'?'good':''}">${e.icon||''} ${e.label}</span>`).join('')+
        '</div></div></div>';
    }
    return html;
  }

  // Only inauspicious
  if(warns.length&&!goods.length){
    const w=warns[0];
    const avoidText='⛔ Avoid new beginnings, auspicious rites & important decisions';
    let html=`<div class="vp-current-banner inaup">
      <div class="vp-cb-dot"></div>
      <div class="vp-cb-body">
        <div class="vp-cb-eyebrow">Inauspicious Active</div>
        <div class="vp-cb-name">${w.icon||'⚠️'} ${w.label}</div>
        <div class="vp-cb-desc">${MEFF[w.label]||''}</div>
        <div class="vp-cb-advice">${avoidText}</div>
        <div class="vp-cb-time">${timeRange(w)} · ${timeRemaining(w)}</div>
      </div>
    </div>`;
    if(warns.length>1){
      html=html.slice(0,-6)+'<div class="vp-cb-also">Also: '+
        warns.slice(1).map(e=>`<span class="vp-cb-also-item">${e.icon||''} ${e.label}</span>`).join('')+
        '</div></div></div>';
    }
    return html;
  }

  // Only auspicious
  if(goods.length){
    const g=goods[0];
    const doText='✅ Excellent — proceed with confidence';
    let html=`<div class="vp-current-banner ausp">
      <div class="vp-cb-dot"></div>
      <div class="vp-cb-body">
        <div class="vp-cb-eyebrow">Auspicious Active</div>
        <div class="vp-cb-name">${g.icon||'🌅'} ${g.label}</div>
        <div class="vp-cb-desc">${MEFF[g.label]||''}</div>
        <div class="vp-cb-advice">${doText}</div>
        <div class="vp-cb-time">${timeRange(g)} · ${timeRemaining(g)}</div>
      </div>
    </div>`;
    if(goods.length>1){
      html=html.slice(0,-6)+'<div class="vp-cb-also">Also active: '+
        goods.slice(1).map(e=>`<span class="vp-cb-also-item good">${e.icon||''} ${e.label}</span>`).join('')+
        '</div></div></div>';
    }
    return html;
  }
  return'';
}

// ═══════════════════════════════════════════════════════════════
// UPCOMING LIST — serial order, gold/violet color coded
// ═══════════════════════════════════════════════════════════════
function buildUpcomingList(now,allM,isSelected){
  const future=allM.filter(m=>m.s>now).sort((a,b)=>+a.s-+b.s).slice(0,8);
  if(!future.length)return'<div style="padding:12px;text-align:center;font-size:.76rem;color:var(--vp-ink-faint)">No upcoming periods today</div>';

  function soonStr(m){
    const mins=Math.round((+m.s-+now)/60000);
    if(mins<60)return`in ${mins}m`;
    return`in ${Math.floor(mins/60)}h${mins%60?' '+mins%60+'m':''}`;
  }

  return future.map((m,i)=>{
    const isAusp=m.type==='good';
    const cls=isAusp?'ausp':'inaup';
    return`<div class="vp-upcoming-row ${cls}">
      <div class="vp-upcoming-serial">${i+1}</div>
      <div class="vp-upcoming-icon">${m.icon||'⏰'}</div>
      <div class="vp-upcoming-body">
        <div class="vp-upcoming-label">${m.label}</div>
        <div class="vp-upcoming-desc">${MEFF[m.label]||''}</div>
        <div class="vp-upcoming-timeblock">${fmt12(m.s)} – ${fmtEnd(m.e,m.s)}</div>
        <div class="vp-upcoming-dur">${dur(m.s,m.e)} duration</div>
      </div>
      <div class="vp-upcoming-right">
        <span class="vp-in-pill">${soonStr(m)}</span>
      </div>
    </div>`;
  }).join('');
}

// Legacy stub — kept so any remaining callers don't break
function buildNowPanel(now,tithiPeriods,nakshatraPeriods,yogaPeriods,karanaPeriods,mdToday,isSelected){
  return'';
}

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════
function renderAll(){
  if(!DATA)return;
  const{now,jd,vaarStrip,activeVaarIdx,activeVaar,tithiPeriods,currentTithiIdx,
    nakshatraPeriods,yogaPeriods,karanaPeriods,lunarMonthTithis,hm,am,ga,sp}=DATA;

  // Which vaar to DISPLAY (for muhurtas/day bounds)
  const displayVaarIdx=selectedVaarIdx!==null?selectedVaarIdx:activeVaarIdx;
  const displayVaar=vaarStrip[displayVaarIdx];
  const isActive=displayVaarIdx===activeVaarIdx;

  // Muhurta data for the DISPLAYED vaar
  const md=getMuhurtaData(displayVaar,LAT,LNG);
  const headerRef=isActive?now:displayVaar.sunrise;
  const headerJD=dateToJD(headerRef);
  const headerHM=hinduMonth(headerJD);
  const headerAM=adhikMaas(headerJD);
  const headerPaksha=tithiIdx(headerJD)<15?'Sukla':'Krishna';
  const headerWhen=isActive?'Today':(displayVaar.dayOffset===1?'Tomorrow':displayVaar.dayOffset===-1?'Yesterday':displayVaar.dayOffset>0?'+'+displayVaar.dayOffset+' days':displayVaar.dayOffset+' days');

  // Header follows selected Vaar so the month/date context is clear
  document.getElementById('vp-gaurabda').textContent='Gaurabda '+gaurabda(headerRef);
  document.getElementById('vp-vaar-name').textContent=displayVaar.name+' Vaar';
  document.getElementById('vp-month-line').innerHTML=
    (headerAM.isAdhik?`<span class="vp-adhik-badge">${headerAM.isPurushottam?'Purushottam':'Adhik'}</span>${headerAM.nextMonthName}`:headerHM.name)+
    ' &nbsp;·&nbsp; '+headerPaksha+' Paksha &nbsp;·&nbsp; '+headerWhen+' '+fmtDate(headerRef);
  document.getElementById('vp-vaishnav-line').textContent='Vaishnav Month of '+headerHM.vaishnavName;

  // Orbit dial — 7 planetary days arranged on a ring, active day at top (12 o'clock).
  // Center shows whichever day is currently being viewed (today, or the selected one).
  const orbitWrap=document.getElementById('vp-orbit-wrap');
  const RADIUS=104; // px from center to each orbit button's center
  let orbitHTML='';
  vaarStrip.forEach(v=>{
    // Position relative to the active (today) day so "today" always sits at 12 o'clock,
    // and the week reads clockwise from there.
    const posIdx=((v.index-activeVaarIdx)+7)%7;
    const angleDeg=posIdx*(360/7)-90; // -90 so position 0 (today) is at the top
    const rad=angleDeg*Math.PI/180;
    const x=Math.cos(rad)*RADIUS, y=Math.sin(rad)*RADIUS;
    let cls='vp-orbit-btn';
    if(v.isActive)cls+=' today';
    if(selectedVaarIdx!==null&&v.index===selectedVaarIdx)cls+=' selected';
    const dayLabel=v.dayOffset===0?'Today':v.dayOffset===1?'Tmrw':v.dayOffset===-1?'Yest':
      v.dayOffset>0?'+'+v.dayOffset+'d':v.dayOffset+'d';
    orbitHTML+=`<button class="${cls}" data-vaar="${v.index}" style="transform:translate(${x}px,${y}px)" onclick="vpSelectVaar(${v.index})" title="${v.name} Vaar — ${dayLabel}" aria-label="${v.name} Vaar, ${dayLabel}">
      <span class="vp-ob-icon">${VAAR_ICON[v.index]}</span>
      <span class="vp-ob-day">${dayLabel}</span>
    </button>`;
  });
  // Keep the static ring/center markup, just refresh the orbit buttons after it
  orbitWrap.querySelectorAll('.vp-orbit-btn').forEach(b=>b.remove());
  orbitWrap.insertAdjacentHTML('beforeend',orbitHTML);
  initOrbitSwipe(orbitWrap);
  document.getElementById('vp-orbit-center-icon').textContent=VAAR_ICON[displayVaarIdx];
  document.getElementById('vp-orbit-center-label').textContent=displayVaar.name;
  document.getElementById('vp-orbit-center-sub').textContent=headerWhen;

  // Now panel — uses selected vaar if chosen, else current moment
  let panelRef, panelTithiP, panelNakP, panelYogaP, panelKarP, panelMd, panelLabel;
  if(!isActive){
    // Compute panchanga at the selected vaar's SUNRISE so all data is correct for that day
    const refTime=displayVaar.sunrise;
    const refJD=dateToJD(refTime);
    panelRef=refTime;
    panelTithiP=getTithiPeriods(refJD,6);
    panelNakP=getNakshatraPeriods(refJD,4);
    panelYogaP=getYogaPeriods(refJD,4);
    panelKarP=getKaranaPeriods(refJD,6);
    panelMd=md;
    const off=displayVaar.dayOffset;
    const when=off===1?'Tomorrow':off===-1?'Yesterday':off>0?'+'+off+' days':off+' days';
    panelLabel=displayVaar.name+' Vaar &nbsp;<span style="font-weight:400;opacity:.6">('+when+' &middot; '+fmtDate(displayVaar.sunrise)+')</span>';
  }else{
    panelRef=now;
    panelTithiP=tithiPeriods;
    panelNakP=nakshatraPeriods;
    panelYogaP=yogaPeriods;
    panelKarP=karanaPeriods;
    panelMd=md;
    panelLabel='Right Now &amp; Coming Soon';
  }
  document.getElementById('vp-now-panel-title').innerHTML=panelLabel;

  // ── 4 Anga cards in one row ──────────────────────────────────
  document.getElementById('vp-anga-row-cards').innerHTML=
    buildAngaRowCards(panelRef,panelTithiP,panelNakP,panelYogaP,panelKarP,!isActive);

  // ── Build unified muhurta list ────────────────────────────────
  const allM=buildAllMuhurtas(panelMd);

  // ── Current muhurta banner ────────────────────────────────────
  document.getElementById('vp-current-muhurta-wrap').innerHTML=
    buildCurrentMuhurtaBanner(panelRef,allM,!isActive);

  // ── Upcoming list — serial, gold/violet ───────────────────────
  const upcomingSection=document.getElementById('vp-upcoming-section');
  const upcomingList=document.getElementById('vp-upcoming-list');
  if(isActive){
    upcomingSection.style.display='block';
    upcomingList.innerHTML=buildUpcomingList(panelRef,allM,false);
  }else{
    // For selected vaar, show all muhurtas in order (from sunrise)
    upcomingSection.style.display='block';
    const allFromSR=allM.filter(m=>m.s>=panelRef).sort((a,b)=>+a.s-+b.s).slice(0,8);
    upcomingList.innerHTML=allFromSR.length?allFromSR.map((m,i)=>{
      const cls=m.type==='good'?'ausp':'inaup';
      return`<div class="vp-upcoming-row ${cls}">
        <div class="vp-upcoming-serial">${i+1}</div>
        <div class="vp-upcoming-icon">${m.icon||'⏰'}</div>
        <div class="vp-upcoming-body">
          <div class="vp-upcoming-label">${m.label}</div>
          <div class="vp-upcoming-desc">${MEFF[m.label]||''}</div>
          <div class="vp-upcoming-timeblock">${fmt12(m.s)} – ${fmtEnd(m.e,m.s)}</div>
          <div class="vp-upcoming-dur">${dur(m.s,m.e)} duration</div>
        </div>
      </div>`;
    }).join(''):'<div style="padding:12px;text-align:center;font-size:.76rem;color:var(--vp-ink-faint)">No upcoming periods</div>';
  }

  // Viewing bar
  const vb=document.getElementById('vp-viewing-bar');
  if(!isActive){
    vb.style.display='block';
    const off=displayVaar.dayOffset;
    const when=off===1?'Tomorrow':off===-1?'Yesterday':off>0?'+'+off+' days':off+' days';
    document.getElementById('vp-viewing-label').textContent=`${displayVaar.name} Vaar (${when})`;
  }else{vb.style.display='none';}

  // Lunar month grid
  const sukla=lunarMonthTithis.filter(t=>t.paksha==='Sukla');
  const krishna=lunarMonthTithis.filter(t=>t.paksha==='Krishna');
  document.getElementById('vp-month-grid').innerHTML=
    `<div class="vp-paksha-label s">Sukla Paksha — Waxing Moon</div>`+
    sukla.map((t,i)=>tCell(t,i+1,t.index===currentTithiIdx,'S')).join('')+
    `<div class="vp-paksha-label k">Krishna Paksha — Waning Moon</div>`+
    krishna.map((t,i)=>tCell(t,i+1,t.index===currentTithiIdx,'K')).join('');

  // Day boundaries — collapsible
  document.getElementById('vp-db-grid').innerHTML=[
    {icon:'🌄',label:'Brahma Muhurta',s:md.brahmaMuhurta.start,e:md.brahmaMuhurta.end},
    {icon:'☀️',label:'Sunrise',s:md.sunrise,e:null},
    {icon:'🌇',label:'SandhyaKal',s:md.sunrise,e:md.sandhyaEnd},
    {icon:'🌆',label:'Sunset',s:md.sunset,e:null},
    {icon:'🌇',label:'Sunset Sandhya',s:md.sunsetSandhyaStart,e:md.sunset},
    {icon:'🌕',label:'Moonrise',s:md.moonrise,e:null},
    {icon:'🌑',label:'Moonset',s:md.moonset,e:null},
    {icon:'🔆',label:'Solar Noon',s:md.noon,e:null},
  ].map(x=>`<div class="vp-db-card">
    <div class="vp-db-label">${x.icon} ${x.label}</div>
    <div class="vp-db-time">${fmtDT(x.s)}${x.e?`<span class="vp-sub"><br>– ${fmtEnd(x.e,x.s)}</span>`:''}</div>
  </div>`).join('');

  // Special yogas — recompute for displayVaar (may differ from activeVaar)
  let spDisplay=sp;
  if(!isActive){
    const dispNakIdx=Math.floor(moonLongSid(dateToJD(displayVaar.sunrise))/(360/27))%27;
    const dispVaarEnd=new Date(+displayVaar.sunrise+86400000-96*60*1000);
    spDisplay=specialYogas(displayVaar.index,dispNakIdx,displayVaar.brahmaMuhurtaStart,dispVaarEnd);
  }
  const sec=document.getElementById('vp-special-yoga-sec');
  if(spDisplay.length){
    sec.style.display='block';
    document.getElementById('vp-yoga-cards').innerHTML=spDisplay.map(y=>`
      <div class="vp-yoga-card">
        <div class="vp-yoga-icon">${y.symbol}</div>
        <div>
          <div class="vp-yoga-name">${y.name}</div>
          <div class="vp-yoga-desc">${y.desc}</div>
          ${y.start?`<div class="vp-yoga-time">${fmtDate(y.start)} ${fmt12(y.start)} – ${fmtEnd(y.end,y.start)}</div>`:''}
        </div>
      </div>`).join('');
  }else{sec.style.display='none';}
}

function tCell(t,num,isActive,prefix){
  const sd=jdToDate(t.startJD),ed=jdToDate(t.endJD);
  return`<div class="vp-tcell${isActive?' active':''}">
    <div class="vp-tcell-top">
      <span class="vp-tcell-num">${prefix}${num}</span>
      ${isActive?'<span class="vp-now-badge">Now</span>':''}
    </div>
    <div class="vp-tcell-name">${t.name}</div>
    <div class="vp-tcell-start">${fmtDate(sd)} ${fmt12(sd)}</div>
    <div class="vp-tcell-end">→ ${fmtEnd(ed,sd)}</div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
function showLoadError(msg){
  document.getElementById('vp-load-spinner').style.display='none';
  const el=document.getElementById('vp-load-error');
  el.style.display='block';
  if(msg) el.querySelector('.err-msg').innerHTML=msg;
}

function init(){
  // Guard: SunCalc must be loaded (CDN might be slow/offline)
  if(typeof SunCalc==='undefined'){
    showLoadError('SunCalc library not loaded.<br>Check your connection and retry.');
    return;
  }
  try{
    DATA=computeAll();
    document.getElementById('loading').style.display='none';
    document.getElementById('main').style.display='block';
    renderAll();
  }catch(e){
    console.error('Panchanga init error:',e);
    showLoadError('Calculation error: '+e.message+'<br><br>Please retry.');
  }
}

// refresh handled by vpStartRefresh/vpStopRefresh

// init handled by vpTryInit above


// ── Public API ───────────────────────────────────────────────
window.vpSelectVaar = function(idx) { selectVaar(idx); };
window.vpClearSelectedVaar = function() { clearSelectedVaar(); };
window.vpSelectAnga = function(name) { selectedAnga = name; renderAll(); };
window.vpToggleGrid = function() {
  const w = document.getElementById('vp-month-grid-wrap');
  const b = document.getElementById('vp-tithi-toggle');
  if(w) w.classList.toggle('open');
  if(b) b.classList.toggle('open');
};

window.vpToggleDayBoundaries = function() {
  const w = document.getElementById('vp-db-wrap');
  const b = document.getElementById('vp-db-toggle');
  if(w) w.classList.toggle('open');
  if(b) b.classList.toggle('open');
};

// ── GPS-based location for the Panchanga engine ──────────────────────
// Reads live globals first (freshest, set by the main app's GPS toggle),
// falling back to the same localStorage keys the GPS toggle persists to —
// this matters because this script block can run/refresh before the main
// app.js init has had a chance to seed window._appLat/_appLng on this page
// load.
function vpGetCachedCoords() {
  if (window._appLat && window._appLng) return { lat: window._appLat, lng: window._appLng };
  try {
    const la = parseFloat(localStorage.getItem('rjap_lastLat'));
    const ln = parseFloat(localStorage.getItem('rjap_lastLng'));
    if (!isNaN(la) && !isNaN(ln)) return { lat: la, lng: ln };
  } catch (e) {}
  return null;
}
function vpIsGpsEnabled() {
  try { return localStorage.getItem('rjap_gps_enabled') === '1'; } catch (e) { return false; }
}
window.vpUpdateLocLabel = function() {
  const el = document.getElementById('vp-loc-text');
  const c = vpGetCachedCoords();
  if (c) {
    LAT = c.lat; LNG = c.lng;
    window._appLat = c.lat; window._appLng = c.lng;
    if (el) el.textContent = c.lat.toFixed(3) + '°N ' + c.lng.toFixed(3) + '°E';
  } else if (el) {
    el.textContent = vpIsGpsEnabled() ? 'Detecting your location…' : 'Default location — enable GPS in Settings';
  }
};
window._vpGpsFetchInFlight = false;
window.vpEnsureGps = function() {
  // Only step in when the user has already granted GPS via the Settings
  // toggle but we don't yet have coordinates on this page load (e.g. this
  // script ran before app.js finished seeding window._appLat/_appLng, or
  // the previous fix attempt timed out). This never prompts for permission
  // on its own — the GPS toggle remains the sole source of consent.
  if (vpGetCachedCoords()) return;
  if (!vpIsGpsEnabled() || window._vpGpsFetchInFlight || !navigator.geolocation) return;
  window._vpGpsFetchInFlight = true;
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      window._vpGpsFetchInFlight = false;
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      window._appLat = lat; window._appLng = lng;
      try {
        localStorage.setItem('rjap_lastLat', String(lat));
        localStorage.setItem('rjap_lastLng', String(lng));
      } catch (e) {}
      window.vpUpdateLocLabel();
      try { DATA = computeAll(); renderAll(); } catch (e) {}
    },
    function() {
      window._vpGpsFetchInFlight = false;
      const el = document.getElementById('vp-loc-text');
      if (el) el.textContent = 'Location unavailable — check GPS permission';
    },
    { timeout: 10000, maximumAge: 60000 },
  );
};

window.vpActivate = function() {
  window.vpUpdateLocLabel();
  window.vpEnsureGps();
  try { DATA = computeAll(); renderAll(); } catch(e) { console.error('VP render error:', e); }
};

window._vpClockInterval = null;
window.vpStartClock = function() {
  if(window._vpClockInterval) return;
  window._vpClockInterval = setInterval(function() {
    const el = document.getElementById('vp-clock');
    if(el) el.textContent = new Date().toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true});
  }, 1000);
  const el = document.getElementById('vp-clock');
  if(el) el.textContent = new Date().toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true});
};
window.vpStopClock = function() {
  clearInterval(window._vpClockInterval);
  window._vpClockInterval = null;
};

window._vpRefreshInterval = null;
window.vpStartRefresh = function() {
  if(window._vpRefreshInterval) return;
  window._vpRefreshInterval = setInterval(function() {
    window.vpUpdateLocLabel();
    window.vpEnsureGps();
    try { DATA = computeAll(); renderAll(); } catch(e) {}
  }, 30000);
};
window.vpStopRefresh = function() {
  clearInterval(window._vpRefreshInterval);
  window._vpRefreshInterval = null;
};

// Initial load if SunCalc ready
function vpTryInit() {
  if(typeof SunCalc === 'undefined') { setTimeout(vpTryInit, 400); return; }
  window.vpUpdateLocLabel();
  window.vpEnsureGps();
  try { DATA = computeAll(); } catch(e) { console.error('VP init error:', e); }
}
vpTryInit();

})();

    /* === END ORIGINAL ENGINE === */
  }
})();
