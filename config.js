const CURRICULUM = {
  primary: {
    "1": ["ARABIC","ENGLISH","MATH"],
    "2": ["ARABIC","ENGLISH","MATH"],
    "3": ["ARABIC","ENGLISH","MATH"],
    "4": ["ARABIC","ENGLISH","MATH","SCI","SOC"],
    "5": ["ARABIC","ENGLISH","MATH","SCI","SOC"],
    "6": ["ARABIC","ENGLISH","MATH","SCI","SOC"]
  },
  prep: {
    "1": ["ARABIC","ENGLISH","MATH","SCI","SOC"],
    "2": ["ARABIC","ENGLISH","MATH","SCI","SOC"],
    "3": ["ARABIC","ENGLISH","MATH","SCI","SOC"]
  }
};
const SUBJECT_LABELS = {
  ARABIC:"اللغة العربية", ENGLISH:"اللغة الإنجليزية", MATH:"رياضة",
  SCI:"علوم", SOC:"دراسات اجتماعية"
};
const STAGE_LABELS = {primary:"التعليم الابتدائي", prep:"التعليم الإعدادي"};
const GRADE_LABELS = {
  primary: {"1":"الصف الأول الابتدائي","2":"الصف الثاني الابتدائي","3":"الصف الثالث الابتدائي","4":"الصف الرابع الابتدائي","5":"الصف الخامس الابتدائي","6":"الصف السادس الابتدائي"},
  prep: {"1":"الصف الأول الإعدادي","2":"الصف الثاني الإعدادي","3":"الصف الثالث الإعدادي"}
};
const ALL_SUBJECT_KEYS = Object.keys(SUBJECT_LABELS);
