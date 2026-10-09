/* settings.js - ألوان الموقع من الأدمن + مظهر الطالب */
(function(){
  var KEYS = ['paper','ink','pine','pine-dark','gold','gold-soft','line','card'];
  var THEMES = {
    dark:   {paper:'#14201A', ink:'#EAE6DA', pine:'#8FD3B4', 'pine-dark':'#10201A', gold:'#E0A84F', 'gold-soft':'#6B5530', line:'#2E4238', card:'#1D2D26'},
    blue:   {paper:'#EEF5FB', ink:'#14283A', pine:'#1B5E9B', 'pine-dark':'#0E2F4D', gold:'#F2A93B', 'gold-soft':'#BFD9F2', line:'#C9DAEA', card:'#FFFFFF'},
    pink:   {paper:'#FDF1F5', ink:'#3A1A27', pine:'#B83B73', 'pine-dark':'#4A1530', gold:'#F4B942', 'gold-soft':'#F6C9DA', line:'#EBCBD8', card:'#FFFFFF'},
    purple: {paper:'#F5F1FB', ink:'#241A3A', pine:'#6A3FB5', 'pine-dark':'#2A1850', gold:'#F0B34A', 'gold-soft':'#D9CBF0', line:'#DCD2EE', card:'#FFFFFF'}
  };
  var NAMES = {default:'الأصلي', dark:'داكن', blue:'أزرق', pink:'وردي', purple:'بنفسجي'};
  var root = document.documentElement;
  var siteColors = null;

  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }

  function mix(a, b, p){
    function h(x){ return [1,3,5].map(function(i){ return parseInt(x.substr(i,2),16); }); }
    var A = h(a), B = h(b);
    return '#' + A.map(function(v,i){
      var m = Math.round(v*p + B[i]*(1-p));
      return ('0' + m.toString(16)).slice(-2);
    }).join('');
  }
  function colorsToVars(c){
    var v = {};
    if(c.paper) v.paper = c.paper;
    if(c.ink) v.ink = c.ink;
    if(c.card) v.card = c.card;
    if(c.pine){ v.pine = c.pine; v['pine-dark'] = mix(c.pine, '#000000', 0.55); }
    if(c.gold){ v.gold = c.gold; v['gold-soft'] = mix(c.gold, '#ffffff', 0.55); }
    if(c.paper || c.ink) v.line = mix(c.ink || '#1E2A22', c.paper || '#F6F1E4', 0.16);
    return v;
  }
  function applyAll(){
    KEYS.forEach(function(k){ root.style.removeProperty('--' + k); });
    var theme = lsGet('nsm_theme');
    var vars = null;
    if(theme && THEMES[theme]) vars = THEMES[theme];
    else if(siteColors) vars = colorsToVars(siteColors);
    if(vars){
      for(var k in vars) root.style.setProperty('--' + k, vars[k]);
      root.setAttribute('data-nsm', '1');
    } else {
      root.removeAttribute('data-nsm');
    }
  }

  var st = document.createElement('style');
  st.textContent = 'html[data-nsm] input,html[data-nsm] select,html[data-nsm] textarea{background:var(--card)!important;color:var(--ink)!important}';
  document.head.appendChild(st);

  var cached = lsGet('nsm_site');
  if(cached){ try{ siteColors = JSON.parse(cached); }catch(e){} }
  applyAll();

  function fetchSettings(){
    try{
      if(typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') return;
      var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
      app.firestore().collection('settings').doc('site').get().then(function(d){
        var data = d.exists ? d.data() : {};
        siteColors = data.colors || null;
        if(siteColors) lsSet('nsm_site', JSON.stringify(siteColors)); else lsDel('nsm_site');
        applyAll();
      }).catch(function(){});
    }catch(e){}
  }

  function buildPanel(){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '🎨';
    btn.setAttribute('aria-label', 'تغيير مظهر الموقع');
    btn.style.cssText = 'position:fixed;left:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:9999;width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:22px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);padding:0';
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;left:14px;bottom:calc(70px + env(safe-area-inset-bottom,0px));z-index:9999;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:12px;box-shadow:0 4px 14px rgba(0,0,0,.25);display:none;min-width:170px;font-family:inherit';
    function render(){
      var cur = lsGet('nsm_theme') || 'default';
      panel.innerHTML = '<div style="font-weight:900;margin-bottom:8px">مظهر الموقع</div>';
      Object.keys(NAMES).forEach(function(key){
        var t = THEMES[key] || {paper:'#F6F1E4', pine:'#26433A'};
        var b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = '<span style="display:inline-block;width:16px;height:16px;border-radius:50%;margin-left:8px;vertical-align:middle;border:3px solid ' + t.pine + ';background:' + t.paper + '"></span>' + NAMES[key];
        b.style.cssText = 'display:block;width:100%;text-align:right;padding:8px 10px;margin-bottom:6px;border-radius:8px;font-family:inherit;font-size:.95em;cursor:pointer;color:var(--ink);background:transparent;border:2px solid ' + (key === cur ? 'var(--pine)' : 'var(--line)');
        b.onclick = function(){
          if(key === 'default') lsDel('nsm_theme'); else lsSet('nsm_theme', key);
          applyAll();
          panel.style.display = 'none';
        };
        panel.appendChild(b);
      });
    }
    btn.onclick = function(){
      if(panel.style.display === 'none'){ render(); panel.style.display = 'block'; }
      else { panel.style.display = 'none'; }
    };
    document.body.appendChild(panel);
    document.body.appendChild(btn);
  }

  document.addEventListener('DOMContentLoaded', function(){
    buildPanel();
    fetchSettings();
  });
})();
