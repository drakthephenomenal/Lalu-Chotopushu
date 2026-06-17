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
const VAAR_ICON=['☀️','🌙','🔴','💚','🪐','⭐','💙'];
const VAAR_BN=['রবি','সোম','মঙ্গল','বুধ','বৃহস্পতি','শুক্র','শনি'];
const HM=['Chaitra','Vaishakha','Jyeshtha','Ashadha','Shravana','Bhadrapada','Ashwina','Kartika','Margashirsha','Pausha','Magha','Phalguna'];
const VM=['Vishnu','Madhusudana','Trivikrama','Vamana','Shridhara','Hrishikesha','Padmanabha','Damodara','Keshava','Narayana','Madhava','Govinda'];

// Tithi effects
const TITHI_FX=['New beginning, auspicious start','Prosperity & growth','Victory & success','Danger — avoid important work','Auspicious for all good deeds','Good for social gatherings','Win over enemies, good travel','Mixed — caution for new work','Completing pending tasks','Excellent for all activities','Ekadashi fast — highly sacred','Breaking fast, gifts & charity','Avoid new ventures','Ancestral worship, sacred','Full Moon — very auspicious',
'New beginning after full moon','Growth of plans','Success in undertakings','Obstacle — delay decisions','Auspicious, creative work','Pleasant, social activities','Overcoming adversaries','Eight directions — be cautious','Completion of tasks','Good for regular activities','Ekadashi fast — sacred vrat','Post Ekadashi, charity','Avoid new ventures','Ancestral rites','New Moon — worship ancestors'];
const NAK_FX=['Swift & fierce, good for bold acts','Fierce, avoid auspicious deeds','Mixed, good for cooking & fire','Very auspicious, love & growth','Gentle, good for creativity','Sharp, removal & healing work','Auspicious, renew & restore','Excellent for all beginnings','Sharp, avoid new activities','Good for old work & traditions','Pleasant, arts & romance','Stable, sacred ceremonies','Mobile, journey & trading','Sharp, piercing tasks','Good for moving & travel','Auspicious, spiritual growth','Devotion & fixed tasks','Sharp, fierce activities','Fierce, avoid auspicious deeds','Speed & travel, good for haste','Fixed, stable ceremonies','Good for learning & devotion','Quick, good for moving tasks','Severe, purification tasks','Fierce, avoid major starts','Fixed, stable ceremonies','Gentle, renewal & auspicious'];
const YOGA_FX=['Inauspicious — obstacles likely','Love & friendliness abound','Longevity & health favored','Good fortune in all matters','Prosperous & beautiful time','Anger & sudden obstacles','Good deeds bring results','Stability & determination','Thorny path — avoid big moves','Obstacles & health issues','Growth & financial gain','Fixed & stable, good for vows','Sudden setbacks possible','Joy & happiness prevail','Sudden dangers — be careful','Success in all endeavors','Highly inauspicious — avoid','Very auspicious & favorable','Encircling obstacles to remove','Auspicious, Shiva-blessed','Success with effort','Achievement of goals','Auspicious for good deeds','Pure & clean time','Brahma-blessed — sacred deeds','Indra-blessed — victory','Highly inauspicious — avoid'];
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
// NOW PANEL — always uses real current time
// ═══════════════════════════════════════════════════════════════
function buildNowPanel(now,tithiPeriods,nakshatraPeriods,yogaPeriods,karanaPeriods,mdToday,isSelected){
  const jd=dateToJD(now);
  // Current tithi
  const curTithi=tithiPeriods.find(p=>+jdToDate(p.startJD)<=+now&&+now<+jdToDate(p.endJD))
    ||tithiPeriods[0];
  // Next tithi
  const nextTithi=tithiPeriods.find(p=>+jdToDate(p.startJD)>+now);
  // Current nakshatra
  const curNak=nakshatraPeriods.find(p=>+jdToDate(p.startJD)<=+now&&+now<+jdToDate(p.endJD))
    ||nakshatraPeriods[0];
  // Current yoga
  const curYoga=yogaPeriods.find(p=>+jdToDate(p.startJD)<=+now&&+now<+jdToDate(p.endJD))
    ||yogaPeriods[0];
  // Current karana
  const curKarana=karanaPeriods.find(p=>+jdToDate(p.startJD)<=+now&&+now<+jdToDate(p.endJD))
    ||karanaPeriods[0];

  // All muhurtas from today
  // Also compute next day's Brahma Muhurta so "Coming Soon" works after midnight/late night
  const nextDayDate=new Date(+mdToday.sunrise+86400000);
  const nextDaySR=SunCalc.getTimes(nextDayDate,mdToday.sunrise.lat||LAT,mdToday.sunrise.lng||LNG);
  // Re-use the passed-in lat/lng via closure (LAT/LNG are global)
  const nextBMStart=new Date(+SunCalc.getTimes(nextDayDate,LAT,LNG).sunrise-96*60*1000);
  const nextBMEnd=new Date(+nextBMStart+48*60*1000);
  // Tuesday (Mangol Vaar, wd=2) — classical rule: Abhijit Muhurta is itself
  // inauspicious on Tuesday ("Anabhijit"), so we flag it as warn instead of good.
  const abhijitType=mdToday.wd===2?'warn':'good';
  const allM=[
    {label:'Brahma Muhurta',s:mdToday.brahmaMuhurta.start,e:mdToday.brahmaMuhurta.end,type:'good'},
    {label:'Abhijit Muhurta',s:mdToday.abhijit.start,e:mdToday.abhijit.end,type:abhijitType},
    {label:'Vijaya Muhurta',s:mdToday.vijaya.start,e:mdToday.vijaya.end,type:'good'},
    {label:'Godhuli Muhurta',s:mdToday.godhuli.start,e:mdToday.godhuli.end,type:'good'},
    {label:'Nishita Muhurta',s:mdToday.nishita.start,e:mdToday.nishita.end,type:'good'},
    ...(mdToday.amritaKala?[{label:'Amrita Kala',s:mdToday.amritaKala.start,e:mdToday.amritaKala.end,type:'good'}]:[]),
    {label:'Rahu Kalam',s:mdToday.rahuKalam.start,e:mdToday.rahuKalam.end,type:'warn'},
    {label:'Yamaganda',s:mdToday.yamaganda.start,e:mdToday.yamaganda.end,type:'warn'},
    {label:'Gulika (Mandi)',s:mdToday.gulika.start,e:mdToday.gulika.end,type:'warn'},
    ...(mdToday.varjyam?[{label:'Varjyam / Tyajya',s:mdToday.varjyam.start,e:mdToday.varjyam.end,type:'warn'}]:[]),
    ...mdToday.durMuhurtas.map((d,i)=>({label:`Dur Muhurta ${i+1}`,s:d.start,e:d.end,type:'warn'})),
    // Next day's BM so "Coming Soon" is never empty in the post-midnight/pre-BM window
    {label:'Brahma Muhurta',s:nextBMStart,e:nextBMEnd,type:'good'},
  ];
  // For selected vaar use sunrise as reference; for today use current time
  const refForMuhurta=now;
  // Multiple muhurtas can be active simultaneously (e.g. Abhijit overlaps Dur Muhurta 2).
  // Show every active period — auspicious AND inauspicious — separately so the user sees both.
  const activeAll=isSelected?[]:allM.filter(m=>refForMuhurta>=m.s&&refForMuhurta<m.e);
  const activeGood=activeAll.find(m=>m.type==='good');
  const activeWarns=activeAll.filter(m=>m.type==='warn');

  function timeStr(start,end){
    return `${fmtDate(start)} ${fmt12(start)} – ${fmtEnd(end,start)}<br><span style="color:rgba(245,209,122,.85)">${dur(start,end)} duration</span>`;
  }

  function cell(label,name,fx,timeHTML,cls=''){
    return`<div class="vp-now-cell ${cls}">
      <div class="vp-now-cell-top"><div class="vp-now-cell-label">${label}</div></div>
      <div class="vp-now-cell-name">${name}</div>
      <div class="vp-now-cell-effect">${fx}</div>
      <div class="vp-now-cell-time">${timeHTML}</div>
    </div>`;
  }
  function cellWithStatus(label,status,statusCls,name,fx,timeHTML,cls=''){
    return`<div class="vp-now-cell ${cls}">
      <div class="vp-now-cell-top"><div class="vp-now-cell-label">${label}</div><span class="vp-now-cell-status ${statusCls}">${status}</span></div>
      <div class="vp-now-cell-name">${name}</div>
      <div class="vp-now-cell-effect">${fx}</div>
      <div class="vp-now-cell-time">${timeHTML}</div>
    </div>`;
  }

  const nowLabel=isSelected?'At Sunrise':'Now';
  const timeLeftLabel=isSelected?'during sunrise':'left';
  let html='';
  // Tithi
  html+=cell('Tithi '+nowLabel,
    curTithi.name+' <small style="font-size:.6rem;color:var(--muted)">'+curTithi.paksha+'</small>',
    TITHI_FX[curTithi.index],
    `ends ${fmtEnd(jdToDate(curTithi.endJD),now)}<br><span style="color:rgba(245,209,122,.85)">${dur(now,jdToDate(curTithi.endJD))} ${timeLeftLabel}</span>`,'good');
  // Nakshatra
  html+=cell('Nakshatra '+nowLabel,curNak.name,
    NAK_FX[curNak.index],
    `ends ${fmtEnd(jdToDate(curNak.endJD),now)}<br><span style="color:rgba(245,209,122,.85)">${dur(now,jdToDate(curNak.endJD))} ${timeLeftLabel}</span>`,'good');
  // Yoga
  html+=cell('Yoga '+nowLabel,curYoga.name,
    YOGA_FX[curYoga.index],
    `ends ${fmtEnd(jdToDate(curYoga.endJD),now)}<br><span style="color:rgba(245,209,122,.85)">${dur(now,jdToDate(curYoga.endJD))} ${timeLeftLabel}</span>`,'');
  // Karana effects lookup
  const KARANA_FX={
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
  const karFx=KARANA_FX[curKarana.name]||'Half-tithi unit — governs the quality of the lunar half';
  const karCls=curKarana.name==='Vishti'?'warn':'';
  // Karana
  html+=cell('Karana '+nowLabel,curKarana.name,
    karFx,
    `ends ${fmtEnd(jdToDate(curKarana.endJD),now)}<br><span style="color:rgba(245,209,122,.85)">${dur(now,jdToDate(curKarana.endJD))} ${timeLeftLabel}</span>`,karCls);

  // Active muhurta — render auspicious and inauspicious separately when both overlap
  if(activeGood){
    html+=cellWithStatus('Muhurta Active','● Now','active',
      activeGood.label,MEFF[activeGood.label]||'',
      timeStr(activeGood.s,activeGood.e),'good');
  }
  activeWarns.forEach(aw=>{
    html+=cellWithStatus('Inauspicious Active','● Now','active',
      aw.label,MEFF[aw.label]||'',
      timeStr(aw.s,aw.e),'warn');
  });


  if(!isSelected){
    // Upcoming muhurtas — show next auspicious AND next TWO inauspicious separately
    const futureM=allM.filter(m=>m.s>refForMuhurta).sort((a,b)=>a.s-b.s);
    const nextGood=futureM.find(m=>m.type==='good');
    const nextWarns=futureM.filter(m=>m.type==='warn').slice(0,2);

    function soonTag(m){
      const mins=Math.round((+m.s-+now)/60000);
      return mins<60?`in ${mins}m`:`in ${Math.floor(mins/60)}h${mins%60?' '+mins%60+'m':''}`;
    }

    if(nextGood){
      html+=cellWithStatus('Coming Soon — Auspicious',soonTag(nextGood),'soon',
        nextGood.label,
        MEFF[nextGood.label]||'',
        timeStr(nextGood.s,nextGood.e),
        'good');
    }
    nextWarns.forEach(nw=>{
      html+=cellWithStatus('Coming Soon — Inauspicious',soonTag(nw),'warn-soon',
        nw.label,
        MEFF[nw.label]||'',
        timeStr(nw.s,nw.e),
        'warn');
    });
  } else {
    // Selected vaar — show first muhurta of day
    const nextMuhurta=allM.filter(m=>m.s>refForMuhurta).sort((a,b)=>a.s-b.s)[0];
    if(nextMuhurta){
      html+=cellWithStatus('First Muhurta of Day',fmtDate(nextMuhurta.s),'soon',
        nextMuhurta.label,
        MEFF[nextMuhurta.label]||'',
        timeStr(nextMuhurta.s,nextMuhurta.e),
        nextMuhurta.type==='warn'?'warn':'');
    }
  }
  return html;
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

  // Vaar strip — highlight today and selected separately
  document.getElementById('vp-vaar-strip').innerHTML=vaarStrip.map(v=>{
    let cls='';
    if(v.isActive)cls='today';
    if(selectedVaarIdx!==null&&v.index===selectedVaarIdx)cls='selected';
    const dayLabel=v.dayOffset===0?'Today':v.dayOffset===1?'Tmrw':v.dayOffset===-1?'Yest':
      v.dayOffset>0?'+'+v.dayOffset+'d':v.dayOffset+'d';
    return`<button class="vp-vaar-btn ${cls}" data-vaar="${v.index}" onclick="vpSelectVaar(${v.index})">
      ${v.isActive?'<span class="vp-vaar-ring" aria-hidden="true"></span>':''}
      <span class="vp-vi">${VAAR_ICON[v.index]}</span>
      <span class="vp-vn">${v.name}</span>
      <span class="vp-vd">${dayLabel}</span>
    </button>`;
  }).join('');

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
  document.getElementById('vp-now-grid').innerHTML=buildNowPanel(panelRef,panelTithiP,panelNakP,panelYogaP,panelKarP,panelMd,!isActive);

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

  // Day boundaries — from DISPLAYED vaar
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

  // Tithi rows — for the DISPLAYED vaar's vedic day window
  // Use panelTithiP which is already computed for the correct vaar (today or selected)
  const bmStart=+displayVaar.brahmaMuhurtaStart;
  const nextDayBM=+new Date(+displayVaar.sunrise+86400000-96*60*1000);
  const rel=panelTithiP.filter(p=>+jdToDate(p.endJD)>bmStart&&+jdToDate(p.startJD)<nextDayBM);
  const nextVaarName=VAAR[(displayVaarIdx+1)%7];
  document.getElementById('vp-tithi-rows').innerHTML=rel.map(p=>{
    const sd=jdToDate(p.startJD),ed=jdToDate(p.endJD);
    const cs=new Date(Math.max(+sd,bmStart)),ce=new Date(Math.min(+ed,nextDayBM));
    const label=`${fmtDT(cs)}<br>– ${fmtDT(ce)}`;
    const isK=p.paksha==='Krishna';
    const relPill=isActive?relHTML(cs,ce,now):'';
    return`<div class="vp-p-row ${isK?'krishna':'sukla'}">
      <div><span class="vp-p-row-name">${p.name}</span><span class="vp-p-row-badge ${isK?'k':'s'}">${p.paksha}</span>${relPill}</div>
      <div class="vp-p-row-time">${label}</div>
    </div>`;
  }).join('');

  // Nakshatra/Yoga/Karana rows — always today's data (panchanga angas don't change by vaar selection)
  function pRowTime(p){
    const sd=jdToDate(p.startJD),ed=jdToDate(p.endJD);
    const durMin=(p.endJD-p.startJD)*1440; // minutes
    if(durMin<2) return null; // discard artefact
    return `${fmtDT(sd)}<br>– ${fmtDT(ed)}`;
  }
  function renderPeriodRows(periods){
    return periods.map(p=>{const t=pRowTime(p);if(!t)return'';
      const sd=jdToDate(p.startJD),ed=jdToDate(p.endJD);
      const relPill=relHTML(sd,ed,now);
      return`
    <div class="vp-p-row sukla" style="padding-left:14px">
      <div><span class="vp-p-row-name">${p.name}</span>${relPill}</div>
      <div class="vp-p-row-time">${t}</div>
    </div>`;}).join('');
  }
  document.getElementById('vp-nakshatra-rows').innerHTML=renderPeriodRows(nakshatraPeriods);
  document.getElementById('vp-yoga-rows').innerHTML=renderPeriodRows(yogaPeriods);
  document.getElementById('vp-karana-rows').innerHTML=renderPeriodRows(karanaPeriods);

  // Auspicious/Inauspicious — from DISPLAYED vaar
  function isNowM(s,e){return isActive&&s&&e&&now>=s&&now<e}
  function mRowH(icon,label,s,e,desc,type){
    const active=isNowM(s,e);
    const relPill=isActive?relHTML(s,e,now):'';
    const timeLeft=active?`<div class="vp-m-time-left">ends ${fmtEnd(e,now)} &nbsp;·&nbsp; ${dur(now,e)} left</div>`:'';
    const nowBadge=active?`<span class="vp-m-now-badge"><span class="dot"></span>NOW</span>`:'';
    const pulseCls=active?(type==='auspicious'?' pulse-auspicious':(type==='inauspicious'?' pulse-inauspicious':'')):'';
    return`<div class="vp-m-row ${type}${active?' now-active':''}${pulseCls}">
      <span class="vp-m-icon">${icon}</span>
      <div class="vp-m-body"><div class="vp-m-label">${label}${nowBadge}${active?'':relPill}</div><div class="vp-m-desc">${desc}</div>${timeLeft}</div>
      <div class="vp-m-time">${fmtDate(s)}<br>${fmt12(s)} – ${fmtEnd(e,s)}<br><span style="opacity:.6">${dur(s,e)}</span></div>
    </div>`;
  }
  function activeBanner(items,warnCls){
    const a=items.find(x=>isNowM(x.s,x.e));
    if(!a)return'';
    const pulseCls=warnCls==='warn'?'pulse-inauspicious':'pulse-auspicious';
    return`<div class="vp-active-banner ${warnCls} ${pulseCls}">
      <div class="vp-amb-dot"></div>
      <div class="vp-amb-body">
        <div class="vp-amb-label">Active Now</div>
        <div class="vp-amb-name">${a.icon} ${a.label}</div>
        <div class="vp-amb-time">${fmt12(a.s)} – ${fmtEnd(a.e,a.s)} &nbsp;·&nbsp; ${dur(now,a.e)} left</div>
      </div>
    </div>`;
  }
  const auspItems=[
    {icon:'🌅',label:'Brahma Muhurta',s:md.brahmaMuhurta.start,e:md.brahmaMuhurta.end,desc:'Best for meditation, study & prayer'},
    {icon:'🏆',label:'Abhijit Muhurta',s:md.abhijit.start,e:md.abhijit.end,desc:'Victory muhurta — excellent for important work'},
    {icon:'⚔️',label:'Vijaya Muhurta',s:md.vijaya.start,e:md.vijaya.end,desc:'Afternoon victory — good for negotiations'},
    {icon:'🌄',label:'Godhuli Muhurta',s:md.godhuli.start,e:md.godhuli.end,desc:'Sacred cow-dust time — around sunset'},
    {icon:'🌙',label:'Nishita Muhurta',s:md.nishita.start,e:md.nishita.end,desc:'Midnight — Tantra, Mantra & deep Sadhana'},
    ...(md.amritaKala?[{icon:'✨',label:'Amrita Kala',s:md.amritaKala.start,e:md.amritaKala.end,desc:'Nakshatra nectar time — abundant results'}]:[]),
  ];
  const inaupItems=[
    {icon:'☠️',label:'Rahu Kalam',s:md.rahuKalam.start,e:md.rahuKalam.end,desc:'Strictly avoid new beginnings & auspicious work'},
    {icon:'⚰️',label:'Yamaganda',s:md.yamaganda.start,e:md.yamaganda.end,desc:"Yama\u2019s period — avoid travel & decisions"},
    {icon:'🐍',label:'Gulika (Mandi)',s:md.gulika.start,e:md.gulika.end,desc:'Saturn-influenced — delays & obstacles'},
    ...(md.varjyam?[{icon:'🚫',label:'Varjyam / Tyajya',s:md.varjyam.start,e:md.varjyam.end,desc:'Moon-based window — avoid sacred activities'}]:[]),
    ...md.durMuhurtas.map((d,i)=>({icon:'⚠️',label:`Dur Muhurta ${i+1}`,s:d.start,e:d.end,desc:'Daily inauspicious slot — avoid new ventures'})),
  ];
  document.getElementById('vp-ausp-rows').innerHTML=activeBanner(auspItems,'')+auspItems.map(x=>mRowH(x.icon,x.label,x.s,x.e,x.desc,'auspicious')).join('');
  document.getElementById('vp-inaup-rows').innerHTML=activeBanner(inaupItems,'warn')+inaupItems.map(x=>mRowH(x.icon,x.label,x.s,x.e,x.desc,'inauspicious')).join('');

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
window.vpToggleGrid = function() {
  const w = document.getElementById('vp-month-grid-wrap');
  const b = document.getElementById('vp-tithi-toggle');
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
