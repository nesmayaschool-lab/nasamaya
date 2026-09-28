const groupsMeta = [
  {letter:"أ", id:"A", days:"السبت + الثلاثاء", time:"1:00 م"},
  {letter:"ب", id:"B", days:"الأحد + الأربعاء", time:"1:00 م"},
  {letter:"ج", id:"C", days:"الاثنين + الخميس", time:"1:00 م"},
  {letter:"د", id:"D", days:"السبت + الثلاثاء", time:"4:00 م"},
  {letter:"هـ", id:"E", days:"الأحد + الأربعاء", time:"4:00 م"},
];
const GRADE_LABELS = {"1":"أولى إعدادي","2":"تانية إعدادي","3":"تالتة إعدادي"};
const ADMIN_EMAIL = "nesmayaschool@gmail.com";
let currentGrade = "1";
let currentUser = null;
let currentStudent = null;

async function saveFile(filename, blob){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ---- Firebase-based access control ----
function initSubjectAccess(subjectKey){
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  auth.onAuthStateChanged(async (user)=>{
    const authArea = document.getElementById('authArea');
    const contentArea = document.getElementById('contentArea');
    if(!user){
      contentArea.classList.add('hidden');
      authArea.innerHTML = `<div class="quiz-box" style="text-align:center">
        <p>لازم تسجّل دخول أو تعمل حساب جديد عشان تشوف الحصص والاختبارات.</p>
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
        <p>مرحبًا ${currentStudent.name}! اشتراكك في هذه المادة غير مفعّل بعد.</p>
        <p class="small-note">ادفع عبر فودافون كاش وابعت لقطة الدفع على واتساب ليتم تفعيل المادة لحسابك.</p>
        <a class="btn" href="subscribe.html">صفحة الاشتراك</a>
        <br><br><button class="btn" style="background:#888" onclick="firebase.auth().signOut().then(()=>location.reload())">تسجيل الخروج</button>
      </div>`;
      return;
    }
    const adminSwitch = isAdmin ? `<div style="margin:10px 0"><strong>معاينة الأدمن:</strong>
      <select onchange="changeAdminGrade(this.value,'${subjectKey}')" style="margin-right:8px">
        <option value="1">أولى إعدادي</option><option value="2">تانية إعدادي</option><option value="3">تالتة إعدادي</option>
      </select></div>` : '';
    authArea.innerHTML = `<div class="small-note">مرحبًا ${currentStudent.name} — <span id="gradeLabel">${GRADE_LABELS[currentGrade]}</span>
      <button class="btn" style="background:#888;padding:6px 14px;font-size:.8em;margin-right:10px" onclick="firebase.auth().signOut().then(()=>location.reload())">خروج</button></div>${adminSwitch}`;
    contentArea.classList.remove('hidden');
    renderLiveGroups(subjectKey);
    renderTest(subjectKey);
  });
}

function changeAdminGrade(g, subjectKey){
  currentGrade = g;
  const label = document.getElementById('gradeLabel');
  if(label) label.textContent = GRADE_LABELS[g];
  renderLiveGroups(subjectKey);
}

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

let testAnswers = {};
function renderTest(key){
  testAnswers = {};
  const box = document.getElementById('testBox');
  const qs = testBank[key];
  let html = '';
  qs.forEach((item,qi)=>{
    html += `<div style="font-weight:700;margin-bottom:10px">${qi+1}) ${item.q}</div><div id="qgroup-${qi}">`;
    item.options.forEach((opt,oi)=>{
      html += `<button class="quiz-opt" onclick="answerTest(${qi},${oi},this)">${opt}</button>`;
    });
    html += `</div>`;
  });
  html += `<div id="testResult" style="font-weight:700;margin:10px 0;min-height:1.4em"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
      <button class="btn" style="font-size:.9em" onclick="showTestScore('${key}')">إظهار النتيجة</button>
      <button class="btn" style="font-size:.9em" onclick="downloadTestPdf('${key}')">تحميل الاختبار PDF</button>
      <button class="btn" style="font-size:.9em" onclick="downloadReviewPdf('${key}')">تحميل المراجعة النثرية PDF</button>
    </div>`;
  box.innerHTML = html;
}
function answerTest(qi, oi, btn){
  testAnswers[qi] = oi;
  document.querySelectorAll(`#qgroup-${qi} .quiz-opt`).forEach(b=>b.classList.remove('correct'));
  btn.classList.add('correct');
}
function showTestScore(key){
  const qs = testBank[key];
  let score = 0;
  qs.forEach((item,qi)=>{ if(testAnswers[qi] === item.correct) score++; });
  document.getElementById('testResult').textContent = `نتيجتك: ${score} من ${qs.length}`;
}

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
function textPageCanvas(titleText, bodyLines){
  const width = 1000, margin = 60;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  const ctx = canvas.getContext('2d');
  ctx.direction = 'rtl'; ctx.textAlign = 'right';
  const blocks = [{t:titleText, size:32, bold:true}, {t:'', size:16}];
  bodyLines.forEach(b=> blocks.push(b));
  let y = margin;
  const measured = blocks.map(b=>{ const lh = Math.round(b.size*1.5); y += lh; return {...b, lh}; });
  canvas.height = Math.ceil(y + margin);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#1E2A22'; ctx.direction = 'rtl'; ctx.textAlign = 'right';
  let cy = margin;
  measured.forEach(b=>{
    ctx.font = `${b.bold?'700':'400'} ${b.size}px Tajawal, sans-serif`;
    if(b.t) ctx.fillText(b.t, b.indent ? width-margin-30 : width-margin, cy);
    cy += b.lh;
  });
  return canvas;
}
async function canvasToPdfBlob(canvas){
  const imgData = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({unit:'pt', format:[canvas.width*0.75, canvas.height*0.75]});
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width*0.75, canvas.height*0.75);
  return pdf.output('blob');
}
async function downloadTestPdf(key){
  if(document.fonts && document.fonts.ready){ await document.fonts.ready; }
  const qs = testBank[key];
  const ctxProbe = document.createElement('canvas').getContext('2d');
  const lines = [{t:`الاسم: ${currentStudent?currentStudent.name:'______________________'}`, size:24}];
  qs.forEach((item,qi)=>{
    ctxProbe.font = '700 26px Tajawal, sans-serif';
    wrapText(ctxProbe, `${qi+1}) ${item.q}`, 880).forEach(l=>lines.push({t:l, size:26, bold:true}));
    ctxProbe.font = '400 24px Tajawal, sans-serif';
    item.options.forEach(opt=>{
      wrapText(ctxProbe, '- '+opt, 850).forEach(l=>lines.push({t:l, size:24, indent:true}));
    });
    lines.push({t:'', size:16});
  });
  const canvas = textPageCanvas('منصة نسماية — اختبار الشهر', lines);
  const blob = await canvasToPdfBlob(canvas);
  await saveFile('اختبار-الشهر.pdf', blob);
}
async function downloadReviewPdf(key){
  if(document.fonts && document.fonts.ready){ await document.fonts.ready; }
  const ctxProbe = document.createElement('canvas').getContext('2d');
  const lines = [];
  wrapText(ctxProbe, reviewBank[key], 880).forEach(l=>lines.push({t:l, size:24}));
  const canvas = textPageCanvas('منصة نسماية — المراجعة النثرية الشهرية', lines);
  const blob = await canvasToPdfBlob(canvas);
  await saveFile('المراجعة-النثرية.pdf', blob);
}
