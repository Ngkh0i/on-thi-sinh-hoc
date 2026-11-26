(() => {
  "use strict";

  const catalogNode = document.getElementById("progress-catalog");
  if (!catalogNode) {
    // Destinations can also be loaded directly from disk.
    document.addEventListener("DOMContentLoaded", () => {
      const request = new URLSearchParams(location.search).get("reprendre");
      let button = null;
      if (request === "exam" || request === "essay-due") {
        button = document.querySelector('[data-run="' + request + '"]');
      } else if (request === "loop" || request === "mini" || request === "mini-due") {
        const section = document.getElementById(location.hash.slice(1));
        button = section?.querySelector(request === "loop" ? "[data-loop]" : request === "mini" ? "[data-path-mini]" : "[data-retry-mini]");
      }
      if (button && !button.disabled) button.click();
    }, { once: true });
    return;
  }
  const catalog = JSON.parse(catalogNode.textContent);
  const root = catalog.all ? document.getElementById("tien-do") : document.querySelector("[data-subject-progress]");
  const summary = root.querySelector("[data-progress-summary]");
  const list = root.querySelector("[data-progress-list]");
  const nextBox = root.querySelector("[data-progress-next]");
  const courseCards = root.querySelector("[data-progress-courses]");
  const kind = root.querySelector("[data-progress-kind]");
  const filter = root.querySelector("[data-progress-filter]");
  const status = root.querySelector("[data-progress-status]");
  const testKey = "on-thi:kiem-tra:1:";
  const extraKey = "on-thi:bo-tro:1:";
  const formKey = "on-thi-21-ngay:v1:";
  const notebookKey = "on-thi-21-ngay:so-tay:v1:";
  const number = new Intl.NumberFormat("vi-VN");
  const shortDate = new Intl.DateTimeFormat("vi-VN", {day:"2-digit", month:"2-digit", year:"numeric"});
  const textDate = stamp => shortDate.format(stamp);
  const fmt = value => number.format(value);
  const empty = () => ({total:0, done:0, right:0, wrong:0, attempts:0, solid:0, due:0, uncertain:0,
    essays:0, written:0, writtenDue:0, essayDrafts:0, read:0, unitTotal:0, drafts:0, feedback:0, nextDue:0});
  function combine(a, b) {
    for (const k of Object.keys(a)) {
      if (k === "nextDue") {
        if (b[k] && (!a[k] || b[k] < a[k])) a[k] = b[k];
      } else a[k] += b[k];
    }
    return a;
  }
  function el(tag, value, cls) {
    const n = document.createElement(tag);
    if (value != null) n.textContent = value;
    if (cls) n.className = cls;
    return n;
  }
  function anchor(url, label, cls) {
    const a = el("a", label, cls);
    a.href = url;
    return a;
  }
  function snapshot() {
    const records = new Map();
    let readable = true;
    try {
      const storage = window.localStorage;
      for (let n=0; n<storage.length; n++) {
        const k = storage.key(n);
        if (!k || ![testKey,extraKey,formKey,notebookKey].some(prefix => k.startsWith(prefix))) continue;
        try { records.set(k, JSON.parse(storage.getItem(k))); } catch { /* Skip an unreadable older entry. */ }
      }
    } catch { readable = false; }
    return {records,readable,now:Date.now()};
  }
  function timing(stats, r, now) {
    if (!Number.isFinite(r.due) || r.due<=0) return;
    if (r.due<=now) stats.due++;
    else if (!stats.nextDue || r.due<stats.nextDue) stats.nextDue = r.due;
  }
  function counted(stats, r, now) {
    stats.total++;
    if (!r || !r.tries) return;
    stats.done++;
    stats.attempts += Number(r.tries) || 0;
    if (r.right === true) stats.right++;
    if (r.right === false) stats.wrong++;
    if (r.unsure) stats.uncertain++;
    if (r.seen) stats.feedback++;
    if (r.streak>=2) stats.solid++;
    timing(stats,r,now);
  }
  const loopLabels={mini:"Tiểu mục",chapter:"Bộ 80 câu",exam:"Đề đã nộp"};
  const attemptDate=new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"});
  function resumeUrl(page,id) {
    return page.url+"?on=tiep-tuc&buoi="+encodeURIComponent(id)+"#on-lai";
  }
  function savedLoops(page,prefix,record,snap,exam) {
    const rows=[];
    function add(id,type,allowed,answerKeys,unitTitle,submitted) {
      const s=record(id);
      if(s.done || !Array.isArray(s.pending) || !s.pending.length || typeof s.signature!=="string")return;
      const signature=s.signature.split("."), allowedIds=new Set(allowed);
      const left=new Set([...s.pending,...(s.again||[])]);
      if(signature.some(q=>!allowedIds.has(q)) || [...left].some(q=>!signature.includes(q)))return;
      const attempt=submitted && (exam.history||[]).find(h=>h.at===submitted);
      const paperAnswers=attempt?.answers || (submitted===exam.lastDate && exam.finished ? exam.answers : null);
      const marks=submitted ? record("exam-flags:"+submitted) : {};
      let wrong=0,marked=0,unknown=0;
      for(const q of left){
        const now=q===s.pending[0], grade=Number(answerKeys?.[allowed.indexOf(q)]);
        const retry=(s.again||[]).includes(q) || s.round>1;
        let w=false,m=false,unclear=false;
        if(retry){
          const previous=record(q), token=(type==="mini"?"":id+":")+s.run+":";
          if(previous.lastLoop===token+s.round+":"+q || previous.lastLoop===token+(s.round-1)+":"+q){
            w=previous.right===false;m=previous.right===true;unclear=w;
          }else unclear=true;
        }else if(submitted){
          const choice=paperAnswers?.[q];
          w=choice ? choice.choice!==grade : false;
          m=marks[q] ?? !!choice?.unsure;
          unclear=!choice;
        }
        const known=s.reasons?.[q];
        if(typeof known?.wrong==="boolean")w=known.wrong;
        if(typeof known?.marked==="boolean")m=known.marked;
        if(typeof known?.wrong==="boolean" && typeof known?.marked==="boolean")unclear=false;
        if(now && Number.isInteger(s.choice)){w=s.choice!==grade;m=!!s.flag;unclear=false;}
        else if(now && s.flag)m=true;
        if(w)wrong++;
        if(m)marked++;
        if(unclear)unknown++;
      }
      rows.push({id,type,page,title:unitTitle||page.title,sub:unitTitle?page.title:submitted?"Nộp lúc "+attemptDate.format(submitted):"",
        remaining:left.size,total:signature.length,round:s.round||1,wrong,marked,unknown,time:s.touched||s.run||submitted||0});
    }
    for(const u of page.units)add("loop:"+u.anchor,"mini",u.questions,u.keys,u.title);
    if(page.kind==="chapter")add("chapter-loop","chapter",page.mc,page.keys);
    else for(const k of snap.records.keys()){
      if(!k.startsWith(prefix+"exam-loop:"))continue;
      const id=k.slice(prefix.length);
      if(/^exam-loop:\d{1,14}$/.test(id))add(id,"exam",page.mc,page.keys,"",Number(id.slice(10)));
    }
    return rows;
  }
  let selectedLoopType="all";
  function showSaved(rows,readable){
    const host=root.querySelector("[data-saved-loops]");
    if(!host)return;
    const loops=rows.flatMap(row=>row.loops).sort((a,b)=>b.time-a.time);
    const counter=root.querySelector("[data-loop-count]");
    counter.textContent=loops.length ? fmt(loops.length)+" buổi" : "";
    if(!loops.length){
      const p=el("p",readable?"Chưa có buổi ôn dở trên trình duyệt này. Khi bạn dừng giữa lượt, buổi ôn sẽ xuất hiện ở đây.":"Trình duyệt chưa cho đọc tiến độ đã lưu.");
      host.replaceChildren(p,anchor("#danh-sach-chuong","Chọn chương hoặc đề thi"));return;
    }
    const countsByType=new Map();
    for(const entry of loops)countsByType.set(entry.type,(countsByType.get(entry.type)||0)+1);
    if(!countsByType.has(selectedLoopType))selectedLoopType="all";
    const filterBar=el("div",null,"loop-filters");
    filterBar.setAttribute("role","group");filterBar.setAttribute("aria-label","Lọc buổi đang ôn");
    if(countsByType.size>1){
      for(const [key,label,count] of [["all","Tất cả",loops.length],...Object.entries(loopLabels).map(([key,label])=>[key,label,countsByType.get(key)])]){
        if(!count)continue;
        const button=el("button",label+" ("+fmt(count)+")");
        button.type="button";button.dataset.loopType=key;
        button.setAttribute("aria-pressed",String(key===selectedLoopType));
        button.onclick=()=>{selectedLoopType=key;showSaved(rows,readable);host.querySelector('[data-loop-type="'+key+'"]')?.focus();};
        filterBar.append(button);
      }
    }
    const visible=loops.filter(s=>selectedLoopType==="all" || selectedLoopType===s.type);
    const cards=visible.map((s,i)=>{
      const box=el("article",null,"saved-loop");
      const body=el("div"), meta=el("p",loopLabels[s.type]+" · Lượt "+fmt(s.round),"loop-kind");
      body.append(meta,el("h3",s.title));
      if(s.sub)body.append(el("p",s.sub,"meta"));
      const counts=el("p",null,"loop-counts");
      counts.append(el("strong","Còn "+fmt(s.remaining)+"/"+fmt(s.total)+" câu"),el("span",fmt(s.wrong)+" sai"),el("span",fmt(s.marked)+" đánh dấu"));
      body.append(counts);
      if(s.unknown)body.append(el("p","Bản cũ chưa lưu đủ lý do cho "+fmt(s.unknown)+" câu. Các số sai và đánh dấu ở trên chỉ tính phần xác định được.","meta"));
      const link=anchor(resumeUrl(s.page,s.id),"Học tiếp",i===0?"button":"button secondary");
      link.setAttribute("aria-label","Học tiếp · "+s.title+(s.sub?" · "+s.sub:""));
      box.append(body,link);return box;
    });
    host.replaceChildren(...(filterBar.childElementCount?[filterBar]:[]),...cards,el("p","Số còn lại gồm cả câu chưa làm. Một câu vừa sai vừa đánh dấu chỉ tính một lần vào số còn lại.","meta"));
  }
  function pageState(course, page, snap) {
    const prefix = testKey + course.slug + ":" + page.page + ":";
    const record = id => snap.records.get(prefix+id) || {};
    const legacy = snap.records.get(formKey+page.form) || {};
    const stats = empty();
    const exam = record("exam-session");
    const examChoices = Object.values(exam.answers || {}).filter(a => Number.isInteger(a.choice)).length;
    let recent = 0;
    function check(id,s) {
      const r=record(id);
      counted(s,r,snap.now);
      recent=Math.max(recent,r.last || 0);
      return r;
    }
    page.mc.forEach((id,n) => {
      const r=check(id,stats);
      if (!r.tries && /^[0-3]$/.test(String(legacy.choices?.[page.fields[n]]))) stats.drafts++;
    });
    const units = page.units.map(unit => {
      const result=empty();
      for (const id of unit.questions) check(id,result);
      combine(stats,result);
      const path = record("mini-path:"+unit.anchor);
      const position = path.signature===unit.questions.join(".") && Number.isInteger(path.at) ? path.at : 0;
      const loop = record("loop:"+unit.anchor);
      return {unit, stats:result, position, round:loop.signature===unit.questions.join(".") && !loop.done ? loop.round : 0};
    });
    for (const id of page.bonus) check(id,stats);
    for (const [id, field] of page.essays) {
      const r = record(id);
      stats.essays++;
      if (r.selfDate) {
        stats.written++;
        if (r.due>0 && r.due<=snap.now) stats.writtenDue++;
        if (r.due>snap.now && (!stats.nextDue || r.due<stats.nextDue)) stats.nextDue=r.due;
      }
      if ([r.draft,r.revision,legacy.essays?.[field]].some(v=>typeof v==="string" && v.trim())) stats.essayDrafts++;
      recent=Math.max(recent,r.selfDate || 0);
    }
    stats.read=Math.min(units.length, Math.max(0,Number(snap.records.get(notebookKey+page.page))||0));
    stats.unitTotal=units.length;
    recent=Math.max(recent,exam.lastDate || 0);
    const started=!!(stats.done || stats.read || stats.written || stats.essayDrafts || stats.drafts || examChoices || exam.lastDate || units.some(u => u.position || u.round));
    const loops=catalog.all ? [] : savedLoops(page,prefix,record,snap,exam);
    return {page,stats,units,exam,examChoices,recent,started:started || !!loops.length,loops};
  }
  function courseState(course,snap) {
    const rows = course.pages.map(page => pageState(course,page,snap));
    const stats = rows.reduce((acc, row)=>combine(acc,row.stats),empty());
    const extra=empty();
    const prefix=extraKey+course.slug+":";
    for (const [key,r] of snap.records) {
      if (key.startsWith(prefix) && r && typeof r==="object") counted(extra,r,snap.now);
    }
    return {course,rows,stats,extra};
  }
  function meter(label, val, total) {
    const box=el("div",null,"progress-meter");
    const caption=el("div");
    caption.append(el("span",label),el("b",fmt(val)+" / "+fmt(total)));
    const bar=el("progress");
    bar.max=Math.max(total,1); bar.value=val; bar.setAttribute("aria-label",label);
    box.append(caption,bar);
    return box;
  }
  function countBox(stats) {
    const region=el("div",null,"progress-metrics");
    for (const [value,label] of [[stats.right,"Câu đúng"],[stats.wrong,"Câu sai"],[stats.due,"Câu đến hẹn"],[stats.attempts,"Lượt trả lời"]]) {
      const p=el("div");p.append(el("strong",fmt(value)),el("span",label));region.append(p);
    }
    return region;
  }
  function writeSummary(stats,extra,readable) {
    const meters=el("div",null,"progress-meter-grid");
    meters.append(meter("Trắc nghiệm đã làm",stats.done,stats.total),meter("Nhớ lại đúng sau 24 giờ",stats.solid,stats.total));
    const nodes=[meters,countBox(stats),
      el("p","Đúng và sai tính theo lần trả lời gần nhất của mỗi câu. Lượt trả lời tính cả những lần làm lại.","meta")];
    if (!catalog.all) {
      const footer=el("ul",null,"progress-footnotes");
      footer.append(el("li","Tự luận đã tự chấm "+fmt(stats.written)+"/"+fmt(stats.essays)+
        (stats.writtenDue?" · "+fmt(stats.writtenDue)+" bài đến hẹn":"")+(stats.essayDrafts?" · "+fmt(stats.essayDrafts)+" bài có bản viết":"")));
      footer.append(el("li","Sổ tay đã mở đến "+fmt(stats.read)+"/"+fmt(stats.unitTotal)+" tiểu mục."));
      if (stats.feedback || stats.uncertain) footer.append(el("li",fmt(stats.feedback)+" câu đã đánh dấu đối chiếu lời giải · "+fmt(stats.uncertain)+" câu còn phân vân."));
      if (stats.drafts) footer.append(el("li",fmt(stats.drafts)+" lựa chọn từ bản cũ đang chờ chấm."));
      if (stats.nextDue) footer.append(el("li","Lịch ôn tiếp theo · "+textDate(stats.nextDue)));
      nodes.push(footer);
    }
    if (extra.done) nodes.push(el("p","Bài bổ trợ đã làm "+fmt(extra.done)+" câu · "+fmt(extra.right)+" đúng, "+fmt(extra.wrong)+" sai ở lượt gần nhất.","meta"));
    if (!readable) nodes.unshift(el("p","Hãy cho phép trình duyệt đọc bộ nhớ của trang để hiển thị kết quả đã lưu.","review-storage"));
    summary.replaceChildren(...nodes);
  }
  function addLink(parent,url,label) {parent.append(anchor(url,label));}
  function courseCard(state) {
    const {course,stats}=state;
    const box=el("article",null,"progress-course");
    const h=el("h3");h.append(anchor(course.slug+"/on-lai.html",course.title));box.append(h);
    box.append(meter("Câu đã làm",stats.done,stats.total));
    box.append(el("p",fmt(stats.right)+" đúng · "+fmt(stats.wrong)+" sai · "+fmt(stats.due)+" đến hẹn","meta"));
    addLink(box,course.slug+"/on-lai.html","Xem tiến độ môn");
    return box;
  }
  function suggest(state) {
    const {rows}=state;
    const byTime=[...rows].sort((a,b)=>b.recent-a.recent);
    const box=el("div",null,"progress-next");
    const heading=el("h2","Ôn tiếp");
    let target=byTime.find(r=>r.stats.due || r.stats.writtenDue);
    if (target) {
      const {page,stats}=target;
      box.append(el("p",page.title));
      if (stats.due) addLink(box,page.url+"?on=den-hen#on-lai","Ôn câu đến hẹn ("+fmt(stats.due)+")");
      if (stats.writtenDue) addLink(box,page.url+"?reprendre=essay-due#on-lai","Ôn tự luận đến hẹn ("+fmt(stats.writtenDue)+")");
    } else {
      target=byTime.find(r=>r.examChoices && !r.exam.finished);
      if (target) {
        addLink(box,target.page.url+"?reprendre=exam#on-lai","Tiếp tục "+target.page.title+" · "+target.examChoices+"/"+target.page.mc.length+" câu đã chọn");
      } else {
        target=byTime.find(r=>r.units.some(u=>u.position>0 && u.position<u.unit.questions.length));
        if (target) {
          const u=target.units.find(v=>v.position>0 && v.position<v.unit.questions.length);
          addLink(box,target.page.url+"?reprendre=mini#"+u.unit.anchor+"-trac-nghiem","Làm tiếp từ câu "+(u.position+1)+" · "+u.unit.title);
        } else {
          target=byTime.find(r=>r.started) || rows[0];
          if (target) {
            const u=target.units[Math.max(0,target.stats.read-1)];
            const label=u ? "Đọc "+u.unit.title : "Mở "+target.page.title;
            addLink(box,target.page.url+(u?"#"+u.unit.anchor:"#on-lai"),label);
          }
        }
      }
    }
    nextBox.replaceChildren(heading,box);
  }
  function renderPage(row) {
    const {page,stats,units,exam,examChoices}=row;
    const card=el("article",null,"progress-row");
    const heading=el("h3");heading.append(anchor(page.url+"#on-lai",page.title));card.append(heading);
    card.append(meter("Trắc nghiệm",stats.done,stats.total));
    card.append(el("p",fmt(stats.right)+" đúng · "+fmt(stats.wrong)+" sai · "+fmt(stats.due)+" đến hẹn · Tự luận "+fmt(stats.written)+"/"+fmt(stats.essays),"meta"));
    const actions=el("div",null,"progress-links");
    if (stats.due) addLink(actions,page.url+"?on=den-hen#on-lai","Ôn câu đến hẹn");
    if (stats.writtenDue) addLink(actions,page.url+"?reprendre=essay-due#on-lai","Ôn tự luận đến hẹn");
    if (page.kind==="exam") {
      if (exam.lastDate) card.append(el("p","Lượt nộp gần nhất · "+fmt(exam.lastScore||0)+"/"+page.mc.length+" câu đúng, "+textDate(exam.lastDate)+".","meta"));
      if (examChoices && !exam.finished) addLink(actions,page.url+"?reprendre=exam#on-lai","Tiếp tục đề · "+examChoices+"/"+page.mc.length);
      else addLink(actions,page.url+"#on-lai",exam.finished?"Xem kết quả và thi lại":"Mở đề thi");
    }
    if (actions.children.length) card.append(actions);
    if (stats.drafts || stats.essayDrafts) {
      card.append(el("p",[stats.drafts?stats.drafts+" lựa chọn chờ chấm":"",stats.essayDrafts?stats.essayDrafts+" bài có bản viết":""].filter(Boolean).join(" · "),"meta"));
    }
    if (units.length) {
      const details=el("details",null,"progress-units");
      details.dataset.page=page.page;
      details.append(el("summary","Tiến độ "+units.length+" tiểu mục"));
      const ul=el("ul");
      units.forEach(({unit,stats:s,position,round})=>{
        const li=el("li"), detail=el("div");
        const route=page.url+"#"+unit.anchor+"-trac-nghiem";
        detail.append(anchor(route,unit.title),el("p",s.done+"/"+s.total+" đã làm · "+s.right+" đúng · "+s.wrong+" sai","meta"));
        const controls=el("div",null,"progress-links");
        const resume=position>0 && position<unit.questions.length;
        addLink(controls,page.url+"?reprendre=mini#"+unit.anchor+"-trac-nghiem",resume?"Tiếp từ câu "+(position+1):s.done?"Làm lại":"Làm "+s.total+" câu");
        if (round) addLink(controls,resumeUrl(page,"loop:"+unit.anchor),"Tiếp tục ôn đến hết · lượt "+round);
        if (s.due) addLink(controls,page.url+"?reprendre=mini-due#"+unit.anchor+"-trac-nghiem","Ôn "+s.due+" câu đến hẹn");
        li.append(detail,controls);ul.append(li);
      });
      details.append(ul);card.append(details);
    }
    return card;
  }
  function paint() {
    const snap=snapshot(), subjects=catalog.courses.map(c=>courseState(c,snap));
    const stats=subjects.reduce((acc,s)=>combine(acc,s.stats),empty());
    const extra=subjects.reduce((acc,s)=>combine(acc,s.extra),empty());
    writeSummary(stats,extra,snap.readable);
    if (catalog.all) courseCards.replaceChildren(...subjects.map(courseCard));
    else {
      const state=subjects[0];
      showSaved(state.rows,snap.readable);
      suggest(state);
      const opened=new Set([...list.querySelectorAll("details[open]")].map(d=>d.dataset.page));
      const rows=state.rows.filter(r=>(kind.value==="all" || r.page.kind===kind.value) &&
        (filter.value==="all" || (filter.value==="started" && r.started) || (filter.value==="new" && !r.started) ||
         (filter.value==="due" && (r.stats.due || r.stats.writtenDue))));
      status.textContent=rows.length?"Đang hiển thị "+rows.length+"/"+state.rows.length+" mục.":"Chưa có mục nào ứng với bộ lọc này.";
      list.replaceChildren(...rows.map(renderPage));
      for (const d of list.querySelectorAll("details")) d.open=opened.has(d.dataset.page);
    }
  }
  let pending=false;
  function schedule() {
    if (pending) return;
    pending=true;requestAnimationFrame(()=>{pending=false;paint();});
  }
  for (const field of [kind,filter]) field?.addEventListener("change",paint);
  window.addEventListener("pageshow",schedule);
  window.addEventListener("study:progress",schedule);
  window.addEventListener("storage", e => {
    if (!e.key || [testKey,extraKey,formKey,notebookKey].some(k=>e.key.startsWith(k))) schedule();
  });
  document.addEventListener("visibilitychange",()=>{if (!document.hidden) schedule();});
  paint();
})();
