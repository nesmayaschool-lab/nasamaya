const GROUP_COUNT = 6;
const ADMIN_EMAIL = "nesmayaschool@gmail.com";
const KIND_LABELS = {exam:"اختبار", review:"مراجعة", weekly:"تدريب أسبوعي"};
let currentStage = 'prep';
let currentGrade = "1";
let currentUser = null;
let currentStudent = null;
let pageMode = 'live';
let pageSubject = '';
let dbGlobal = null;
let materialsCache = {};

function esc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function comboId(subjectKey){ return `${subjectKey}_${currentStage}_${currentGrade}`; }

async function saveFile(filename, blob){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function getSubjectFromUrl(){
  return new URLSearchParams(location.search).get('subject');
}
function liveUrl(subjectKey){ return `subject-live.html?subject=${subjectKey}`; }
function examsUrl(subjectKey){ return `subject-exams.html?subject=${subjectKey}`; }

// ---- Firebase-based access control ----
function initSubjectAccess(mode){
  pageMode = mode || 'live';
  pageSubject = getSubjectFromUrl();
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  dbGlobal = db;
  auth.onAuthStateChanged(async (user)=>{
    const authArea = document.getElementById('authArea');
    const contentArea = document.getElementById('contentArea');
    if(!pageSubject || !SUBJECT_LABELS[pageSubject]){
      authArea.innerHTML = `<div class="quiz-box" style="text-align:center"><p>مادة غير معروفة.</p><a class="btn" href="index.html">الرئيسية</a></div>`;
      return;
    }
    if(!user){
      contentArea.classList.add('hidden');
      authArea.innerHTML = `<div class="quiz-box" style="text-align:center">
        <p>لازم تسجّل دخول أو تعمل حساب جديد عشان تشوف المحتوى.</p>
        <a class="btn" href="login.html?next=${encodeURIComponent(location.pathname.split('/').pop()+location.search)}">تسجيل الدخول / حساب جديد</a>
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
    currentStage = currentStudent.stage || 'prep';
    currentGrade = currentStudent.grade || "1";
    const isAdmin = user.email === ADMIN_EMAIL;
    const subjectInCurriculum = (CURRICULUM[currentStage][currentGrade] || []).includes(pageSubject);
    if(!subjectInCurriculum && !isAdmin){
      contentArea.classList.add('hidden');
      authArea.innerHTML = `<div class="quiz-box" style="text-align:center"><p>هذه المادة ليست ضمن مواد صفّك.</p><a class="btn" href="index.html">الرئيسية</a></div>`;
      return;
    }
    const active = isAdmin || (currentStudent.subjects && currentStudent.subjects[pageSubject]);
    if(!active){
      contentArea.classList.add('hidden');
      authArea.innerHTML = `<div class="quiz-box" style="text-align:center">
        <p>مرحبًا ${esc(currentStudent.name)}! اشتراكك في مادة ${SUBJECT_LABELS[pageSubject]} غير مفعّل بعد.</p>
        <p class="small-note">ادفع عبر فودافون كاش وابعت لقطة الدفع على واتساب ليتم تفعيل المادة لحسابك.</p>
        <a class="btn" href="subscribe.html">صفحة الاشتراك</a>
        <br><br><button class="btn" style="background:#888" onclick="firebase.auth().signOut().then(()=>location.reload())">تسجيل الخروج</button>
      </div>`;
      return;
    }
    let adminSwitch = '';
    if(isAdmin){
      let stageOpts = Object.keys(STAGE_LABELS).map(s=>`<option value="${s}" ${s===currentStage?'selected':''}>${STAGE_LABELS[s]}</option>`).join('');
      adminSwitch = `<div style="margin:10px 0"><strong>معاينة الأدمن:</strong>
        <select id="adminStageSel" onchange="changeAdminStage(this.value)" style="margin-right:8px;width:auto;display:inline-block">${stageOpts}</select>
        <select id="adminGradeSel" onchange="changeAdminGrade(this.value)" style="margin-right:8px;width:auto;display:inline-block"></select></div>`;
    }
    authArea.innerHTML = `<div class="small-note">مرحبًا ${esc(currentStudent.name)} — <span id="gradeLabel">${GRADE_LABELS[currentStage][currentGrade]}</span>
      <button class="btn" style="background:#888;padding:6px 14px;font-size:.8em;margin-right:10px" onclick="firebase.auth().signOut().then(()=>location.reload())">خروج</button></div>${adminSwitch}`;
    if(isAdmin) populateAdminGradeSel();
    contentArea.classList.remove('hidden');
    renderSubNav();
    renderPage();
    renderPrice();
  });
}

function populateAdminGradeSel(){
  const sel = document.getElementById('adminGradeSel');
  sel.innerHTML = '';
  Object.keys(GRADE_LABELS[currentStage]).forEach(g=>{
    const opt = document.createElement('option');
    opt.value = g; opt.textContent = GRADE_LABELS[currentStage][g];
    if(g === currentGrade) opt.selected = true;
    sel.appendChild(opt);
  });
}
function changeAdminStage(s){
  currentStage = s;
  currentGrade = Object.keys(GRADE_LABELS[s])[0];
  populateAdminGradeSel();
  afterAdminGradeChange();
}
function changeAdminGrade(g){
  currentGrade = g;
  afterAdminGradeChange();
}
function afterAdminGradeChange(){
  const label = document.getElementById('gradeLabel');
  if(label) label.textContent = GRADE_LABELS[currentStage][currentGrade];
  renderPage();
  renderPrice();
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
    <a class="tab ${live?'active':''}" href="${liveUrl(pageSubject)}" style="text-decoration:none;display:inline-block">البث المباشر</a>
    <a class="tab ${live?'':'active'}" href="${examsUrl(pageSubject)}" style="text-decoration:none;display:inline-block">الاختبارات والمراجعات</a>
  </div>`;
}

async function renderPrice(){
  const box = document.getElementById('priceBox');
  if(!box) return;
  try{
    const doc = await dbGlobal.collection('subjectPrices').doc(comboId(pageSubject)).get();
    const price = doc.exists ? doc.data().price : null;
    box.textContent = price ? `سعر الاشتراك الشهري: ${esc(String(price))} جنيه` : '';
  }catch(e){ box.textContent = ''; }
}

function renderPage(){
  if(pageMode === 'exams'){
    renderMaterials(pageSubject);
    renderTest(pageSubject);
  } else {
    renderLiveGroups(pageSubject);
  }
}

// ---- Live groups (schedule set by admin) ----
let roomNames = {};
async function renderLiveGroups(subjectKey){
  const grid = document.getElementById('liveGrid');
  if(!grid) return;
  grid.innerHTML = '<p class="small-note">جارِ تحميل المواعيد...</p>';
  let schedule = {};
  roomNames = {};
  try{
    const doc = await dbGlobal.collection('groupSchedules').doc(comboId(subjectKey)).get();
    if(doc.exists) schedule = doc.data().groups || {};
  }catch(e){}
  try{
    const rdoc = await dbGlobal.collection('rooms').doc(comboId(subjectKey)).get();
    if(rdoc.exists) roomNames = rdoc.data().names || {};
  }catch(e){}
  grid.innerHTML = '';
  for(let i=1;i<=GROUP_COUNT;i++){
    const g = schedule[i] || {};
    const scheduleText = (g.day && g.time) ? `${esc(g.day)} · الساعة ${esc(g.time)}` : 'لم يتم تحديد الميعاد بعد';
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>المجموعة ${i}</h3>
      <div class="meta">${scheduleText}</div>
      <button class="btn" style="width:100%;padding:9px 0;font-size:.9em" onclick="joinGroup(${i})">انضم الآن</button>`;
    grid.appendChild(card);
  }
  let note = document.getElementById('joinNote');
  if(!note){
    note = document.createElement('div');
    note.id = 'joinNote';
    note.className = 'small-note';
    grid.insertAdjacentElement('afterend', note);
  }
  note.textContent = 'بعد الضغط على "انضم الآن"، هتفتح الحصة جوه نفس الصفحة مباشرة. وافق على إذن الكاميرا والميكروفون لما المتصفح يطلبه.';
}
let jitsiApi = null;
function joinGroup(i){
  const room = roomNames[i];
  if(!room){
    alert('رابط هذه الحصة لسه ما اتفتحش. جرّب قبل ميعاد الحصة بقليل أو تواصل معنا.');
    return;
  }
  const name = (currentStudent && currentStudent.name) || 'طالب';
  const container = document.getElementById('meetingContainer');
  if(!container || typeof JitsiMeetExternalAPI === 'undefined'){
    window.open('https://meet.jit.si/' + encodeURIComponent(room) + '#userInfo.displayName="' + encodeURIComponent(name) + '"', '_blank', 'noopener');
    return;
  }
  if(jitsiApi){ try{ jitsiApi.dispose(); }catch(e){} jitsiApi = null; }
  const h = Math.max(480, Math.round(window.innerHeight * 0.85));
  container.classList.remove('hidden');
  container.innerHTML = '';
  container.style.height = h + 'px';
  jitsiApi = new JitsiMeetExternalAPI('meet.jit.si', {
    roomName: room,
    parentNode: container,
    width: '100%',
    height: h,
    userInfo: { displayName: name },
    configOverwrite: { prejoinPageEnabled: true }
  });
  const leaveBtn = document.getElementById('leaveBtn');
  if(leaveBtn) leaveBtn.classList.remove('hidden');
  const goDown = function(){
    const top = container.getBoundingClientRect().top + window.pageYOffset - 70;
    window.scrollTo({ top: top, behavior: 'smooth' });
  };
  setTimeout(goDown, 150);
  setTimeout(goDown, 1000);
}
function leaveMeeting(){
  if(jitsiApi){ try{ jitsiApi.dispose(); }catch(e){} jitsiApi = null; }
  const container = document.getElementById('meetingContainer');
  if(container){ container.innerHTML = ''; container.classList.add('hidden'); }
  const leaveBtn = document.getElementById('leaveBtn');
  if(leaveBtn) leaveBtn.classList.add('hidden');
}

// ---- Materials (reviews / exams / weekly) written by the teacher ----
async function renderMaterials(key){
  const box = document.getElementById('materialsBox');
  if(!box) return;
  box.innerHTML = '<p class="small-note">جارِ التحميل...</p>';
  try{
    const snap = await dbGlobal.collection('materials').doc(comboId(key))
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
      const hasQ = d.questions && d.questions.length > 0;
      html += `<div class="card" style="margin-bottom:12px">
        <div class="meta">${KIND_LABELS[d.kind]||''}${date ? ' · '+date : ''}</div>
        <h3>${esc(d.title)}</h3>
        <div id="body-${doc.id}" class="hidden" style="white-space:pre-wrap;margin:10px 0">${esc(d.body)}</div>
        <div id="quiz-${doc.id}" class="hidden" style="margin:10px 0"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" style="font-size:.85em;padding:8px 18px" onclick="toggleMaterial('${doc.id}')">عرض / إخفاء النص</button>
          <button class="btn" style="font-size:.85em;padding:8px 18px" onclick="downloadMaterialPdf('${doc.id}')">تحميل PDF</button>
          ${hasQ ? `<button class="btn" style="font-size:.85em;padding:8px 18px;background:var(--pine);color:var(--ink)" onclick="toggleItemQuiz('${doc.id}')">حل الأسئلة التفاعلية</button>` : ''}
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

let itemAnswers = {};
function toggleItemQuiz(id){
  const el = document.getElementById('quiz-'+id);
  if(!el) return;
  const wasHidden = el.classList.contains('hidden');
  el.classList.toggle('hidden');
  if(wasHidden && !el.dataset.rendered){
    renderItemQuiz(id);
    el.dataset.rendered = '1';
  }
}
function renderItemQuiz(id){
  const d = materialsCache[id];
  if(!d || !d.questions) return;
  itemAnswers[id] = {};
  const el = document.getElementById('quiz-'+id);
  let html = `<p class="small-note">بعد اختيار إجابة: <strong>اللون الأخضر = إجابة صحيحة</strong>، <strong>اللون الفوشيا = إجابة خاطئة</strong>.</p>`;
  d.questions.forEach((item,qi)=>{
    html += `<div style="font-weight:700;margin:10px 0 6px">${qi+1}) ${esc(item.q)}</div><div id="iq-${id}-${qi}">`;
    item.options.forEach((opt,oi)=>{
      html += `<button class="quiz-opt" onclick="answerItemQuiz('${id}',${qi},${oi},this,${item.correct})">${esc(opt)}</button>`;
    });
    html += `</div>`;
  });
  html += `<div id="iqResult-${id}" style="font-weight:700;margin:8px 0;min-height:1.4em"></div>
    <button class="btn" style="font-size:.85em;padding:7px 16px" onclick="showItemScore('${id}')">إظهار النتيجة</button>`;
  el.innerHTML = html;
}
function answerItemQuiz(id, qi, oi, btn, correctIndex){
  itemAnswers[id][qi] = oi;
  const group = document.querySelectorAll(`#iq-${id}-${qi} .quiz-opt`);
  group.forEach(b=>{ b.classList.remove('correct','wrong'); b.disabled = true; });
  if(oi === correctIndex){ btn.classList.add('correct'); }
  else { btn.classList.add('wrong'); group[correctIndex].classList.add('correct'); }
}
function showItemScore(id){
  const d = materialsCache[id];
  let score = 0;
  d.questions.forEach((item,qi)=>{ if(itemAnswers[id][qi] === item.correct) score++; });
  document.getElementById('iqResult-'+id).textContent = `نتيجتك: ${score} من ${d.questions.length}`;
}

// ---- Optional quick quiz from data.js (legacy, generic subjects only) ----
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
  let html = `<h3 style="color:var(--pine)">${SUBJECT_LABELS[key]} — ${GRADE_LABELS[currentStage][currentGrade]}</h3>
    <p class="small-note">بعد اختيار إجابة: <strong>اللون الأخضر = إجابة صحيحة</strong>، <strong>اللون الفوشيا = إجابة خاطئة</strong>.</p>`;
  qs.forEach((item,qi)=>{
    html += `<div style="font-weight:700;margin:12px 0 8px">${qi+1}) ${esc(item.q)}</div><div id="qgroup-${qi}">`;
    item.options.forEach((opt,oi)=>{
      html += `<button class="quiz-opt" onclick="answerTest(${qi},${oi},this,${item.correct})">${esc(opt)}</button>`;
    });
    html += `</div>`;
  });
  html += `<div id="testResult" style="font-weight:700;margin:10px 0;min-height:1.4em"></div>
    <button class="btn" style="font-size:.9em" onclick="showTestScore('${key}')">إظهار النتيجة</button>`;
  box.innerHTML = html;
}
function answerTest(qi, oi, btn, correctIndex){
  testAnswers[qi] = oi;
  const group = document.querySelectorAll(`#qgroup-${qi} .quiz-opt`);
  group.forEach(b=>{ b.classList.remove('correct','wrong'); b.disabled = true; });
  if(oi === correctIndex){ btn.classList.add('correct'); }
  else { btn.classList.add('wrong'); group[correctIndex].classList.add('correct'); }
}
function showTestScore(key){
  const qs = getQuestions(key);
  let score = 0;
  qs.forEach((item,qi)=>{ if(testAnswers[qi] === item.correct) score++; });
  document.getElementById('testResult').textContent = `نتيجتك: ${score} من ${qs.length}`;
}

// ---- PDF helpers (multi-page) ----
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
  const title = `منصة نسماية — ${SUBJECT_LABELS[pageSubject]} — ${GRADE_LABELS[currentStage][currentGrade]}`;
  const sub = `${KIND_LABELS[d.kind]||''}: ${d.title}`;
  const pages = pagedCanvases(title, [{t:sub, size:28, bold:true}, {t:'', size:12}, ...blocks]);
  const blob = pagesToPdfBlob(pages);
  await saveFile(`${KIND_LABELS[d.kind]||'ملف'}-${d.title}.pdf`, blob);
}
