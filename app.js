const groupsMeta = [
  {letter:"أ", id:"A", days:"السبت + الثلاثاء", time:"1:00 م"},
  {letter:"ب", id:"B", days:"الأحد + الأربعاء", time:"1:00 م"},
  {letter:"ج", id:"C", days:"الاثنين + الخميس", time:"1:00 م"},
  {letter:"د", id:"D", days:"السبت + الثلاثاء", time:"4:00 م"},
  {letter:"هـ", id:"E", days:"الأحد + الأربعاء", time:"4:00 م"},
];
const GRADE_LABELS = {"1":"أولى إعدادي","2":"تانية إعدادي","3":"تالتة إعدادي"};
const SUBJECT_LABELS = {MATH:"رياضة", SCI:"علوم", SOC:"دراسات اجتماعية"};
const LIVE_PAGES = {MATH:"math.html", SCI:"science.html", SOC:"social.html"};
const EXAMS_PAGES = {MATH:"math-exams.html", SCI:"science-exams.html", SOC:"social-exams.html"};
const KIND_LABELS = {exam:"اختبار", review:"مراجعة", weekly:"تدريب أسبوعي"};
const ADMIN_EMAIL = "nesmayaschool@gmail.com";
let currentGrade = "1";
let currentUser = null;
let currentStudent = null;
let pageMode = 'live';
let pageSubject = '';
let dbGlobal = null;
let materialsCache = {};

function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function saveFile(filename, blob){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ---- Firebase-based access control ----
function initSubjectAccess(subjectKey, mode){
  pageMode = mode || 'live';
  pageSubject = subjectKey;
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  dbGlobal = db;
  auth.onAuthStateChanged(async (user)=>{
    const authArea = document.getElementById('authArea');
    const contentArea = document.getElementById('contentArea');
    if(!user){
      contentArea.classList.add('hidden');
      authArea.innerHTML = `<div class="quiz-box" style="text-align:center">
        <p>لازم تسجّل دخول أو تعمل حساب جديد عشان تشوف المحتوى.</p>
        <a class="btn" href="login.html?next=${location.pathname.split('/').pop()}">تسجيل الدخول / حساب جديد</a>
      </div>`;
      return;
    }
    currentUser = user;
    const doc = await db.collection('students').doc(user.uid).get();
    if(!doc.exists){
      authArea.innerHTML = `<div class="quiz-box" style="text-align:center"><p>حدث خطأ في بيانات حسابك، تواصل معنا.</p></div>`;
      return;
    }
    currentStudent = doc.data();
    currentGrade = currentStudent.grade || "1";
    const isAdmin = user.email === ADMIN_EMAIL;
    const active = isAdmin || (currentStudent.subjects && currentStudent.subjects[subjectKey]);
    if(!active){
      contentArea.classList.add('hidden');
      authArea.innerHTML = `<div class="quiz-box" style="text-align:center">
        <p>مرحبًا ${esc(currentStudent.name)}! اشتراكك في هذه المادة غير مفعّل بعد.</p>
        <p class="small-note">ادفع عبر فودافون كاش وابعت لقطة الدفع على واتساب ليتم تفعيل المادة لحسابك.</p>
        <a class="btn" href="subscribe.html">صفحة الاشتراك</a>
        <br><br><button class="btn" style="background:#888" onclick="firebase.auth().signOut().then(()=>location.reload())">تسجيل الخروج</button>
      </div>`;
      return;
    }
    const adminSwitch = isAdmin ? `<div style="margin:10px 0"><strong>معاينة الأدمن:</strong>
      <select onchange="changeAdminGrade(this.value)" style="margin-right:8px">
        <option value="1">أولى إعدادي</option><option value="2">تانية إعدادي</option><option value="3">تالتة إعدادي</option>
      </select></div>` : '';
    authArea.innerHTML = `<div class="small-note">مرحبًا ${esc(currentStudent.name)} — <span id="gradeLabel">${GRADE_LABELS[currentGrade]}</span>
      <button class="btn" style="background:#888;padding:6px 14px;font-size:.8em;margin-right:10px" onclick="firebase.auth().signOut().then(()=>location.reload())">خروج</button></div>${adminSwitch}`;
    contentArea.classList.remove('hidden');
    renderSubNav();
    renderPage();
  });
}

function renderSubNav(){
  const contentArea = document.getElementById('contentArea');
  let nav = document.getElementById('subNav');
  if(!nav){
    nav = document.createElement('div');
    nav.id = 'subNav';
    nav.className = 'wrap';
    contentArea.insertBefore(nav, contentArea.firstChild);
  }
  const live = pageMode === 'live';
  nav.innerHTML = `<div class="grade-tabs" style="justify-content:flex-start;margin:0 0 10px">
    <a class="tab ${live?'active':''}" href="${LIVE_PAGES[pageSubject]}" style="text-decoration:none;display:inline-block">البث المباشر</a>
    <a class="tab ${live?'':'active'}" href="${EXAMS_PAGES[pageSubject]}" style="text-decoration:none;display:inline-block">الاختبارات والمراجعات</a>
  </div>`;
}

function renderPage(){
  if(pageMode === 'exams'){
    renderMaterials(pageSubject);
    renderTest(pageSubject);
  } else {
    renderLiveGroups(pageSubject);
    const old = document.getElementById('testBox');
    if(old){ const sec = old.closest('section'); if(sec) sec.remove(); }
  }
}
function changeAdminGrade(g){
  currentGrade = g;
  const label = document.getElementById('gradeLabel');
  if(label) label.textContent = GRADE_LABELS[g];
  renderPage();
}

// ---- Live groups ----
function renderLiveGroups(subjectKey){
  const grid = document.getElementById('liveGrid');
  if(!grid) return;
  grid.innerHTML = '';
  groupsMeta.forEach(g=>{
    const uid = `${currentGrade}-${subjectKey}-${g.id}`;
    const link = `https://meet.jit.si/MinassaNasamaya-${uid}`;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>مجموعة ${g.letter}</h3>
      <div class="meta">${g.days} · الساعة ${g.time}</div>
      <button class="btn" style="width:100%;padding:9px 0;font-size:.9em" onclick="joinGroup('${uid}','${link}')">انضم الآن</button>`;
    grid.appendChild(card);
  });
  let note = document.getElementById('joinNote');
  if(!note){
    note = document.createElement('div');
    note.id = 'joinNote';
    note.className = 'small-note';
    grid.insertAdjacentElement('afterend', note);
  }
  note.textContent = 'بعد الضغط على "انضم الآن": اختر Join in browser (أو Join in app لو نزّلت تطبيق Jitsi Meet) وتجاهل أرقام التليفون. على الموبايل يفضّل تنزيل التطبيق.';
}
function joinGroup(uid, link){
  const name = (currentStudent && currentStudent.name) || 'طالب';
  window.open(link + '#userInfo.displayName="' + encodeURIComponent(name) + '"', '_blank', 'noopener');
}

// ---- Materials (reviews / exams / weekly) written by the teacher ----
async function renderMaterials(key){
  const box = document.getElementById('materialsBox');
  if(!box) return;
  box.innerHTML = '<p class="small-note">جارِ التحميل...</p>';
  try{
    const snap = await dbGlobal.collection('materials').doc(key).collection('grades').doc(currentGrade)
      .collection('items').orderBy('createdAt','desc').get();
    if(snap.empty){
      box.innerHTML = '<p>لا توجد مراجعات أو اختبارات لصفّك حتى الآن. سيتم إضافتها قريبًا.</p>';
      return;
    }
    materialsCache = {};
    let html = '';
    snap.forEach(doc=>{
      const d = doc.data();
      materialsCache[doc.id] = d;
      const date = (d.createdAt && d.createdAt.toDate) ? d.createdAt.toDate().toLocaleDateString('ar-EG') : '';
      html += `<div class="card" style="margin-bottom:12px">
        <div class="meta">${KIND_LABELS[d.kind]||''}${date ? ' · '+date : ''}</div>
        <h3>${esc(d.title)}</h3>
        <div id="body-${doc.id}" class="hidden" style="white-space:pre-wrap;margin:10px 0">${esc(d.body)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" style="font-size:.85em;padding:8px 18px" onclick="toggleMaterial('${doc.id}')">عرض / إخفاء</button>
          <button class="btn" style="font-size:.85em;padding:8px 18px" onclick="downloadMaterialPdf('${doc.id}')">تحميل PDF</button>
        </div></div>`;
    });
    box.innerHTML = html;
  }catch(e){
    box.innerHTML = '<p>تعذر تحميل المحتوى: ' + esc(e.message) + '</p>';
  }
}
function toggleMaterial(id){
  const el = document.getElementById('body-'+id);
  if(el) el.classList.toggle('hidden');
}
async function downloadMaterialPdf(id){
  const d = materialsCache[id];
  if(!d) return;
  if(document.fonts && document.fonts.ready){ await document.fonts.ready; }
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = '400 24px Tajawal, sans-serif';
  const blocks = [];
  String(d.body).split('\n').forEach(par=>{
    if(par.trim() === ''){ blocks.push({t:'', size:24}); return; }
    wrapText(probe, par, 860).forEach(l=>blocks.push({t:l, size:24}));
  });
  const title = `منصة نسماية — ${SUBJECT_LABELS[pageSubject]} — ${GRADE_LABELS[currentGrade]}`;
  const sub = `${KIND_LABELS[d.kind]||''}: ${d.title}`;
  const pages = pagedCanvases(title, [{t:sub, size:28, bold:true}, {t:'', size:12}, ...blocks]);
  const blob = pagesToPdfBlob(pages);
  await saveFile(`${KIND_LABELS[d.kind]||'ملف'}-${d.title}.pdf`, blob);
}

// ---- Interactive monthly quiz (optional, from data.js) ----
let testAnswers = {};
function getQuestions(key){
  return (typeof testBank !== 'undefined' && testBank[key] && testBank[key][currentGrade]) || [];
}
function renderTest(key){
  testAnswers = {};
  const box = document.getElementById('testBox');
  if(!box) return;
  const sec = box.closest('section');
  const qs = getQuestions(key);
  if(!qs.length){ if(sec) sec.classList.add('hidden'); return; }
  if(sec) sec.classList.remove('hidden');
  let html = `<h3 style="color:var(--pine)">${SUBJECT_LABELS[key]} — ${GRADE_LABELS[currentGrade]}</h3>`;
  qs.forEach((item,qi)=>{
    html += `<div style="font-weight:700;margin:12px 0 8px">${qi+1}) ${esc(item.q)}</div><div id="qgroup-${qi}">`;
    item.options.forEach((opt,oi)=>{
      html += `<button class="quiz-opt" onclick="answerTest(${qi},${oi},this)">${esc(opt)}</button>`;
    });
    html += `</div>`;
  });
  html += `<div id="testResult" style="font-weight:700;margin:10px 0;min-height:1.4em"></div>
    <button class="btn" style="font-size:.9em" onclick="showTestScore('${key}')">إظهار النتيجة</button>`;
  box.innerHTML = html;
}
function answerTest(qi, oi, btn){
  testAnswers[qi] = oi;
  document.querySelectorAll(`#qgroup-${qi} .quiz-opt`).forEach(b=>b.classList.remove('correct'));
  btn.classList.add('correct');
}
function showTestScore(key){
  const qs = getQuestions(key);
  let score = 0;
  qs.forEach((item,qi)=>{ if(testAnswers[qi] === item.correct) score++; });
  document.getElementById('testResult').textContent = `نتيجتك: ${score} من ${qs.length}`;
}

// ---- PDF helpers (multi-page A4-like) ----
function wrapText(ctx, text, maxWidth){
  const words = text.split(' ');
  let lines = [], line = '';
  words.forEach(w=>{
    const test = line ? line+' '+w : w;
    if(ctx.measureText(test).width > maxWidth && line){ lines.push(line); line = w; }
    else { line = test; }
  });
  if(line) lines.push(line);
  return lines;
}
function pagedCanvases(title, blocks){
  const W = 1000, H = 1414, M = 70;
  const pages = [];
  let cv, ctx, cy;
  function newPage(){
    cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#1E2A22'; ctx.direction = 'rtl'; ctx.textAlign = 'right';
    cy = M;
    pages.push(cv);
  }
  newPage();
  const all = [{t:title, size:32, bold:true}, {t:'', size:16}].concat(blocks);
  all.forEach(b=>{
    const lh = Math.round(b.size*1.5);
    if(cy + lh > H - M) newPage();
    ctx.font = `${b.bold?'700':'400'} ${b.size}px Tajawal, sans-serif`;
    if(b.t) ctx.fillText(b.t, W-M, cy);
    cy += lh;
  });
  return pages;
}
function pagesToPdfBlob(pages){
  const { jsPDF } = window.jspdf;
  const w = 1000*0.75, h = 1414*0.75;
  const pdf = new jsPDF({unit:'pt', format:[w,h]});
  pages.forEach((cv,i)=>{
    if(i > 0) pdf.addPage([w,h]);
    pdf.addImage(cv.toDataURL('image/png'), 'PNG', 0, 0, w, h);
  });
  return pdf.output('blob');
}
