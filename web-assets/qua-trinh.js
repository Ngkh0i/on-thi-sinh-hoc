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
  const cal=by(document,"[data-calendar]");
  if (!cal) return;
  const days=all(cal,"[data-day]");
  const select=by(cal,"[data-day-select]");
  if (!select) return;
  const today = new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const inputs=all(cal,"[data-task]");
  function updateCount() {
    by(cal,"[data-calendar-count]").textContent=inputs.filter(x=>x.checked).length+"/"+inputs.length+" buổi đã học";
  }
  for (const input of inputs) {
    const key="on-thi:lich-2026:"+input.dataset.task;
    input.checked=read(key)===true;
    input.addEventListener("change",()=>{save(key,input.checked);updateCount();});
  }
  function show(date, link) {
    let i=days.findIndex(day=>day.dataset.day===date);
    if(i<0) i=today<days[0].dataset.day?0:days.length-1;
    days.forEach((d,n)=>{d.hidden=n!==i;});
    select.value=days[i].dataset.day;
    by(cal,"[data-day-prev]").disabled=i===0;
    by(cal,"[data-day-next]").disabled=i===days.length-1;
    if (link) history.replaceState(null,"","#"+days[i].id);
  }
  function fromHash() {show(location.hash.startsWith("#ngay-")?location.hash.slice(6):today,false);}
  by(cal,".day-navigation").hidden=false;
  select.addEventListener("change",()=>show(select.value,true));
  by(cal,"[data-day-prev]").addEventListener("click",()=>show(days[select.selectedIndex-1].dataset.day,true));
  by(cal,"[data-day-next]").addEventListener("click",()=>show(days[select.selectedIndex+1].dataset.day,true));
  window.addEventListener("hashchange",fromHash);
  fromHash();
  updateCount();
})();