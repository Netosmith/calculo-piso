/* NOVA FROTA | Preferências visuais v1
   Não altera dados, permissões, custos, chamadas de API ou funcionalidade. */
(function(){
  "use strict";

  const BASE = Object.freeze({
    theme:null,       // Sem escolha: conserva o tema original de cada módulo.
    showMap:true,
    showList:true,
    layout:"padrao",
    density:"normal"
  });
  const STATES = {
    AC:"Acre", AL:"Alagoas", AP:"Amapá", AM:"Amazonas", BA:"Bahia",
    CE:"Ceará", DF:"Distrito Federal", ES:"Espírito Santo", GO:"Goiás",
    MA:"Maranhão", MT:"Mato Grosso", MS:"Mato Grosso do Sul",
    MG:"Minas Gerais", PA:"Pará", PB:"Paraíba", PR:"Paraná",
    PE:"Pernambuco", PI:"Piauí", RJ:"Rio de Janeiro",
    RN:"Rio Grande do Norte", RS:"Rio Grande do Sul", RO:"Rondônia",
    RR:"Roraima", SC:"Santa Catarina", SP:"São Paulo", SE:"Sergipe", TO:"Tocantins"
  };
  const home = /(?:^|\/)home\.html$/i.test(window.location.pathname);
  const root = document.documentElement;
  const media = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
  let state = {...BASE};
  let owner = "";
  let lastActive = null;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function username(){
    try{
      // A Ordem de Carregamento não importa auth.js. Reaproveitar apenas
      // o identificador visual já guardado pelo login do Portal Frete.
      const resolved = typeof window.getUser === "function" ? window.getUser() : "";
      const value = resolved || localStorage.getItem("nf_auth_user") || "";
      return String(value).trim().toUpperCase().slice(0,128);
    }catch(_){ return ""; }
  }
  function key(){
    const user = username();
    return user ? "nf:ui-preferences:v1:" + encodeURIComponent(user) : "";
  }
  function clean(raw){
    const p = raw && typeof raw === "object" ? raw : {};
    return {
      theme:["escuro","claro","automatico"].includes(p.theme) ? p.theme : null,
      showMap:typeof p.showMap === "boolean" ? p.showMap : true,
      showList:typeof p.showList === "boolean" ? p.showList : true,
      layout:p.layout === "amplo" ? "amplo" : "padrao",
      density:p.density === "compacta" ? "compacta" : "normal"
    };
  }
  function load(){
    const k = key();
    owner = k;
    if(!k) return {...BASE};
    try{ return clean(JSON.parse(localStorage.getItem(k) || "null")); }
    catch(_){ return {...BASE}; }
  }
  function persist(){
    if(!owner) return;
    try{ localStorage.setItem(owner, JSON.stringify(state)); }catch(_){}
  }
  function emit(){
    window.dispatchEvent(new CustomEvent("nf:preferences-changed",{detail:{...state}}));
  }
  function theme(){
    return state.theme === "automatico"
      ? (media && media.matches ? "escuro" : "claro")
      : state.theme;
  }
  function apply(){
    // Tema é exclusivo da Home: os módulos internos usam seus estilos próprios.
    const activeTheme = home ? theme() : null;
    if(activeTheme) root.dataset.nfTheme = activeTheme;
    else delete root.dataset.nfTheme;
    root.dataset.nfLayout = state.layout;
    root.dataset.nfTable = state.density;
    root.dataset.nfHome = home ? "1" : "0";
    root.dataset.nfMap = state.showMap ? "on" : "off";
    root.dataset.nfList = state.showList ? "on" : "off";
    if(home) {
      document.body?.classList.add("nf-pref-home");
      if(state.showMap && $("#homeBrazilMap")){
        // Recalcular dimensões do mapa após ele ficar novamente visível.
        requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")));
      }
    }
    const drawer = $("#nfPrefDrawer");
    if(drawer) syncControls();
    emit();
  }
  function update(patch){
    state = clean({...state,...patch});
    persist();
    apply();
  }
  function reset(){
    state = {...BASE};
    if(owner){try{localStorage.removeItem(owner);}catch(_){}}
    apply();
  }
  function syncControls(){
    $$("[data-nf-theme-choice]").forEach(el=>{
      el.setAttribute("aria-pressed",String(el.dataset.nfThemeChoice === state.theme));
    });
    $$("[data-nf-setting]").forEach(el=>{
      const name = el.dataset.nfSetting;
      const val = el.dataset.nfValue;
      if(name === "showMap" || name === "showList"){
        el.setAttribute("aria-checked", String(state[name]));
      }else if(name === "layout" || name === "density"){
        el.setAttribute("aria-pressed",String(state[name] === val));
      }
    });
    const hint=$("#nfPrefThemeHint");
    if(hint){
      hint.textContent = state.theme === null
        ? "Personalize somente a Home. Outras páginas mantêm sua aparência original."
        : state.theme === "automatico"
          ? "A Home acompanha o tema do computador. Outras páginas não mudam."
          : "Tema aplicado apenas à Home. Outras páginas mantêm sua aparência original.";
    }
  }
  function icon(name){
    const shared = 'viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    const paths={
      moon:'<path d="M20.8 14.3A8.5 8.5 0 0 1 9.7 3.2 8.5 8.5 0 1 0 20.8 14.3Z"/>',
      sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
      auto:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8m-4-4v4"/>'
    };
    return '<svg '+shared+'>'+paths[name]+'</svg>';
  }
  function createDrawer(){
    if($("#nfPrefDrawer"))return;
    const backdrop = document.createElement("div");
    backdrop.className = "nf-pref-backdrop";
    backdrop.id = "nfPrefBackdrop";
    backdrop.hidden = true;
    const drawer = document.createElement("aside");
    drawer.id = "nfPrefDrawer";
    drawer.className = "nf-pref-drawer";
    drawer.hidden = true;
    drawer.setAttribute("role","dialog");
    drawer.setAttribute("aria-modal","true");
    drawer.setAttribute("aria-labelledby","nfPrefTitle");
    drawer.innerHTML = `
      <header class="nf-pref-header">
        <div><strong id="nfPrefTitle">⚙ Configurações do Portal</strong>
        <p>Personalize sua experiência na Nova Frota.</p></div>
        <button type="button" class="nf-pref-close" aria-label="Fechar configurações" data-nf-close>×</button>
      </header>
      <div class="nf-pref-scroll">
        <section class="nf-pref-section" aria-labelledby="nfPrefThemeTitle">
          <h3 id="nfPrefThemeTitle">Aparência da Home</h3>
          <div class="nf-pref-themes" role="group" aria-label="Tema visual">
            <button class="nf-pref-theme" type="button" data-nf-theme-choice="escuro" aria-pressed="false">
              ${icon("moon")}<span>Escuro</span></button>
            <button class="nf-pref-theme" type="button" data-nf-theme-choice="claro" aria-pressed="false">
              ${icon("sun")}<span>Claro</span></button>
            <button class="nf-pref-theme" type="button" data-nf-theme-choice="automatico" aria-pressed="false">
              ${icon("auto")}<span>Automático</span></button>
          </div>
          <p class="nf-pref-note" id="nfPrefThemeHint"></p>
        </section>
        <section class="nf-pref-section" aria-labelledby="nfPrefHomeTitle">
          <h3 id="nfPrefHomeTitle">Página inicial</h3>
          <div class="nf-pref-row">
            <div><strong>Mostrar mapa do Brasil</strong><small>Oculta somente o desenho do mapa.</small></div>
            <button type="button" class="nf-pref-switch" role="switch" aria-label="Mostrar mapa do Brasil"
              aria-checked="true" data-nf-setting="showMap"></button>
          </div>
          <div class="nf-pref-row">
            <div><strong>Mostrar lista de fretes por estado</strong><small>Você pode manter a lista mesmo sem o mapa.</small></div>
            <button type="button" class="nf-pref-switch" role="switch" aria-label="Mostrar lista de fretes por estado"
              aria-checked="true" data-nf-setting="showList"></button>
          </div>
        </section>
        <section class="nf-pref-section" aria-labelledby="nfPrefLayoutTitle">
          <h3 id="nfPrefLayoutTitle">Largura do layout</h3>
          <div class="nf-pref-choices" role="group" aria-label="Largura do layout">
            <button type="button" class="nf-pref-choice" data-nf-setting="layout" data-nf-value="padrao" aria-pressed="true">Padrão</button>
            <button type="button" class="nf-pref-choice" data-nf-setting="layout" data-nf-value="amplo" aria-pressed="false">Amplo</button>
          </div>
        </section>
        <section class="nf-pref-section" aria-labelledby="nfPrefDensityTitle">
          <h3 id="nfPrefDensityTitle">Linhas das tabelas</h3>
          <div class="nf-pref-choices" role="group" aria-label="Tamanho das linhas das tabelas">
            <button type="button" class="nf-pref-choice" data-nf-setting="density" data-nf-value="normal" aria-pressed="true">Normais</button>
            <button type="button" class="nf-pref-choice" data-nf-setting="density" data-nf-value="compacta" aria-pressed="false">Compactas</button>
          </div>
          <p class="nf-pref-note">Preferências visuais individuais, sem alterar dados ou permissões.</p>
        </section>
      </div>
      <footer class="nf-pref-footer">
        <button type="button" class="nf-pref-reset" data-nf-reset>↺ Restaurar configurações originais</button>
      </footer>
    `;
    document.body.append(backdrop,drawer);
    backdrop.addEventListener("click",closeDrawer);
    drawer.querySelector("[data-nf-close]").addEventListener("click",closeDrawer);
    drawer.querySelector("[data-nf-reset]").addEventListener("click",reset);
    drawer.addEventListener("click",event=>{
      const themed=event.target.closest("[data-nf-theme-choice]");
      if(themed){update({theme:themed.dataset.nfThemeChoice});return;}
      const control=event.target.closest("[data-nf-setting]");
      if(!control)return;
      const name=control.dataset.nfSetting;
      if(name==="showMap" || name==="showList")update({[name]:!state[name]});
      if(name==="layout" || name==="density")update({[name]:control.dataset.nfValue});
    });
    syncControls();
  }
  function openDrawer(event){
    if(event)event.preventDefault();
    createDrawer();
    lastActive=document.activeElement;
    $("#nfPrefBackdrop").hidden=false;
    $("#nfPrefDrawer").hidden=false;
    document.body.classList.add("nf-pref-open");
    $("#nfPrefDrawer [data-nf-close]")?.focus();
  }
  function closeDrawer(){
    const drawer=$("#nfPrefDrawer"),mask=$("#nfPrefBackdrop");
    if(!drawer)return;
    drawer.hidden=true;
    if(mask)mask.hidden=true;
    document.body.classList.remove("nf-pref-open");
    if(lastActive?.isConnected)lastActive.focus();
  }
  function initStatePicker(){
    const pane=$(".homeMapListPane"),title=$("#homeMapStateTitle"),map=$("#homeBrazilMap");
    if(!pane||!title||!map||$("#nfPrefStateSelect"))return;
    const div=document.createElement("div");
    div.className="nf-pref-state-picker";
    const label=document.createElement("label");
    label.htmlFor="nfPrefStateSelect";
    label.textContent="Estado:";
    const select=document.createElement("select");
    select.id="nfPrefStateSelect";
    select.setAttribute("aria-label","Selecionar estado dos fretes");
    for(const [uf,name] of Object.entries(STATES)){
      const option=document.createElement("option");
      option.value=uf;
      option.textContent=name+" ("+uf+")";
      select.appendChild(option);
    }
    select.addEventListener("change",()=>{
      if($("#homeFreightMapPanel")?.classList.contains("is-restricted"))return;
      map.dispatchEvent(new CustomEvent("onStateSelected",{detail:select.value}));
    });
    div.append(label,select);
    pane.insertBefore(div,pane.firstChild);
    const sync=()=>{
      const target=String(title.textContent||"").trim().toUpperCase();
      const found=Object.entries(STATES).find(([,label])=>label.toUpperCase()===target);
      if(found)select.value=found[0];
    };
    sync();
    const observer=new MutationObserver(sync);
    observer.observe(title,{childList:true,characterData:true,subtree:true});
  }
  function init(){
    state=load();
    apply();
    if(home){
      // O ícone existente da Home abre um painel, não uma página inexistente.
      const trigger=$("#nfPrefsOpen") || $('[data-nf-preferences-open]');
      if(trigger)trigger.addEventListener("click",openDrawer);
      initStatePicker();
    }
    window.addEventListener("keydown",event=>{
      if(event.key==="Escape" && !$("#nfPrefDrawer")?.hidden)closeDrawer();
    });
    window.addEventListener("portal:session",()=>{
      const fresh=key();
      if(fresh!==owner){state=load();apply();}
    });
    window.addEventListener("storage",event=>{
      if(event.key===owner){state=load();apply();}
    });
    if(media){
      const onChange=()=>{if(state.theme==="automatico")apply()};
      if(media.addEventListener)media.addEventListener("change",onChange);
      else if(media.addListener)media.addListener(onChange);
    }
  }

  window.NovaFrotaPreferences=Object.freeze({
    get:()=>({...state}),
    update:patch=>update(patch),
    reset,
    open:openDrawer
  });
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",init,{once:true});
  }else init();
})();
