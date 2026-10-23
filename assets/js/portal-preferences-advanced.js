/* NOVA FROTA | Personalização avançada v1.
   Aplica somente mudanças visuais aos elementos que a sessão já autorizou. */
(function(){
  "use strict";
  const home = /(?:^|\/)home\.html$/i.test(location.pathname);
  const root = document.documentElement;
  const BASE = Object.freeze({
    cardOrder: [], favorites: [], background: "original", imageOpacity: 100,
    fontSize: "normal", reduceMotion: false, stickyHeaders: false, columns: {}
  });
  const prefs = window.NovaFrotaPreferences;
  if(!prefs)return;
  const $ = (s,p=document)=>p.querySelector(s);
  const $$ = (s,p=document)=>Array.from(p.querySelectorAll(s));
  const getUser = () => {
    try {
      return String((typeof window.getUser === "function" && window.getUser()) ||
        localStorage.getItem("nf_auth_user") || "").trim().toUpperCase().slice(0,128);
    } catch(_) {return "";}
  };
  const storageKey = () => getUser() ? "nf:ui-advanced:v1:" + encodeURIComponent(getUser()) : "";
  let owner = "";
  let state = {...BASE};
  let selectedTable = null;
  let lastTableScan = 0;
  let scanTimer = null;
  let currentCardList = [];
  const initialCards = new WeakMap();
  const navIndices = new WeakMap();
  const tableRegistry = new Map();
  let observer = null;
  let navObserver = null;
  const VALID_KEY = /^[a-z0-9_-]{1,48}$/i;
  const cleanKeys = (list,limit=40) => {
    if(!Array.isArray(list))return [];
    return [...new Set(list.filter(x=>typeof x==="string" && VALID_KEY.test(x)))].slice(0,limit);
  };
  function normalize(raw){
    const p = raw && typeof raw==="object" && !Array.isArray(raw) ? raw : {};
    const columns = Object.create(null);
    if(p.columns && typeof p.columns==="object" && !Array.isArray(p.columns)){
      for(const [id,values] of Object.entries(p.columns).slice(0,80)){
        if(!/^[a-z0-9:._-]{1,120}$/i.test(id) || ["__proto__","constructor","prototype"].includes(id) || !Array.isArray(values))continue;
        const indexes = [...new Set(values.filter(v=>Number.isInteger(v)&&v>=0&&v<40))].slice(0,30);
        if(indexes.length)columns[id]=indexes;
      }
    }
    return {
      cardOrder:cleanKeys(p.cardOrder,40),
      favorites:cleanKeys(p.favorites,6),
      background:["original","gradiente","solido"].includes(p.background)?p.background:"original",
      imageOpacity:Number.isFinite(p.imageOpacity)?Math.max(0,Math.min(100,Math.round(p.imageOpacity))):100,
      fontSize:["pequena","normal","grande"].includes(p.fontSize)?p.fontSize:"normal",
      reduceMotion:p.reduceMotion===true,
      stickyHeaders:p.stickyHeaders===true,
      columns
    };
  }
  function load(){
    owner=storageKey();
    if(!owner)return normalize(BASE);
    try{return normalize(JSON.parse(localStorage.getItem(owner)||"null"));}
    catch(_){return normalize(BASE);}
  }
  function save(){if(owner){try{localStorage.setItem(owner,JSON.stringify(state));}catch(_){}}}
  function cardAllowed(card){
    const key=card?.dataset.feature;
    if(!key || card.style.display==="none" || card.hidden)return false;
    return typeof window.canAccessFeature!=="function" || !!window.canAccessFeature(key);
  }
  function homeCards(){
    return $$(".nf-tools > a.nf-tool[data-feature]").filter(cardAllowed);
  }
  function orderedCards(){
    const cards=homeCards();
    const rank=new Map(state.cardOrder.map((key,index)=>[key,index]));
    return cards.sort((a,b)=>(rank.get(a.dataset.feature)??1000)-
      (rank.get(b.dataset.feature)??1000));
  }
  function applyHomeCards(){
    if(!home)return;
    const wrap=$(".nf-tools");if(!wrap)return;
    const all=$$("a.nf-tool[data-feature]",wrap);
    for(const card of all){
      if(!initialCards.has(card))initialCards.set(card,all.indexOf(card));
    }
    const rank=new Map(state.cardOrder.map((key,index)=>[key,index]));
    const sorted=all.slice().sort((a,b)=>{
      const ra=rank.get(a.dataset.feature), rb=rank.get(b.dataset.feature);
      return (ra===undefined?1000+initialCards.get(a):ra) -
             (rb===undefined?1000+initialCards.get(b):rb);
    });
    sorted.forEach((card,i)=>{
      if(wrap.children[i]!==card)wrap.insertBefore(card,wrap.children[i]||null);
    });
    all.forEach(card=>card.classList.toggle("nf-adv-favorite",state.favorites.includes(card.dataset.feature)));
  }
  function applyNavigation(){
    const nav=$("#nfGlobalNav");if(!nav)return;
    const links=$$("a.nf-global-nav-item[data-nav-key]",nav);
    if(!links.length)return;
    links.forEach((el,i)=>{
      if(!navIndices.has(el))navIndices.set(el,i);
      if(!el.dataset.nfOriginalSecondary)el.dataset.nfOriginalSecondary=el.dataset.secondary||"0";
      const favorite=state.favorites.includes(el.dataset.navKey);
      el.classList.toggle("nf-adv-favorite",favorite);
      el.dataset.secondary=favorite?"0":el.dataset.nfOriginalSecondary;
    });
    const rank=new Map(state.favorites.map((k,i)=>[k,i]));
    const sorted=links.slice().sort((a,b)=>{
      const ra=a.dataset.navKey==="home"?-1:(rank.has(a.dataset.navKey)?rank.get(a.dataset.navKey):1000+navIndices.get(a));
      const rb=b.dataset.navKey==="home"?-1:(rank.has(b.dataset.navKey)?rank.get(b.dataset.navKey):1000+navIndices.get(b));
      return ra-rb;
    });
    let changed=false;
    sorted.forEach((el,i)=>{if(nav.children[i]!==el){nav.insertBefore(el,nav.children[i]||null);changed=true;}});
    if(changed)requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")));
  }
  function startNavObserver(){
    const nav=$("#nfGlobalNav");
    if(!nav || navObserver)return;
    navObserver=new MutationObserver(()=>applyNavigation());
    navObserver.observe(nav,{childList:true});
    applyNavigation();
  }
  function safeTable(table){
    if(table.closest("#printSheet,.print-copy,[data-template-preview],.nfPreviewPanel,.nfArtCard,.nfM3Canvas,.nfM4Canvas"))return false;
    const tr=table.tHead?.rows;
    if(!tr || tr.length!==1 || !table.tBodies?.length)return false;
    const cells=[...tr[0].cells];
    if(cells.length<3 || cells.length>35 || cells.some(c=>c.colSpan!==1||c.rowSpan!==1))return false;
    const row=table.tBodies[0].rows?.[0];
    if(row && row.cells.length!==cells.length)return false;
    return true;
  }
  function hash(str){
    let h=2166136261;
    for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);
    return (h>>>0).toString(36);
  }
  function tableId(table,index){
    const headers=[...table.tHead.rows[0].cells].map(c=>c.textContent.trim().replace(/\s+/g," ").slice(0,60)).join("|");
    const id=table.id||table.closest("[id]")?.id||"t";
    const name=location.pathname.split("/").pop().replace(/[^a-z0-9]/gi,"").toLowerCase();
    return name+":"+index+":"+hash(id+"|"+headers);
  }
  function injectTableButton(table,id){
    if(table.previousElementSibling?.dataset?.nfColumnTrigger===id)return;
    const button=document.createElement("button");
    button.type="button";button.className="nf-adv-table-columns";
    button.dataset.nfColumnTrigger=id;
    button.textContent="⚙ Colunas";
    button.setAttribute("aria-label","Personalizar colunas desta tabela");
    button.addEventListener("click",()=>{
      selectedTable=id;
      prefs.open();
      renderColumns();
      $("#nfAdvColumns")?.scrollIntoView({block:"nearest"});
    });
    table.parentNode?.insertBefore(button,table);
  }
  function syncColumnStyles(){
    let style=$("#nfAdvColumnRules");
    if(!style){style=document.createElement("style");style.id="nfAdvColumnRules";document.head.appendChild(style);}
    const rules=[];
    for(const [id,item] of tableRegistry){
      const hidden=state.columns[id]||[];
      for(const i of hidden) {
        if(i>=item.headers.length)continue;
        rules.push("table[data-nf-table-id=\""+id+"\"] tr > :nth-child("+(i+1)+"){display:none!important}");
      }
    }
    style.textContent="@media screen {"+rules.join("\n")+"}";
  }
  function scanTables(){
    if(home)return;
    const tables=$$("table");
    let index=0;
    for(const table of tables){
      if(!safeTable(table))continue;
      const id=tableId(table,index++);
      if(index>20)break;
      const headers=[...table.tHead.rows[0].cells].map(c=>c.textContent.trim()||"Coluna "+(1+index));
      table.dataset.nfTableId=id;
      table.classList.add("nf-pref-managed");
      tableRegistry.set(id,{table,headers});
      // Nunca transformar a seção inteira do módulo em área rolável.
      const host=table.parentElement;
      if(host && host!==document.body && host.tagName==="DIV" &&
         (host.classList.contains("tableWrap") ||
          host.classList.contains("table-wrapper") ||
          host.classList.contains("table-container") ||
          host.classList.contains("overflow-auto") ||
          host.children.length<=2)){
        host.classList.add("nf-pref-scroll-host");
      }
      injectTableButton(table,id);
    }
    for(const [id,item] of tableRegistry){
      if(!item.table.isConnected)tableRegistry.delete(id);
    }
    syncColumnStyles();
  }
  function scheduleScan(){
    if(scanTimer)return;
    scanTimer=window.setTimeout(()=>{scanTimer=null;scanTables();},350);
  }
  function update(patch){
    state=normalize({...state,...patch});
    save();apply();
  }
  function apply(){
    if(home){
      root.dataset.nfBackground=state.background;
      root.style.setProperty("--nf-adv-opacity",String(state.imageOpacity/100));
      // O tema claro mantém a imagem bem discreta, como na Home original.
      root.style.setProperty("--nf-adv-opacity-light",String((state.imageOpacity/100)*0.09));
      applyHomeCards();
    }
    root.dataset.nfFont=state.fontSize;
    root.dataset.nfMotion=state.reduceMotion?"reduzido":"normal";
    root.dataset.nfSticky=state.stickyHeaders?"on":"off";
    applyNavigation();
    syncColumnStyles();
    renderPanel();
  }
  function reset(){
    state=normalize(BASE);
    if(owner){try{localStorage.removeItem(owner);}catch(_){}}
    apply();
  }
  function el(tag,className,text){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function button(label,handler,className="nf-adv-btn"){
    const b=el("button",className,label);b.type="button";b.addEventListener("click",handler);return b;
  }
  function section(heading,id){
    const sec=el("section","nf-pref-section nf-adv-section");
    sec.id=id;
    const h=el("h3","",heading);sec.appendChild(h);return sec;
  }
  function note(text){
    return el("p","nf-pref-note",text);
  }
  function selectFor(key,choices){
    const select=el("select","nf-adv-select");
    for(const [value,label] of choices){
      const option=el("option","",label);option.value=value;select.appendChild(option);
    }
    select.value=state[key];
    select.addEventListener("change",()=>update({[key]:select.value}));
    return select;
  }
  function row(label,control,description){
    const wrap=el("div","nf-pref-row");
    const labels=el("div");
    labels.appendChild(el("strong","",label));
    if(description)labels.appendChild(el("small","",description));
    wrap.append(labels,control);return wrap;
  }
  function toggle(label,key,description){
    const sw=button("","", "nf-pref-switch");
    // Reatribuir o handler: botão sem aparência de ação, mas acessível.
    sw.setAttribute("role","switch");sw.setAttribute("aria-label",label);
    sw.setAttribute("aria-checked",String(!!state[key]));
    sw.addEventListener("click",()=>update({[key]:!state[key]}));
    return row(label,sw,description);
  }
  function moveCard(feature,delta){
    const current=homeCards().map(card=>card.dataset.feature);
    const list=state.cardOrder.length ?
      [...state.cardOrder.filter(key=>current.includes(key)),...current.filter(key=>!state.cardOrder.includes(key))]:
      current;
    const i=list.indexOf(feature);
    const j=i+delta;
    if(i<0||j<0||j>=list.length)return;
    [list[i],list[j]]=[list[j],list[i]];
    update({cardOrder:list});
  }
  function toggleFavorite(feature){
    const cards=homeCards().map(card=>card.dataset.feature);
    if(!cards.includes(feature))return;
    const existing=state.favorites.filter(key=>key!==feature);
    if(!state.favorites.includes(feature) && existing.length>=6)return;
    if(!state.favorites.includes(feature))existing.push(feature);
    update({favorites:existing});
  }
  function renderCards(){
    const list=$("#nfAdvCardList");if(!list)return;
    list.replaceChildren();
    const cards=orderedCards().filter(cardAllowed);
    currentCardList=cards.map(card=>card.dataset.feature);
    if(!cards.length){list.appendChild(note("Aguarde a liberação dos módulos da sessão."));return;}
    cards.forEach((card,i)=>{
      const feature=card.dataset.feature;
      const line=el("div","nf-adv-card-row");
      line.draggable=true;line.dataset.nfFeature=feature;
      const drag=el("span","nf-adv-grip","⠿");drag.title="Arraste para reorganizar";
      const label=el("span","nf-adv-card-label",card.querySelector("h2")?.textContent?.trim()||feature);
      const actions=el("span","nf-adv-card-actions");
      const starred=state.favorites.includes(feature);
      const star=button(starred?"★":"☆",()=>toggleFavorite(feature),"nf-adv-icon");
      star.title=starred?"Remover dos favoritos":"Adicionar aos favoritos no menu";star.setAttribute("aria-label",star.title);
      star.setAttribute("aria-pressed",String(starred));
      const up=button("↑",()=>moveCard(feature,-1),"nf-adv-icon");up.title="Subir";up.disabled=i===0;
      const down=button("↓",()=>moveCard(feature,1),"nf-adv-icon");down.title="Descer";down.disabled=i===cards.length-1;
      actions.append(star,up,down);line.append(drag,label,actions);
      line.addEventListener("dragstart",event=>{
        event.dataTransfer?.setData("text/plain",feature);
        if(event.dataTransfer)event.dataTransfer.effectAllowed="move";
      });
      line.addEventListener("dragover",event=>event.preventDefault());
      line.addEventListener("drop",event=>{
        event.preventDefault();
        const from=event.dataTransfer?.getData("text/plain");
        if(!currentCardList.includes(from)||from===feature)return;
        const next=currentCardList.filter(x=>x!==from);
        next.splice(next.indexOf(feature),0,from);
        update({cardOrder:next});
      });
      list.appendChild(line);
    });
  }
  function renderColumns(){
    const box=$("#nfAdvColumns");if(!box)return;
    const content=$("#nfAdvColumnList",box);if(!content)return;
    content.replaceChildren();
    const item=tableRegistry.get(selectedTable);
    if(!item){content.appendChild(note("Abra a opção ⚙ Colunas acima de uma tabela do módulo para escolher suas colunas."));return;}
    content.appendChild(el("p","nf-adv-column-caption","Tabela: "+(item.headers[0]||"Registros")));
    item.headers.forEach((title,i)=>{
      const rowEl=el("label","nf-adv-column-item");
      const checkbox=el("input");checkbox.type="checkbox";
      checkbox.checked=!(state.columns[selectedTable]||[]).includes(i);
      checkbox.addEventListener("change",()=>{
        const hidden=(state.columns[selectedTable]||[]).filter(n=>n!==i);
        if(!checkbox.checked && hidden.length>=item.headers.length-2){checkbox.checked=true;return;}
        if(!checkbox.checked)hidden.push(i);
        const columns={...state.columns};
        if(hidden.length)columns[selectedTable]=hidden;
        else delete columns[selectedTable];
        update({columns});
      });
      rowEl.append(checkbox,document.createTextNode(title));content.appendChild(rowEl);
    });
  }
  function renderPanel(){
    const base=$("#nfAdvMain");if(!base)return;
    const bg=$("#nfAdvBackground");if(bg)bg.value=state.background;
    const opacity=$("#nfAdvOpacity");if(opacity){opacity.value=String(state.imageOpacity);opacity.disabled=state.background!=="original";}
    const percent=$("#nfAdvOpacityValue");if(percent)percent.textContent=state.imageOpacity+"%";
    const font=$("#nfAdvFont");if(font)font.value=state.fontSize;
    const motion=$("#nfAdvMotion");if(motion)motion.setAttribute("aria-checked",String(state.reduceMotion));
    const sticky=$("#nfAdvSticky");if(sticky)sticky.setAttribute("aria-checked",String(state.stickyHeaders));
    renderCards();
    renderColumns();
  }
  function exportSettings(){
    const payload={version:2,kind:"nova-frota-visual-preferences",
      preferences:prefs.get(),advanced:normalize(state)};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const link=el("a");link.href=url;link.download="nova-frota-preferencias.json";
    document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),2000);
    status("Arquivo JSON criado somente com suas preferências visuais.");
  }
  function validateBasic(p){
    if(!p || typeof p!=="object" || Array.isArray(p))return false;
    if(p.theme!==null && !["escuro","claro","automatico"].includes(p.theme))return false;
    if(typeof p.showMap!=="boolean" || typeof p.showList!=="boolean")return false;
    if(!["padrao","amplo"].includes(p.layout)||!["normal","compacta"].includes(p.density))return false;
    return true;
  }
  function status(message,error=false){
    const node=$("#nfAdvStatus");if(!node)return;
    node.textContent=message;node.classList.toggle("is-error",error);
  }
  function importSettings(file){
    if(!file)return;
    if(file.size>65536){status("Arquivo muito grande. Limite de 64 KB.",true);return;}
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const data=JSON.parse(String(reader.result||""));
        if(data.version!==2 || data.kind!=="nova-frota-visual-preferences" ||
           !validateBasic(data.preferences) || !data.advanced ||
           typeof data.advanced!=="object" || Array.isArray(data.advanced))throw Error("Formato inválido.");
        // Apenas um conjunto fechado de opções visuais. Não há código ou permissões no arquivo.
        const imported=normalize(data.advanced);
        prefs.update(data.preferences);
        state=imported;save();apply();
        status("Preferências importadas. Somente módulos permitidos serão reorganizados.");
      }catch(_){status("Não foi possível importar: JSON ou preferências inválidas.",true);}
    };
    reader.onerror=()=>status("Falha ao ler o arquivo.",true);
    reader.readAsText(file);
  }
  function mount(drawer){
    const scroll=$(".nf-pref-scroll",drawer);
    if(!scroll || $("#nfAdvMain",drawer))return;
    const container=el("div","nf-adv-main");container.id="nfAdvMain";
    if(home){
      const background=section("Plano de fundo da Home","nfAdvBackgroundSection");
      const bgSelect=selectFor("background",[
        ["original","Imagem atual de caminhões"],["gradiente","Degradê azul"],["solido","Cor sólida"]
      ]);
      bgSelect.id="nfAdvBackground";
      background.append(row("Estilo do fundo",bgSelect,"A imagem escolhida não afeta as páginas internas."));
      const opacity=el("input","nf-adv-range");opacity.type="range";opacity.min="0";opacity.max="100";
      opacity.value=String(state.imageOpacity);opacity.id="nfAdvOpacity";
      const percentage=el("span","nf-adv-percentage",state.imageOpacity+"%");percentage.id="nfAdvOpacityValue";
      opacity.addEventListener("input",()=>{percentage.textContent=opacity.value+"%";});
      opacity.addEventListener("change",()=>update({imageOpacity:Number(opacity.value)}));
      const strength=el("div","nf-adv-range-row");
      strength.append(el("span","","Intensidade da imagem"),opacity,percentage);
      background.append(strength);container.appendChild(background);

      const cards=section("Ordem dos cards e favoritos","nfAdvCards");
      cards.appendChild(note("Arraste os módulos liberados ou use ↑ ↓. Toque na estrela para fixar até 6 favoritos no menu superior."));
      const cardList=el("div","nf-adv-card-list");cardList.id="nfAdvCardList";cards.appendChild(cardList);
      container.appendChild(cards);
    }
    const table=section("Tabelas e colunas","nfAdvTables");
    table.append(row("Cabeçalho fixo",switchButton("nfAdvSticky","Cabeçalho fixo","stickyHeaders"),
      "Mantém o título da tabela visível durante a rolagem, quando compatível."));
    const cols=el("div","nf-adv-columns");cols.id="nfAdvColumns";
    cols.appendChild(el("h4","","Colunas visíveis"));
    const colList=el("div","nf-adv-column-list");colList.id="nfAdvColumnList";cols.appendChild(colList);
    table.appendChild(cols);container.appendChild(table);
    const comfort=section("Conforto visual","nfAdvComfort");
    const fontSelect=selectFor("fontSize",[
      ["pequena","Pequena"],["normal","Normal"],["grande","Grande"]
    ]);
    fontSelect.id="nfAdvFont";
    comfort.append(row("Tamanho das letras",fontSelect,"Ajuste de textos, sem alterar regras ou valores."));
    comfort.append(row("Reduzir animações",switchButton("nfAdvMotion","Reduzir animações","reduceMotion"),
      "Evita movimentos e efeitos de transição desnecessários."));
    container.appendChild(comfort);
    const backup=section("Guardar minhas preferências","nfAdvBackup");
    const actions=el("div","nf-adv-transfer");
    actions.append(
      button("↓ Exportar JSON",exportSettings,"nf-adv-transfer-btn"),
      button("↑ Importar JSON",()=>$("#nfAdvFile")?.click(),"nf-adv-transfer-btn")
    );
    backup.appendChild(actions);
    const file=el("input");file.type="file";file.id="nfAdvFile";file.accept=".json,application/json";file.hidden=true;
    file.addEventListener("change",()=>{importSettings(file.files?.[0]);file.value="";});
    backup.appendChild(file);
    const output=el("p","nf-adv-status");output.id="nfAdvStatus";
    output.setAttribute("role","status");backup.appendChild(output);
    backup.appendChild(note("O arquivo exportado contém apenas preferências visuais, nunca credenciais ou dados dos fretes."));
    container.appendChild(backup);
    scroll.appendChild(container);
    renderPanel();
  }
  function switchButton(id,label,key){
    const b=button("",()=>update({[key]:!state[key]}),"nf-pref-switch");
    b.id=id;b.setAttribute("role","switch");b.setAttribute("aria-label",label);
    b.setAttribute("aria-checked",String(state[key]));
    return b;
  }
  function init(){
    state=load();apply();
    if(!home){scanTables();}
    // A navegação comum é criada depois da validação da sessão.
    observer=new MutationObserver(()=>{
      if(!navObserver)startNavObserver();
      if(!home)scheduleScan();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    startNavObserver();
    window.addEventListener("portal:session",()=>{
      const current=storageKey();
      if(current!==owner){state=load();}
      apply();
    });
    window.addEventListener("storage",event=>{
      if(event.key===owner){state=load();apply();}
    });
  }
  window.NovaFrotaAdvanced=Object.freeze({
    get:()=>normalize(state),
    update,reset,mount,
    exportSettings,
    normalize
  });
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();