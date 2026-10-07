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

// ---- Firebase-
