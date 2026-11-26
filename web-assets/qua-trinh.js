(() => {
  "use strict";
  const all = (root, selector) => Array.from(root.querySelectorAll(selector));
  const by = (root, selector) => root.querySelector(selector);
  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Reading remains available. */ }
  }
  function openAnchor() {
    const target = document.getElementById(location.hash.slice(1));
    if (target?.matches("details[data-process], details[data-lib-group]")) target.open = true;
  }
  openAnchor();
  window.addEventListener("hashchange", openAnchor);
  for (const item of all(document, "[data-process]")) {
    const key = "on-thi:qua-trinh:1:" + item.id;
    const steps = all(item, "[data-step]");
    const old = read(key) || {};
    let index = Number.isInteger(old.index) && steps[old.index] ? old.index : 0;
    const viewed = new Set(Array.isArray(old.viewed) ? old.viewed.filter(i => Number.isInteger(i) && steps[i]) : []);
    const test = by(item, "[data-answer]");
    const choices = all(test, "[data-choice]");
    const answer = Number(test.dataset.answer);
    let choice = Number.isInteger(old.choice) && choices[old.choice] ? old.choice : null;
    const back = by(item, "[data-prev]");
    const next = by(item, "[data-next]");
    const feedback = by(item, "[data-feedback]");
    function draw() {
      if (item.open) viewed.add(index);
      steps.forEach((step, i) => { step.hidden = i !== index; });
      by(item, "[data-step-count]").textContent = "Bước " + (index + 1) + " / " + steps.length;
      back.disabled = index === 0;
      next.disabled = index === steps.length - 1;
      const passed = choice === answer && viewed.size === steps.length;
      by(item, "[data-state]").textContent = passed ? "Đã hoàn thành" : viewed.size ? "Đã xem " + viewed.size + "/" + steps.length : "";
      choices.forEach((button,i) => button.setAttribute("aria-pressed",String(i === choice)));
      const attempted = choice !== null;
      feedback.textContent = attempted ? (choice === answer ? "Đúng. " : "Chưa đúng. ") + by(test,".process-key p").textContent : "";
      by(test,".process-key").hidden = true;
      save(key,{index,viewed:[...viewed],choice});
    }
    by(item,".process-controls").hidden = false;
    const again = by(item,"[data-repeat]");
    again.hidden = false;
    function move(delta) {
      index = Math.max(0,Math.min(steps.length-1,index + delta));
      draw();
    }
    back.addEventListener("click",() => move(-1));
    next.addEventListener("click",() => move(1));
    choices.forEach((button,i) => button.addEventListener("click",() => {choice = i; draw();}));
    again.addEventListener("click",() => {index=0; choice=null; viewed.clear(); draw(); back.parentElement.scrollIntoView({block:"nearest"});});
    item.addEventListener("toggle",draw);
    draw();
  }
  const filter = by(document,"[data-process-filter]");
  if (filter) {
    const clean = text => text.toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");
    const groups = all(document,"[data-lib-group]");
    let previouslyOpen = null;
    by(document,"[data-filter-label]").hidden=false;
    filter.addEventListener("input",() => {
      const words = clean(filter.value).trim().split(/\s+/).filter(Boolean);
      if (words.length && !previouslyOpen) previouslyOpen=groups.map(g=>g.open);
      let total=0;
      groups.forEach((group,index) => {
        const items=all(group,"[data-lib-item]");
        let count=0;
        for (const item of items) {
          item.hidden=!words.every(w=>clean(item.textContent).includes(w));
          if (!item.hidden) count++;
        }
        total+=count;
        group.hidden=count===0;
        if (words.length) group.open=count>0;
        else if (previouslyOpen) group.open=previouslyOpen[index];
      });
      if (!words.length) previouslyOpen=null;
      by(document,"[data-filter-result]").textContent=words.length ? total+" hoạt động phù hợp." : "";
    });
  }
  const personal = by(document, "[data-personal]");
  if (!personal) return;

  const input = by(personal, "[data-import]");
  const status = by(personal, "[data-import-status]");
  const body = by(personal, "[data-personal-body]");
  const planKey = "on-thi:lich-ca-nhan:v1";
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
  const courses = new Map([
    ["vi-sinh-vat", "Vi sinh vật"],
    ["sinh-hoc-te-bao", "Sinh học tế bào"],
    ["sinh-hoc-phan-tu-di-truyen", "Sinh học phân tử và di truyền"]
  ]);
  const chapters = new Map();
  const activities = new Map();
  for (const li of all(document,"[data-lib-item]")) {
    const a = by(li,"a");
    const label = by(li,"small");
    if (!a || !label) continue;
    const [path] = a.getAttribute("href").split("#");
    chapters.set(path, label.textContent);
    activities.set(a.getAttribute("href"), a.textContent);
  }
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  const validDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().startsWith(value);
  const validTime = value => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const validId = value => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  const shortText = value => typeof value === "string" && value.length > 0 && value.length <= 2000;
  function validEvent(event) {
    if (!event || !["study","rest","exam"].includes(event.kind) ||
        !validTime(event.start) || !validTime(event.end) || event.start >= event.end ||
        !shortText(event.title) || !shortText(event.goal) || (event.room !== undefined && !shortText(event.room))) return false;
    if (event.kind !== "study") return true;
    return courses.has(event.course) && Array.isArray(event.chapters) && event.chapters.every(validId) &&
      ["study","review","exam1","exam2","exam3","exam4","exam5"].includes(event.mode) &&
      (event.activity === undefined || (event.activity && typeof event.activity === "object" &&
       !Array.isArray(event.activity) && Object.entries(event.activity).every(([id,target]) => validId(id) && validId(target))));
  }
  function validPlan(days) {
    return Array.isArray(days) && days.length > 0 && days.length <= 366 &&
      days.every((day,i) => day && validDate(day.date) && (i === 0 || day.date > days[i-1].date) &&
        shortText(day.title) && Array.isArray(day.events) && day.events.length <= 32 && day.events.every(validEvent));
  }
  function privateRoute() {
    return ["#ca-nhan", "#lich-on"].includes(location.hash) ||
      /^#ngay-\d{4}-\d{2}-\d{2}$/.test(location.hash);
  }
  function getPlan() {
    if (location.protocol === "file:") {
      const offline = document.getElementById("offline-personal-calendar");
      if (offline) {
        try {
          const value = JSON.parse(offline.textContent);
          if (validPlan(value)) return value;
        } catch { /* A manually imported plan is still usable. */ }
      }
    }
    const value = read(planKey);
    return validPlan(value) ? value : null;
  }
  function shortDate(date) { return date.slice(8,10) + "/" + date.slice(5,7); }
  function appendLink(container, href, label) {
    const a = element("a",label);
    a.href = href;
    container.append(a);
  }
  function taskKey(date, index) { return "on-thi:lich-2026:" + date + "-" + index; }
  let plan = null;
  let selectedDate = null;
  const sessionChecks = new Map();
  function checked(key) { return sessionChecks.has(key) ? sessionChecks.get(key) : read(key) === true; }
  function renderDay(date) {
    body.replaceChildren();
    if (!plan) return;
    let index = plan.findIndex(day => day.date === date);
    if (index < 0) {
      const next = plan.findIndex(day => day.date >= today);
      index = next < 0 ? plan.length - 1 : next;
    }
    const day = plan[index];
    selectedDate = day.date;
    const calendar = element("div",undefined,"study-calendar");
    calendar.dataset.calendar = "";
    const nav = element("div",undefined,"day-navigation");
    const prev = element("button","←");
    const next = element("button","→");
    prev.type = next.type = "button";
    prev.setAttribute("aria-label","Ngày trước");
    next.setAttribute("aria-label","Ngày sau");
    prev.disabled = index === 0;
    next.disabled = index === plan.length-1;
    const label = element("label","Chọn ngày ");
    const select = element("select");
    select.dataset.daySelect = "";
    for (const d of plan) select.add(new Option(shortDate(d.date) + " · " + d.title, d.date));
    select.value = day.date;
    label.append(select);
    const count = element("span");
    count.dataset.calendarCount = "";
    count.setAttribute("aria-live","polite");
    function updateCount() {
      let total=0, done=0;
      for (const d of plan) d.events.forEach((e,i) => {
        if (e.kind === "study") {
          total++;
          if (checked(taskKey(d.date,i))) done++;
        }
      });
      count.textContent = done + "/" + total + " buổi đã học";
    }
    function navigate(to, focus) {
      history.replaceState(null,"","#ngay-"+to);
      renderDay(to);
      const node=by(body,focus);
      (node && !node.disabled ? node : by(body,"select")).focus({preventScroll:true});
    }
    prev.dataset.dayPrev = ""; next.dataset.dayNext = "";
    prev.addEventListener("click",()=>navigate(plan[index-1].date,"[data-day-prev]"));
    next.addEventListener("click",()=>navigate(plan[index+1].date,"[data-day-next]"));
    select.addEventListener("change",()=>navigate(select.value,"select"));
    nav.append(prev,label,next,count);
    const article = element("article",undefined,"calendar-day");
    article.id = "ngay-"+day.date;
    article.dataset.day = day.date;
    const list = element("ol");
    day.events.forEach((e,i) => {
      const li = element("li",undefined,"day-"+e.kind);
      const details = element("div");
      if (e.kind === "study") details.append(element("small",courses.get(e.course)));
      details.append(element("strong",e.title), element("p",e.goal));
      if (e.room) details.append(element("p","Phòng thi · "+e.room));
      if (e.kind === "study") {
        const links = element("div",undefined,"day-links");
        if (e.mode === "review") appendLink(links,e.course+"/on-lai.html","Mở lượt ôn và câu đã đánh dấu");
        if (/^exam[1-5]$/.test(e.mode)) appendLink(links,e.course+"/de-thi/de-0"+e.mode.slice(-1)+".html","Mở đề thi thử");
        for (const chapter of e.chapters) {
          const path = e.course+"/chuong/"+chapter+".html";
          if (!chapters.has(path)) continue;
          const activity = path+"#"+(e.activity?.[chapter] || "");
          if (activities.has(activity)) appendLink(links,activity,activities.get(activity));
          else appendLink(links,path+"#qua-trinh-"+chapter,chapters.get(path));
        }
        const task = element("label",undefined,"day-check");
        const box = element("input");
        box.type = "checkbox"; box.dataset.task = day.date+"-"+i;
        const key=taskKey(day.date,i);
        box.checked=checked(key);
        box.addEventListener("change",()=>{
          sessionChecks.set(key,box.checked);
          save(key,box.checked);
          updateCount();
        });
        task.append(box," Đã học");
        details.append(links,task);
      }
      li.append(element("time",e.start+"–"+e.end),details);
      list.append(li);
    });
    updateCount();
    article.append(element("h3",shortDate(day.date)+" · "+day.title),list);
    calendar.append(nav,article);
    body.append(calendar);
  }
  input.addEventListener("change", async () => {
    const file=input.files[0];
    if (!file) return;
    try {
      if (file.size > 1024*1024) throw new Error();
      const imported=JSON.parse((await file.text()).replace(/^\uFEFF/,""));
      if (!validPlan(imported)) throw new Error();
      plan=imported;
      save(planKey,plan);
      status.textContent=read(planKey) ? "Đã mở lịch và lưu vào trình duyệt này." : "Đã mở lịch cho lượt xem này. Trình duyệt đang chặn lưu lịch.";
      if(privateRoute()) renderDay(location.hash.startsWith("#ngay-") ? location.hash.slice(6) : selectedDate);
    } catch {
      status.textContent="Tệp chưa đọc được. Hãy chọn tệp lịch ôn dạng JSON.";
    }
    input.value="";
  });
  function reflectRoute() {
    const visible=privateRoute();
    const wasHidden=personal.hidden;
    personal.hidden=!visible;
    if (!visible) { body.replaceChildren(); return; }
    if (!plan) plan=getPlan();
    renderDay(location.hash.startsWith("#ngay-") ? location.hash.slice(6) : selectedDate);
    if (wasHidden) personal.scrollIntoView({block:"start"});
  }
  window.addEventListener("hashchange",reflectRoute);
  reflectRoute();
})();
