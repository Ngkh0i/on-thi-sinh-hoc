(() => {
  "use strict";
  const view=document.querySelector("[data-atlas]");
  if (!view) return;
  const home=view.querySelector(".atlas-home"), index=view.querySelector(".atlas-index");
  const input=view.querySelector("input[type=search]"), output=view.querySelector("[role=status]");
  const groups=[...index.querySelectorAll(".atlas-list-group")];
  const cards=new Map([...view.querySelectorAll(".atlas-card")].map(node=>[node.id,node]));
  const trailBox=view.querySelector("[data-trail]");
  const query=new URLSearchParams(location.search);
  const chapters=JSON.parse(document.getElementById("atlas-chapters").textContent);
  const course=chapters[query.get("bai")];
  const source=view.querySelector("[data-return-reading]");
  if (Array.isArray(course)) {
    const code=query.get("bai"), notebook=query.get("so")==="1";
    const id=query.get("moc")||"";
    const safe=id===("tra-"+code) || (id.startsWith(code+"-") && /^[a-z0-9_-]+$/.test(id));
    source.href=course[0]+(notebook?"/so-tay.html":"/chuong/"+code+".html")+"#"+(safe?id:notebook?"tra-"+code:code+"-doc-hieu");
    source.textContent="← "+(notebook?"Về sổ tay":"Về bài")+" · "+course[1];
    source.hidden=false;
  }
  const fold=text=>text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("vi").replace(/đ/g,"d");
  const entries=groups.flatMap(group=>[...group.querySelectorAll("[data-find]")]);
  for (const li of entries) li.dataset.find=fold(li.dataset.find);
  function search() {
    const words=fold(input.value.trim()).split(/\s+/).filter(Boolean);
    let hits=0;
    for(const li of entries) {
      li.hidden=!words.every(k=>li.dataset.find.includes(k));
      if(!li.hidden)hits++;
    }
    for(const group of groups)group.hidden=!group.querySelector("li:not([hidden])");
    output.textContent=words.length ? (hits?hits+" khái niệm phù hợp.":"Chưa thấy từ này. Thử tên ngắn hơn hoặc bỏ bớt một từ.") : "";
  }
  input.addEventListener("input",search);
  const zoom=document.createElement("dialog");
  zoom.className="atlas-zoom";zoom.setAttribute("aria-label","Xem hình phóng to");
  const close=document.createElement("button"), control=document.createElement("input"), size=document.createElement("label");
  close.type="button";close.textContent="Đóng hình";
  control.type="range";control.min="100";control.max="250";control.step="25";control.value="150";
  size.append("Độ phóng đại ",control);
  const bar=document.createElement("div"),pane=document.createElement("div");
  bar.className="atlas-zoom-controls";bar.append(size,close);pane.className="atlas-zoom-pane";
  zoom.append(bar,pane);view.append(zoom);
  const resize=()=>{if(pane.firstElementChild)pane.firstElementChild.style.width=control.value+"%";};
  close.onclick=()=>zoom.close();control.oninput=resize;
  if(typeof zoom.showModal==="function") for(const card of cards.values()){
    const figure=card.querySelector("figure"),button=document.createElement("button");
    button.type="button";button.textContent="Phóng to hình";button.className="atlas-zoom-button";
    button.onclick=()=>{
      const copy=figure.querySelector("svg").cloneNode(true);
      const ids=new Map([...copy.querySelectorAll("[id]")].map(el=>[el.id,"zoom-"+el.id]));
      for(const n of [copy,...copy.querySelectorAll("*")]){
        for(const attr of [...n.attributes]){
          if(attr.name==="id" && ids.has(attr.value))n.id=ids.get(attr.value);
          else if(attr.name==="aria-labelledby")n.setAttribute(attr.name,attr.value.split(/\s+/).map(v=>ids.get(v)||v).join(" "));
          else if(attr.value.includes("url(#"))n.setAttribute(attr.name,attr.value.replace(/url\(#([^)]+)\)/g,(m,k)=>ids.has(k)?"url(#"+ids.get(k)+")":m));
        }
      }
      pane.replaceChildren(copy);control.value=innerWidth<600?"200":"125";resize();zoom.showModal();close.focus();
    };
    figure.append(button);
  }
  pane.addEventListener("click",event=>{if(event.target.closest("a") && zoom.open)zoom.close();});
  let previous=null, nextTrail=null;
  function readRoute(focus) {
    const id=location.hash.slice(1);
    const node=cards.get(id);
    home.hidden=!!node;
    for(const card of cards.values())card.hidden=card!==node;
    trailBox.replaceChildren();trailBox.hidden=true;
    if(node) {
      let trail=Array.isArray(history.state?.atlasTrail)?history.state.atlasTrail:[];
      if(nextTrail)trail=nextTrail;
      if(!trail.length || trail.at(-1)!==id)trail=[id];
      try{history.replaceState({...history.state,atlasTrail:trail},"");}catch{}
      if(trail.length>1){
        const label=document.createElement("span");label.textContent="Vừa đi qua";trailBox.append(label);
        for(const k of trail.slice(-5,-1)){
          if(!cards.has(k))continue;
          const a=document.createElement("a");a.href="#"+k;a.textContent=cards.get(k).querySelector("h2").textContent;
          trailBox.append(a,document.createTextNode(" › "));
        }
        const current=document.createElement("strong");current.textContent=node.querySelector("h2").textContent;
        trailBox.append(current);trailBox.hidden=false;
      }
      if(focus)node.querySelector("h2").focus({preventScroll:true});
      window.scrollTo(0,0);
    } else if(id==="tra-kho") {
      index.scrollIntoView();if(focus)input.focus({preventScroll:true});
    } else window.scrollTo(0,0);
    nextTrail=null;previous=node?.id || null;
  }
  view.addEventListener("click",e=>{
    const a=e.target.closest('a[href^="#"]');
    if(!a || e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;
    const k=a.getAttribute("href").slice(1);
    if(!cards.has(k))return;
    const trail=previous?(history.state?.atlasTrail || [previous]):[];
    const pos=trail.indexOf(k);
    nextTrail=pos>=0?trail.slice(0,pos+1):[...trail,k];
  });
  window.addEventListener("hashchange",()=>readRoute(true));
  window.addEventListener("pageshow",()=>readRoute(false));
  readRoute(false);
})();