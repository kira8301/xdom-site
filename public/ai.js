/* x.dom AI frontend. Loaded on demand. Talks only to /api/*; no keys here. */
(function(){
var root=document.getElementById('aiapp');if(!root||root.dataset.ready)return;root.dataset.ready=1;
var KEY='xdom-ai-chat',msgs=[],busy=false;
var TOOLS={summarize:'تلخيص',translate:'ترجمة',rewrite:'إعادة صياغة',explain:'شرح',brainstorm:'أفكار',code:'مساعد برمجة'},tool='summarize';
function esc(s){return s.replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function md(s){var c=[];s=esc(s).replace(/```\w*\n?([\s\S]*?)```/g,function(m,x){c.push(x);return'\u0000'+(c.length-1)+'\u0000'});
s=s.replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>').replace(/^#{1,3} (.+)$/gm,'<b>$1</b>')
.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
.replace(/(?:^[-*] .+(?:\n|$))+/gm,function(b){return'<ul>'+b.trim().split('\n').map(function(l){return'<li>'+l.slice(2)+'</li>'}).join('')+'</ul>'});
s=s.split(/\n{2,}/).map(function(p){return/^<ul>/.test(p)?p:'<p>'+p.replace(/\n/g,'<br>')+'</p>'}).join('');
return s.replace(/\u0000(\d+)\u0000/g,function(m,i){return'<pre><code>'+c[i]+'</code></pre>'})}
function say2(m){if(typeof say==='function')say(m)}
function post(p,b){return fetch('/api/'+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json().catch(function(){return{error:'رد غير صالح'}})}).catch(function(){return{error:'تعذر الاتصال بالخادم.'}})}
function copy(t){try{navigator.clipboard.writeText(t);say2('تم النسخ')}catch(e){say2('تعذر النسخ')}}
var demoMsg='وضع تجريبي: لا يوجد مزود AI متصل بهذا الموقع بعد، فلن تظهر نتائج حقيقية.';
function $i(i){return document.getElementById(i)}
root.innerHTML='<div class="dash open"><div class="tabs"><button data-t="chat" class="on">محادثة</button><button data-t="image">صور</button><button data-t="video">فيديو</button><button data-t="tools">أدوات</button></div>'
+'<div class="pane on" id="p-chat"><div class="note" id="n-chat" hidden></div><div id="msgs" aria-live="polite"></div><div class="row"><textarea id="ci" rows="1" maxlength="4000" placeholder="اسأل أي شيء..."></textarea><button class="btn solid" id="cs">إرسال</button></div><div class="acts"><button id="cn">محادثة جديدة</button></div></div>'
+'<div class="pane" id="p-image"><div class="note" id="n-image" hidden></div><div class="row"><textarea id="ii" maxlength="500" placeholder="Create a dark futuristic city at night"></textarea><button class="btn solid" id="ig">توليد</button></div><div class="out" id="io"></div></div>'
+'<div class="pane" id="p-video"><div class="note" id="n-video"></div><div class="row"><textarea id="vi" maxlength="500" placeholder="A cinematic black sports car driving through Tokyo at night"></textarea><button class="btn solid" id="vg">توليد</button></div><div class="out" id="vo"></div></div>'
+'<div class="pane" id="p-tools"><div class="note" id="n-tools" hidden></div><div class="tl" id="tl"></div><div class="row"><textarea id="ti" maxlength="4000" placeholder="الصق النص هنا"></textarea><button class="btn solid" id="tg">تنفيذ</button></div><div class="out" id="to"></div></div></div>';
document.querySelector('.tabs').onclick=function(e){var b=e.target.closest('button');if(!b)return;document.querySelectorAll('.tabs button').forEach(function(x){x.classList.toggle('on',x===b)});document.querySelectorAll('.pane').forEach(function(p){p.classList.toggle('on',p.id==='p-'+b.dataset.t)})};
try{msgs=JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){msgs=[]}if(!Array.isArray(msgs))msgs=[];
function save(){try{localStorage.setItem(KEY,JSON.stringify(msgs.slice(-40)))}catch(e){}}
function draw(extra){var h='';msgs.forEach(function(m,i){if(m.role==='user')h+='<div class="m u" dir="auto">'+esc(m.content).replace(/\n/g,'<br>')+'</div>';
else h+='<div class="m a" dir="auto">'+md(m.content)+'<div class="acts"><button data-c="'+i+'">نسخ</button>'+(i===msgs.length-1?'<button data-r="1">إعادة توليد</button>':'')+'</div></div>'});
if(extra)h+=extra;var el=$i('msgs');el.innerHTML=h||'<div class="m a d">اسأل بالعربية أو English أو Français.</div>';el.scrollTop=el.scrollHeight}
$i('msgs').onclick=function(e){var c=e.target.closest('[data-c]');if(c)return copy(msgs[c.dataset.c].content);if(e.target.closest('[data-r]')&&!busy){msgs.pop();ask()}};
function ask(){busy=true;draw('<div class="m a d dots"><i></i><i></i><i></i></div>');
post('chat',{messages:msgs}).then(function(d){busy=false;if(d.demo)return draw('<div class="m a d">'+demoMsg+'</div>');
if(d.error)return draw('<div class="m a d">'+esc(d.error)+'</div>');msgs.push({role:'assistant',content:d.reply||'(لا يوجد رد)'});save();draw()})}
function send(){var v=$i('ci').value.trim();if(!v||busy)return;$i('ci').value='';msgs.push({role:'user',content:v});save();ask()}
$i('cs').onclick=send;$i('ci').onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey&&!/Mobi|Android|iPhone/.test(navigator.userAgent)){e.preventDefault();send()}};
$i('cn').onclick=function(){msgs=[];save();draw()};
['cs','ig','vg','tg'].forEach(function(i){$i(i).dataset.l=$i(i).textContent});
function busyBtn(b,on){b.disabled=on;b.textContent=on?'...':b.dataset.l}
function gen(kind,inId,outId,btn){var p=$i(inId).value.trim();if(p.length<3)return say2('اكتب وصفاً أطول');var o=$i(outId);busyBtn($i(btn),true);o.innerHTML='<div class="dots"><i></i><i></i><i></i></div>';
post(kind,{prompt:p}).then(function(d){busyBtn($i(btn),false);
if(d.demo)return o.innerHTML='<div class="note">'+(kind==='video'?'توليد الفيديو غير مفعّل بعد: لم يتم ربط مزود فيديو.':demoMsg)+'</div>';
if(d.error)return o.innerHTML='<div class="note">'+esc(d.error)+'</div>';
var el=kind==='image'?'<img alt="" src="'+d.image+'">':'<video controls playsinline src="'+d.video+'"></video>';
o.innerHTML=el+'<div class="acts"><a class="sm" style="display:inline-flex;align-items:center" download="xdom-ai.'+(kind==='image'?'jpg':'mp4')+'" href="'+(d.image||d.video)+'">تحميل</a><button class="sm" data-again="1">توليد مرة أخرى</button></div>';
o.querySelector('[data-again]').onclick=function(){gen(kind,inId,outId,btn)}})}
$i('ig').onclick=function(){gen('image','ii','io','ig')};$i('vg').onclick=function(){gen('video','vi','vo','vg')};
$i('tl').innerHTML=Object.keys(TOOLS).map(function(k){return'<button data-k="'+k+'"'+(k===tool?' class="on"':'')+'>'+TOOLS[k]+'</button>'}).join('');
$i('tl').onclick=function(e){var b=e.target.closest('button');if(!b)return;tool=b.dataset.k;$i('tl').querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b)})};
$i('tg').onclick=function(){var v=$i('ti').value.trim();if(!v)return;var o=$i('to');busyBtn($i('tg'),true);o.innerHTML='<div class="dots"><i></i><i></i><i></i></div>';
post('chat',{tool:tool,messages:[{role:'user',content:v}]}).then(function(d){busyBtn($i('tg'),false);
if(d.demo)return o.innerHTML='<div class="note">'+demoMsg+'</div>';if(d.error)return o.innerHTML='<div class="note">'+esc(d.error)+'</div>';
o.innerHTML='<div class="m a" dir="auto">'+md(d.reply||'')+'</div><div class="acts"><button id="tc">نسخ</button></div>';$i('tc').onclick=function(){copy(d.reply||'')}})};
fetch('/api/status').then(function(r){return r.json()}).then(function(s){
if(!s.chat){['chat','tools'].forEach(function(k){var n=$i('n-'+k);n.hidden=false;n.textContent=demoMsg})}
if(!s.image){var n=$i('n-image');n.hidden=false;n.textContent=demoMsg}
if(!s.video)$i('n-video').textContent='الفيديو غير مفعّل: يحتاج مزود فيديو مدفوع وغير مربوط بعد.'}).catch(function(){var n=$i('n-chat');n.hidden=false;n.textContent='الخادم غير متصل: وضع تجريبي.'});
draw();
})();
