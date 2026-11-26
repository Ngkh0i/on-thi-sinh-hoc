(() => {
  "use strict";
  const packetNode = document.getElementById("review-packet");
  const catalogNode = document.getElementById("review-catalog");
  if (!packetNode && !catalogNode) return;
  const data = JSON.parse((packetNode || catalogNode).textContent);
  const DAY = 86400000;
  const memory = new Map();
  let persistent = true;
  const unsaved=new Set();
  function key(page,id) { return "on-thi:kiem-tra:1:"+data.course+":"+page+":"+id; }
  function read(page,id) {
    const k=key(page,id);
    try {
      const raw=localStorage.getItem(k);
      if (!unsaved.has(k) && raw) return JSON.parse(raw);
    } catch { persistent=false; }
    return memory.get(k) || {};
  }
  function change(id,fn) {
    const k=key(data.page,id), value=read(data.page,id);
    fn(value);
    memory.set(k,value);
    try { localStorage.setItem(k,JSON.stringify(value));unsaved.delete(k); }
    catch { persistent=false;unsaved.add(k); }
    return value;
  }
  function el(tag,cls,text) {
    const node=document.createElement(tag);
    if (cls) node.className=cls;
    if (text!=null) node.textContent=text;
    return node;
  }
  function action(label,run,primary=false) {
    const b=el("button","button"+(primary?"":" secondary"),label);
    b.type="button"; b.addEventListener("click",run); return b;
  }
  function dateText(ts) {
    return new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(ts);
  }
  function mix(list) {
    const copy=list.slice();
    for(let i=copy.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; }
    return copy;
  }
  function isTest(t) {return t==="mc" || t==="mini";}
  function totals(page,types) {
    const t={n:0,done:0,secure:0,due:0,essays:0,written:0,writtenDue:0,feedback:0,next:Infinity};
    for(const [id,type] of Object.entries(types)) {
      const r=read(page,id);
      if(isTest(type)) {
        t.n++; if(r.tries)t.done++; if((r.streak||0)>=2)t.secure++;
        if(r.seen)t.feedback++;
        if(r.tries && r.due<=Date.now())t.due++;
        if(r.due>Date.now())t.next=Math.min(t.next,r.due);
      } else if(type==="essay") {
        t.essays++; if(r.selfDate){t.written++;if(r.due<=Date.now())t.writtenDue++;}
      }
    }
    return t;
  }
  function meter(title,value,total) {
    const wrap=el("div","review-meter"), label=el("div","review-meter-title");
    label.append(el("span","",title),el("strong","",value+" / "+total));
    const bar=el("progress"); bar.max=Math.max(total,1); bar.value=value;
    bar.setAttribute("aria-label",title); wrap.append(label,bar); return wrap;
  }
  function stats(box,t) {
    const meters=el("div","review-meters");
    meters.append(meter("Trắc nghiệm đã chấm",t.done,t.n),meter("Nhớ lại đúng sau ít nhất 24 giờ",t.secure,t.n));
    box.replaceChildren(meters,el("p","review-summary",t.due+" câu cần ôn · Đã đối chiếu lời giải "+t.feedback+" câu · Tự luận đã tự chấm "+t.written+"/"+t.essays+" ("+t.writtenDue+" đến hẹn)."));
    if(!persistent)box.append(el("p","review-storage","Trình duyệt chưa cho lưu tiến độ. Lượt này chỉ giữ trong trang đang mở."));
  }
  if(catalogNode) {
    const box=document.querySelector("[data-course-stats]"), list=document.querySelector("[data-review-list]");
    function drawCatalog(){
      const sum={n:0,done:0,secure:0,due:0,essays:0,written:0,writtenDue:0,feedback:0};
      list.replaceChildren();
      for(const page of data.pages) {
        const t=totals(page.page,page.types);
        Object.keys(sum).forEach(k=>sum[k]+=t[k]);
        const row=el("article","review-index-row"), a=el("a","",page.title);
        a.href=page.url;
        row.append(a,el("p","meta",t.done+"/"+t.n+" trắc nghiệm đã chấm · "+t.secure+" nhớ qua hai lượt · "+t.due+" cần ôn · "+t.written+"/"+t.essays+" tự luận"));
        if(t.due){const due=el("a","","Ôn "+t.due+" câu đến hẹn");due.href=page.url.replace("#on-lai","?on=den-hen#on-lai");row.append(due);}
        list.append(row);
      }
      stats(box,sum);
    }
    drawCatalog(); window.addEventListener("pageshow",drawCatalog);window.addEventListener("storage",drawCatalog);
    return;
  }
  const items=data.items, types=Object.fromEntries(items.map(i=>[i.id,i.type]));
  const byAnchor=new Map(items.filter(i=>i.anchor).map(i=>[i.anchor,i]));
  const units=new Map();
  for(const i of items) {
    if(!i.part)continue;
    if(!units.has(i.part))units.set(i.part,[]);
    units.get(i.part).push(i);
  }
  const panel=document.querySelector("[data-review-stats]"), notice=document.querySelector(".review-status");
  function pathState(list){
    const signature=list.map(i=>i.id).join(".");
    const state=read(data.page,"mini-path:"+list[0].part);
    return state.signature===signature ? state : {};
  }
  function dueItem(i){
    const record=read(data.page,i.id);
    return record.tries && record.due<=Date.now();
  }
  function refresh(){
    stats(panel,totals(data.page,types));
    const bankButton=document.querySelector("[data-chapter-loop]");
    if(bankButton){
      const state=read(data.page,"chapter-loop");
      bankButton.textContent=state.done?"Ôn lại 80 câu đến khi hết":state.pending?.length?"Tiếp tục ôn 80 câu · lượt "+state.round:"Ôn 80 câu đến khi hết";
    }
    const exam=document.querySelector('[data-run="exam"]');
    if(exam){
      const saved=read(data.page,"exam-session");
      const chosen=Object.values(saved.answers||{}).filter(a=>Number.isInteger(a.choice)).length;
      if(chosen && !saved.finished)exam.textContent="Tiếp tục thi thử ("+chosen+"/30)";
      else exam.textContent=saved.finished?"Thi lại 30 câu":"Làm đề 30 câu";
      if(saved.lastDate)panel.append(el("p","meta","Lần thi thử gần nhất: "+saved.lastScore+"/30 · "+dateText(saved.lastDate)));
      const submitted=saved.history?.length?saved.history:(saved.finished && saved.lastDate?[{at:saved.lastDate,score:saved.lastScore,answers:saved.answers}]:[]);
      if(submitted.length){
        const prior=el("details","exam-history");prior.append(el("summary","","Xem lại các lượt thi đã nộp"));
        for(const h of [...submitted].reverse()){
          const label=dateText(h.at)+" · "+h.score+"/30";
          const questions=items.filter(i=>i.type==="mc");
          if(questions.every(i=>Number.isInteger(h.answers?.[i.id]?.choice)))prior.append(action(label,()=>{begin(questions,"history",questions.length);examResults(h.answers,h.score,h.at);}));
          else prior.append(el("p","meta",label+" · Từ bản đề trước"));
        }
        panel.append(prior);
      }
    }
    for(const text of document.querySelectorAll("[data-mini-status]")) {
      const set=(units.get(text.dataset.miniStatus)||[]).filter(i=>i.type==="mini");
      const records=set.map(i=>read(data.page,i.id));
      const short=(units.get(text.dataset.miniStatus)||[]).filter(i=>i.type==="recall");
      const written=short.filter(i=>read(data.page,i.id).selfDate).length;
      const progress=records.filter(r=>r.tries).length+"/"+set.length+" đã chấm · "+records.filter(r=>(r.streak||0)>=2).length+" nhớ sau 24 giờ";
      const area=text.closest("[data-mini-unit]");
      const start=area.querySelector("[data-path-mini]");
      if(start){
        const loop=area.querySelector("[data-loop]"), saved=read(data.page,"loop:"+text.dataset.miniStatus);
        if(loop)loop.textContent=saved.done?"Ôn đến hết lần nữa":saved.pending?.length?"Tiếp tục ôn đến hết · lượt "+saved.round:"Ôn đến khi hết";
        const state=pathState(set), pos=state.at||0;
        start.textContent=pos===set.length?"Làm lại 13 câu":pos>0?"Tiếp tục từ câu "+(pos+1)+"/13":"Làm 13 câu";
        const due=set.filter(dueItem).length, retry=area.querySelector("[data-retry-mini]");
        retry.disabled=!due;
        text.textContent=progress+" · "+due+" câu sai, phân vân hoặc đến hẹn";
        const past=set.map((item,index)=>({item,index,r:records[index]})).filter(({r})=>Number.isInteger(r.lastChoice));
        if(past.length){
          let history=area.querySelector(".mini-answer-history");
          if(!history){history=el("details","mini-answer-history");area.append(history);}
          const stamp=past.map(({r})=>r.last).join(".");
          if(history.dataset.stamp!==stamp){
            history.dataset.stamp=stamp;
            history.replaceChildren(el("summary","","Xem lại lựa chọn và lời giải · "+past.length+"/"+set.length+" câu"));
            for(const {item,index,r} of past){
              const entry=el("details","exam-answer-detail");
              entry.append(el("summary","","Câu "+(index+1)+" · "+(r.lastChoice===item.answer?"Đúng":"Chưa đúng")));
              entry.addEventListener("toggle",()=>{
                if(!entry.open || entry.childElementCount>1)return;
                scene(entry,item);entry.append(el("p","practice-question",item.q),el("p","","Bạn chọn · "+item.options[r.lastChoice]),
                  el("p","","Đáp án đúng · "+item.options[item.answer]),el("p","practice-prose",item.why));
              });
              history.append(entry);
            }
          }
        }
      }else text.textContent=progress+" · "+written+"/"+short.length+" câu tự nhớ đã đối chiếu";
    }
  }
  function recordMC(item,choice,unsure,independent,context={}){
    const prior=read(data.page,item.id);
    if(context.loop && prior.lastLoop===context.loop)return prior;
    if(context.exam && prior.lastExamAttempt===context.exam)return prior;
    const result=change(item.id,r=>{
      const now=Date.now(), right=choice===item.answer;
      const needsRecall=r.right===false || r.unsure;
      if(!independent && !context.fresh && r.lastBook===choice)return;
      if(context.loop)r.lastLoop=context.loop;
      if(context.exam)r.lastExamAttempt=context.exam;
      if(!independent)r.lastBook=choice;
      r.lastChoice=choice;r.shown=now;
      r.tries=(r.tries||0)+1; r.last=now; r.right=right; r.unsure=unsure;
      if(!right || unsure){
        r.streak=0;r.credit=0;r.due=now;
      } else if(independent){
        if(!r.credit || now-r.credit>=DAY) {
          r.streak=(r.streak||0)+1;r.credit=now;
          r.due=now+(r.streak===1?1:r.streak===2?3:7)*DAY;
        }
      } else if(!r.credit) {r.due=needsRecall?now:now+DAY;}
    });
    window.dispatchEvent(new Event("study:progress"));
    return result;
  }
  document.addEventListener("study:answered",event=>{
    const item=byAnchor.get(event.target.id);
    if(!item)return;
    recordMC(item,event.detail,false,false,{fresh:true});
    refresh();
  });
  // An explicit group score can also grade legacy drafts saved before instant feedback.
  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-grade-group],[data-grade]"); if(!b)return;
    const scope=b.closest("[data-grade-group]")?b.closest(".bank-group"):b.closest("form");
    if(!scope)return;
    const fields=[...scope.querySelectorAll("fieldset[data-correct]")];
    if(!fields.length||fields.some(f=>!f.querySelector("input:checked")))return;
    for(const f of fields) {
      const item=byAnchor.get(f.id);
      if(item)recordMC(item,Number(f.querySelector("input:checked").value),false,false);
    }
    refresh();
  });
  document.addEventListener("toggle",e=>{
    const detail=e.target;
    if(!detail.open || !detail.matches?.("details.bank-key,details.mock-key"))return;
    // Reviewing a whole answer sheet is available without claiming individual mastery.
    notice.textContent="Bạn có thể mở lượt ôn mới để thử trả lời khi chưa nhìn đáp án.";
  },true);
  let dialog,previousFocus,queue=[],at=0,misses=[],rightCount=0,sessionType="";
  function priority(item){
    const r=read(data.page,item.id);
    if(r.tries && r.due<=Date.now())return r.right===false||r.unsure?0:1;
    if(!r.tries&&!r.selfDate)return 2;
    return 3;
  }
  function begin(list,mode,cap=5) {
    if(!list.length){notice.textContent="Chưa có câu cần ôn ở mục này. Bạn có thể chọn “Luyện 5 câu” để học tiếp.";return;}
    queue=["exam","history","path","loop"].includes(mode)?list.slice():mix(list).sort((a,b)=>priority(a)-priority(b)).slice(0,cap);
    at=0;misses=[];rightCount=0;sessionType=mode;
    if(mode==="path"){
      const saved=pathState(list);
      if(saved.at>0 && saved.at<list.length){
        at=saved.at;rightCount=saved.rightCount||0;
        misses=list.filter(i=>(saved.misses||[]).includes(i.id));
      }
      savePath(at);
    }
    if(!dialog){
      previousFocus=document.activeElement;
      dialog=el("dialog","review-dialog");dialog.setAttribute("aria-labelledby","practice-title");
      document.body.append(dialog);
      dialog.addEventListener("close",()=>{dialog.remove();dialog=null;refresh();previousFocus?.focus();});
      dialog.showModal();
    }
    if(mode!=="history")display();
  }
  function shell(heading,kicker) {
    dialog.replaceChildren();
    const top=el("div","practice-top");top.append(el("span","meta",kicker),action(sessionType==="loop"?"Dừng và lưu":"Đóng",()=>dialog.close()));
    const h=el("h2","",heading);h.id="practice-title";h.tabIndex=-1;
    dialog.append(top,h);
    const main=el("div","practice-body");dialog.append(main);dialog.scrollTop=0;h.focus();return main;
  }
  function scene(container,item){
    if(!item.scene)return;
    const block=el("div","review-scene"); block.innerHTML=data.scenes[item.scene];
    // Diagrams may reuse clip paths in the main chapter; give the duplicate its own IDs.
    const contextIds=new Map();
    for(const x of block.querySelectorAll("[id]")){contextIds.set(x.id,"review-scene-"+x.id);x.id="review-scene-"+x.id;}
    for(const x of block.querySelectorAll("*")){
      for(const a of [...x.attributes]){
        let value=a.value;
        if(value.startsWith("#")&&contextIds.has(value.slice(1)))value="#"+contextIds.get(value.slice(1));
        else value=value.replace(/url\(#([^)]+)\)/g,(match,id)=>contextIds.has(id)?"url(#"+contextIds.get(id)+")":match);
        if(value!==a.value)x.setAttribute(a.name,value);
      }
    }
    container.append(block);
  }
  function savePath(position){
    if(sessionType!=="path")return;
    change("mini-path:"+queue[0].part,state=>{
      state.signature=queue.map(i=>i.id).join(".");
      state.at=position;state.rightCount=rightCount;state.misses=misses.map(i=>i.id);
    });
  }
  function next(){at++;display();}
  function display(){
    if(sessionType==="loop"){loopScreen();return;}
    if(sessionType==="exam"){examQuestion();return;}
    if(at>=queue.length){
      const main=shell("Kết quả lượt ôn",data.title);
      main.append(el("p","",sessionType==="written"?"Đã đối chiếu "+queue.length+" bài viết.":"Đúng và chắc "+rightCount+"/"+queue.length+" câu."));
      if(misses.length)main.append(action("Thử lại "+misses.length+" câu còn vướng",()=>begin(misses.slice(),"mc",misses.length),true));
      else if(sessionType!=="written")main.append(el("p","meta","Lần nhớ lại đúng sau ít nhất 24 giờ sẽ được ghi riêng trên thanh tiến độ."));
      main.append(action("Về bài học",()=>dialog.close()));refresh();return;
    }
    const item=queue[at], written=!isTest(item.type);
    const main=shell(written?(item.type==="recall"?"Tự nhớ kiến thức":"Tự luận và đối chiếu"):"Luyện trắc nghiệm",data.title+" · "+(at+1)+"/"+queue.length);
    if(sessionType==="path")main.append(el("p","meta",at<10?"Tự kiểm kiến thức · câu "+(at+1)+" trong 10 câu":"Nối kiến thức · câu "+(at-9)+" trong 3 câu"));
    scene(main,item);
    const question=el("p","practice-question",item.q);main.append(question);
    if(written)writeAnswer(main,item);else {showHint(main,item);chooseAnswer(main,item);}
  }
  let activeLoop;
  function startLoop(list, id = "loop:" + list[0].part) {
    if(!list.length)return;
    activeLoop=id;
    const ids = list.map(i => i.id), signature = ids.join(".");
    const saved = read(data.page,id);
    if (id.startsWith("exam-loop:") && saved.signature && !saved.done && saved.signature!==signature) {
      change(id,s=>{
        const previous=new Set(s.signature.split("."));
        const pending=s.pending.filter(k=>ids.includes(k));
        if(pending[0]!==s.pending[0]){s.choice=null;s.order=null;s.flag=false;}
        s.pending=pending.concat(ids.filter(k=>!previous.has(k)));
        s.again=s.again.filter(k=>ids.includes(k));
        if(!s.pending.length && s.again.length){s.pending=mix(s.again);s.again=[];s.round++;}
        s.signature=signature;s.done=!s.pending.length;
      });
    } else if (saved.signature !== signature || saved.done) {
      change(id,s => Object.assign(s,{signature,round:1,pending:ids,again:[],choice:null,order:null,flag:false,done:false,run:Date.now()}));
    }
    begin(list,"loop",list.length);
  }
  function loopScreen() {
    const id = activeLoop, s = read(data.page,id);
    if (s.done) {
      const main = shell("Đã giải quyết hết "+queue.length+" câu trong buổi này", data.title);
      main.append(el("p","meta","Hoàn thành sau "+s.round+" lượt. Mốc nhớ lại sau 24 giờ được ghi riêng."),action("Về bài học",()=>dialog.close()));
      return;
    }
    const item=queue.find(q=>q.id===s.pending[0]);
    const remaining=s.pending.length+s.again.length;
    const main=shell("Ôn đến khi hết", "Lượt "+s.round+" · Còn "+remaining+" câu");
    main.append(meter("Đã giải quyết trong buổi",queue.length-remaining,queue.length));
    scene(main,item); main.append(el("p","practice-question",item.q)); showHint(main,item);
    const fs=el("fieldset","review-options");fs.append(el("legend","sr-practice","Chọn đáp án"));
    const flag=el("input");flag.type="checkbox";flag.checked=s.flag;
    const label=el("label","practice-confidence");label.append(flag,document.createTextNode(" Muốn làm lại ở lượt sau"));
    flag.onchange=()=>change(id,x=>{if(x.run===s.run && x.round===s.round && x.pending[0]===item.id)x.flag=flag.checked;});
    const feedback=el("div","practice-feedback");feedback.setAttribute("aria-live","polite");
    function reveal(n) {
      recordMC(item,n,false,true,{loop:(id.startsWith("loop:")?"":id+":")+s.run+":"+s.round+":"+item.id});
      window.studyDisplayAnswer(feedback,fs,n,item.answer,item.why);
      explainChoice(feedback,item,n);
      feedback.append(action("Tiếp tục",()=>{
        change(id,x=>{
          if(x.run!==s.run || x.pending[0]!==item.id || x.round!==s.round)return;
          x.pending.shift();
          if(n!==item.answer || x.flag)x.again.push(item.id);
          x.flag=false;x.choice=null;x.order=null;
          if(!x.pending.length){
            if(x.again.length){x.pending=mix(x.again);x.again=[];x.round++;}
            else x.done=true;
          }
        });
        loopScreen();refresh();
      },true));
    }
    const order=s.order || mix(item.options.map((_,i)=>i));
    if(!s.order)change(id,x=>{x.order=order;});
    order.forEach((n,pos)=>{
      const opt=item.options[n];
      const choice=el("input");choice.type="radio";choice.name="loop-answer";choice.value=n;choice.checked=s.choice===n;
      const row=el("label","review-option");row.append(choice,el("span","","ABCD"[pos]+". "+opt));fs.append(row);
      choice.onchange=()=>{
        const latest=read(data.page,id);
        if(latest.run!==s.run || latest.round!==s.round || latest.pending[0]!==item.id || Number.isInteger(latest.choice)){loopScreen();return;}
        change(id,x=>{x.choice=n;});
        reveal(n);refresh();
      };
    });
    main.append(fs,label,feedback);
    if(Number.isInteger(s.choice))reveal(s.choice);
  }
  function showHint(main,item){
    const guide=data.guides?.[item.part];if(!guide)return;
    const info=el("details","genetics-theory");info.append(el("summary","",guide.items?.[item.id]?"Gợi ý cho câu này":"Gợi ý nền của tiểu mục"));
    info.append(el("p","",guide.items?.[item.id]?.hint || guide.hint),el("p","",guide.read));
    const figure=document.getElementById(item.part+"-hinh-on");if(figure)for(const child of figure.children)info.append(child.cloneNode(true));
    main.append(info);
  }
  function explainChoice(box,item,n){
    const guide=data.guides?.[item.part];if(!guide || n===item.answer)return;
    const reason=guide.items?.[item.id]?.wrong?.[n];
    box.append(el("p","practice-prose",reason || ("Đối chiếu kiến thức của tiểu mục · "+guide.reason)));
  }

  function launchExam(){
    const paper=items.filter(i=>i.type==="mc");
    const signature=paper.map(i=>i.id).join(".");
    const saved=read(data.page,"exam-session");
    if(saved.signature!==signature || saved.finished){
      change("exam-session",s=>{s.signature=signature;s.answers={};s.orders={};s.pos=0;s.finished=false;s.attemptId=Date.now();});
    }else if(!saved.attemptId){
      change("exam-session",s=>{s.attemptId=Date.now();});
    }
    begin(paper,"exam",paper.length);
  }
  function examQuestion(){
    const saved=read(data.page,"exam-session");
    at=Math.max(0,Math.min(queue.length-1,saved.pos||0));
    const item=queue[at], picked=saved.answers[item.id]||{};
    const main=shell("Thi thử trắc nghiệm",data.title+" · "+(at+1)+"/"+queue.length);
    scene(main,item);main.append(el("p","practice-question",item.q));
    const fs=el("fieldset","review-options");fs.append(el("legend","sr-practice","Chọn một phương án"));
    const order=saved.orders[item.id]||mix(item.options.map((_,i)=>i));
    if(!saved.orders[item.id])change("exam-session",s=>{s.orders[item.id]=order;});
    const updateAnswer=(field,value)=>change("exam-session",s=>{s.answers[item.id]={...(s.answers[item.id]||{}),[field]:value};});
    const feedback=el("div","practice-feedback");feedback.setAttribute("aria-live","polite");
    function gradeChoice(choice){
      recordMC(item,choice,uncertain.checked,true,{exam:saved.attemptId});
      window.studyDisplayAnswer(feedback,fs,choice,item.answer,item.why);
      const state=read(data.page,"exam-session");
      status.textContent=Object.values(state.answers).filter(a=>Number.isInteger(a.choice)).length+"/"+queue.length+" câu đã chọn.";
    }
    order.forEach((n,j)=>{
      const l=el("label","review-option"),r=el("input");r.type="radio";r.name="exam-answer";r.value=n;
      r.checked=picked.choice===n;
      r.addEventListener("change",()=>{updateAnswer("choice",n);gradeChoice(n);refresh();});
      l.append(r,el("span","","ABCD"[j]+". "+item.options[n]));fs.append(l);
    });
    const uncertain=el("input");uncertain.type="checkbox";uncertain.checked=!!picked.unsure;
    uncertain.addEventListener("change",()=>updateAnswer("unsure",uncertain.checked));
    const flag=el("label","practice-confidence");flag.append(uncertain,document.createTextNode(" Muốn làm lại sau khi nộp đề"));
    const nav=el("div","review-actions"),status=el("p","meta");status.setAttribute("aria-live","polite");
    function navigate(pos){change("exam-session",s=>{s.pos=pos;});examQuestion();}
    if(at>0)nav.append(action("Câu trước",()=>navigate(at-1)));
    if(at<queue.length-1)nav.append(action("Câu tiếp",()=>navigate(at+1),true));
    else nav.append(action("Nộp 30 câu và xem kết quả",()=>{
      const state=read(data.page,"exam-session");
      const gap=queue.findIndex(i=>!Number.isInteger(state.answers[i.id]?.choice));
      if(gap!==-1){navigate(gap);dialog.querySelector(".practice-body").prepend(el("p","review-storage","Hãy chọn phương án cho câu còn trống này trước khi nộp."));return;}
      if(state.finished)return;
      const now=Date.now(),correct=queue.filter(i=>state.answers[i.id].choice===i.answer).length;
      change("exam-session",s=>{s.finished=true;s.lastScore=correct;s.lastDate=now;s.history=[...(s.history||[]),{at:now,score:correct,answers:{...s.answers}}].slice(-5);});
      for(const i of queue){const a=state.answers[i.id];recordMC(i,a.choice,!!a.unsure,true,{exam:state.attemptId});}
      examResults(state.answers,correct,now);
    },true));
    const answered=Object.values(saved.answers).filter(a=>Number.isInteger(a.choice)).length;
    status.textContent=answered+"/"+queue.length+" câu đã chọn.";
    main.append(el("p","meta","Điểm thi dùng lựa chọn đầu tiên của mỗi câu. Bạn có thể đánh dấu để ôn lại cả sau khi xem lời giải."),flag,fs,feedback,nav,status);
    if(Number.isInteger(picked.choice)) gradeChoice(picked.choice);
  }
  function examResults(answers,correct,submitted){
      const out=shell("Kết quả thi thử",data.title);
      out.append(el("p","practice-question",correct+"/"+queue.length+" câu đúng."));
      const paper=queue.slice(), loopId="exam-loop:"+submitted, markId="exam-flags:"+submitted;
      const isMarked=i=>read(data.page,markId)[i.id] ?? !!answers[i.id].unsure;
      const candidates=()=>paper.filter(i=>answers[i.id].choice!==i.answer || isMarked(i));
      const practice=action("",()=>startLoop(candidates(),loopId),true);
      function update(){
        const count=candidates().length, state=read(data.page,loopId);
        practice.disabled=!count;
        practice.textContent=count?((state.pending?.length && !state.done)?"Tiếp tục ôn đến hết":"Ôn đến khi hết")+" · "+count+" câu đã chọn":"Đã đúng hết · có thể đánh dấu câu để ôn thêm";
      }
      update();out.append(practice);
      queue.forEach((i,index)=>{
        const a=answers[i.id], d=el("details","exam-answer-detail");
        d.append(el("summary","","Câu "+(index+1)+" · "+(a.choice===i.answer?"Đúng":"Chưa đúng")+(a.unsure?" · Còn phân vân":"")));
        const flag=el("input");flag.type="checkbox";flag.checked=isMarked(i);
        flag.onchange=()=>{change(markId,s=>{s[i.id]=flag.checked;});update();};
        const label=el("label","practice-confidence");label.append(flag,document.createTextNode(" Muốn làm lại câu "+(index+1)));
        d.append(label);
        scene(d,i);d.append(el("p","practice-question",i.q),el("p","","Bạn chọn: "+i.options[a.choice]),el("p","","Đáp án: "+i.options[i.answer]),el("p","practice-prose",i.why));
        out.append(d);
      });
      out.append(action("Về đề thi",()=>dialog.close()));refresh();
  }
  function chooseAnswer(main,item){
    const fs=el("fieldset","review-options");fs.append(el("legend","sr-practice","Chọn một phương án"));
    for(const [index,n] of mix(item.options.map((_,i)=>i)).entries()){
      const label=el("label","review-option");const input=el("input");input.type="radio";input.name="current-answer";input.value=n;
      label.append(input,el("span","","ABCD"[index]+". "+item.options[n]));fs.append(label);
    }
    const confidence=el("label","practice-confidence"), uncertain=el("input");uncertain.type="checkbox";
    confidence.append(uncertain,document.createTextNode(" Tôi còn phân vân về lựa chọn này"));
    const feedback=el("div","practice-feedback"); feedback.setAttribute("aria-live","polite");
    fs.addEventListener("change",()=>{
      if(feedback.hasChildNodes())return;
      const selected=fs.querySelector("input:checked");
      const value=Number(selected.value), right=value===item.answer, unsure=uncertain.checked;
      const r=recordMC(item,value,unsure,true);
      uncertain.disabled=true;
      if(right&&!unsure)rightCount++;else misses.push(item);
      savePath(at+1);
      window.studyDisplayAnswer(feedback,fs,value,item.answer,item.why);
      explainChoice(feedback,item,value);
      feedback.append(el("p","meta",(!right||unsure)?"Câu này đã vào danh sách cần ôn.":"Lần ôn tiếp theo · "+dateText(r.due)+"."));
      const seen=action("Đã đối chiếu lời giải",()=>{change(item.id,z=>{z.seen=Date.now()});seen.textContent="Đã ghi nhận";seen.disabled=true;refresh();});
      feedback.append(seen,action(at+1===queue.length?"Xem kết quả":"Câu tiếp theo",next,true));refresh();
    });
    main.append(el("p","meta","Chọn đáp án để xem lời giải. Nếu còn phân vân, đánh dấu trước khi chọn."),confidence,fs,feedback);
  }
  function writeAnswer(main,item){
    let r=read(data.page,item.id);
    const input=el("textarea","practice-draft");input.rows=5;input.setAttribute("aria-label","Bài viết của bạn");input.value=r.draft||"";
    const feedback=el("div","practice-feedback");feedback.setAttribute("aria-live","polite");
    input.addEventListener("input",()=>change(item.id,z=>{z.draft=input.value;}));
    const reveal=action("Đối chiếu bài viết",()=>{
      if(!input.value.trim()){feedback.textContent="Hãy viết lập luận của bạn rồi mở bài mẫu.";input.focus();return;}
      const firstDraft=input.value;
      reveal.disabled=true;input.readOnly=true;
      feedback.replaceChildren(el("strong","","Lời giải để đối chiếu"),el("p","practice-prose",item.why));
      const criteria=item.criteria.length?item.criteria:["Tôi nêu đúng kết luận của bài mẫu.","Tôi giải thích được vì sao kết luận phù hợp với dữ kiện.","Tôi đã kiểm tra điều kiện, giả định hoặc ví dụ còn thiếu."];
      feedback.append(el("strong","",item.criteria.length?"Đánh dấu từng ý đã có trong bài của bạn":"Tự kiểm lập luận"));
      const marks=criteria.map((c,j)=>{const l=el("label","self-mark"), box=el("input");box.type="checkbox";box.checked=!!r.pendingMarks?.[j];box.addEventListener("change",()=>change(item.id,z=>{z.pendingMarks={...(z.pendingMarks||{}),[j]:box.checked};}));l.append(box,document.createTextNode(" "+c));feedback.append(l);return box;});
      const label=el("label","practice-revise","Ghi phần cần sửa hoặc cách giải thích tốt hơn");const revise=el("textarea");revise.rows=3;revise.value=r.revision||"";label.append(revise);feedback.append(label);
      revise.addEventListener("input",()=>change(item.id,z=>{z.revision=revise.value;}));
      if(r.history?.length){
        const past=el("details");past.append(el("summary","","So với lần viết trước"));
        const last=r.history[r.history.length-1];past.append(el("p","practice-prose",last.text),el("p","practice-prose",last.revision||""),el("p","meta",last.score+"/"+last.total+" ý tự chấm · "+dateText(last.at)));feedback.append(past);
      }
      feedback.append(action("Lưu tự chấm và tiếp tục",()=>{
        const score=marks.filter(m=>m.checked).length, now=Date.now();
        change(item.id,z=>{z.history=[...(z.history||[]),{text:firstDraft,revision:revise.value,score,total:marks.length,at:now}].slice(-3);
          z.draft="";z.revision="";z.pendingMarks={};z.selfDate=now;z.tries=(z.tries||0)+1;z.right=score===marks.length;
          z.due=now+(score===marks.length?3:1)*DAY;});
        refresh();next();
      },true));
    },true);
    main.append(input,el("p","meta","Bản nháp được lưu khi gõ. Bài mẫu mở sau khi bạn viết câu trả lời."),reveal,feedback);
  }
  document.addEventListener("click",event=>{
    const button=event.target.closest("[data-loop],[data-run],[data-path-mini],[data-retry-mini],[data-start-mini],[data-start-recall],[data-write-item],[data-repeat-group]");
    if(!button)return;
    notice.textContent="";
    if(button.dataset.loop){startLoop(units.get(button.dataset.loop).filter(i=>i.type==="mini"));return;}
    if(button.dataset.run==="exam"){launchExam();return;}
    if(button.dataset.repeatGroup){const group=document.getElementById(button.dataset.repeatGroup);const set=[...group.querySelectorAll("fieldset[id]")].map(f=>byAnchor.get(f.id)).filter(Boolean);begin(set,"mc",set.length);return;}
    if(button.dataset.pathMini || button.dataset.retryMini){
      const unit=button.dataset.pathMini || button.dataset.retryMini;
      const group=(units.get(unit)||[]).filter(i=>i.type==="mini");
      if(button.dataset.pathMini)begin(group,"path",group.length);
      else {const due=group.filter(dueItem);begin(due,"mc",due.length);}
      return;
    }
    if(button.dataset.startMini){const list=(units.get(button.dataset.startMini)||[]).filter(i=>i.type==="mini");begin(list,"mc",list.length);return;}
    if(button.dataset.startRecall){begin((units.get(button.dataset.startRecall)||[]).filter(i=>i.type==="recall"),"written",3);return;}
    if(button.dataset.writeItem){const id=button.dataset.writeItem;begin(items.filter(i=>i.id===id),"written",1);return;}
    if(button.dataset.run==="essay-due"){const due=items.filter(i=>{const r=read(data.page,i.id);return i.type==="essay"&&r.selfDate&&r.due<=Date.now();});if(!due.length){notice.textContent="Chưa có bài tự luận đến hẹn.";return;}begin(due,"written",1);return;}
    if(button.dataset.run==="essay"){begin(items.filter(i=>i.type==="essay"),"written",1);return;}
    const list=items.filter(i=>isTest(i.type));
    begin(button.dataset.run==="due"?list.filter(i=>{const r=read(data.page,i.id);return r.tries&&r.due<=Date.now();}):list,"mc");
  });
  for(const item of items.filter(i=>i.type==="essay")){
    const field=document.getElementById(item.anchor);if(!field)continue;
    const button=action("Viết và tự chấm theo từng ý",()=>{const r=read(data.page,item.id);if(field.value.trim()&&!r.draft&&!r.selfDate)change(item.id,z=>{z.draft=field.value;});begin([item],"written",1);});
    button.classList.add("essay-practice-button");field.after(button);
  }
  function revealTheoryAnchor(){
    const anchor=document.getElementById(location.hash.slice(1));
    const fold=anchor?.closest("details.genetics-theory");
    if(fold && !fold.open){fold.open=true;anchor.scrollIntoView();}
  }
  function priorDrafts(){
    for(const [unit,entries] of Object.entries(data.priorRecall||{})){
      const section=document.getElementById(unit+"-trac-nghiem");
      if(!section)continue;
      const block=el("details","genetics-theory");
      block.append(el("summary","","Bài tự viết đã lưu từ phiên bản trước"));
      for(const [id,prompt] of entries){
        const old=read(data.page,id);
        if(!old.draft && !old.revision && !old.history?.length)continue;
        block.append(el("h5","",prompt));
        for(const answer of old.history||[]){
          block.append(el("p","meta",dateText(answer.at)),el("p","practice-prose",answer.text));
          if(answer.revision)block.append(el("p","practice-prose",answer.revision));
        }
        if(old.draft)block.append(el("p","practice-prose",old.draft));
        if(old.revision)block.append(el("p","practice-prose",old.revision));
      }
      if(block.children.length>1)section.append(block);
    }
  }
  const bank=items.filter(i=>i.type==="mc");
  if(bank.length===80){
    const button=action("Ôn 80 câu đến khi hết",()=>startLoop(bank,"chapter-loop"),true);
    button.dataset.chapterLoop="";button.id="on-80-cau";
    document.querySelector(".review-overview .review-actions").prepend(button);
  }
  priorDrafts();
  window.addEventListener("hashchange",revealTheoryAnchor);revealTheoryAnchor();
  window.addEventListener("storage",refresh);window.addEventListener("pageshow",refresh);refresh();
  if(new URLSearchParams(location.search).get("on")==="den-hen")document.querySelector('[data-run="due"]')?.click();
})();
