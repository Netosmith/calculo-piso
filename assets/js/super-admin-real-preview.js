(function realPreviews(){
const KEYS=["modelo3","modelo4a","modelo4b","modelo4c"],HERO="../assets/img/divulgacao/hero-global.jpg",NOVA="../assets/img/logo-novafrota.png";
const DATA=[["RIO VERDE / GO","SANTOS / SP","SOJA","R$ 255,00/T"],["JATAÍ / GO","UBERABA / MG","MILHO","R$ 165,00/T"],["MINEIROS / GO","PARANAGUÁ / PR","FARELO","R$ 280,00/T"],["RONDONÓPOLIS / MT","SANTOS / SP","SOJA","R$ 240,00/T"]];
const canvases=new Map();let model3=null;
const company=()=>typeof selected==="undefined"?null:selected;
function logo(){
 const id=company()?.id;
 if(!id)return "";
 if(id==="nova-frota")return NOVA;
 return typeof galleryLogoUrls!=="undefined"?galleryLogoUrls.get(id)||"":"";
}
function multi(count){
 const rows=DATA.slice(0,count).map((d,i)=>`<article class="multiArtFrete">
 <div class="multiArtNum">${i+1}</div><div class="multiArtRoute"><div class="multiArtRouteSide"><div class="multiArtLabel"><b>●</b> ORIGEM / COLETA</div><div class="multiArtCity">${d[0]}</div><div class="multiArtDetail">ARMAZÉM CENTRAL</div></div>
 <div class="multiArtArrow">→</div><div class="multiArtRouteSide"><div class="multiArtLabel"><b>●</b> DESTINO / DESCARGA</div><div class="multiArtCity">${d[1]}</div><div class="multiArtDetail">TERMINAL GRANEL</div></div></div>
 <div class="multiArtMeta"><div class="multiArtProduct"><span>PRODUTO</span><strong>${d[2]}</strong></div><div class="multiArtPrice"><span>VALOR DO FRETE</span><strong>${d[3]}</strong></div></div></article>`).join("");
 const div=document.createElement("div");div.className="multiArt count-"+count;
 div.innerHTML=`<section class="multiArtHero"><img class="multiArtHeroImg" src="${HERO}" alt=""><div class="multiArtHeroWash"></div><img class="multiArtLogo" src="${NOVA}" alt="Logo"><div class="multiArtTitle">FRETES <strong>DISPONÍVEIS</strong></div><div class="multiArtSubtitle">CARGAS CONFIRMADAS • PRONTAS PARA CARREGAR</div></section>
 <section class="multiArtBody"><div class="multiArtFretes">${rows}</div><div class="multiArtContacts"><div class="multiArtContactsIntro"><div class="multiArtWa">☎</div><div><strong>FALE COM NOSSA EQUIPE</strong><span class="preview-filial">RIO VERDE</span></div></div><div class="multiArtContactsGrid"><div class="multiArtContact">COMERCIAL • (64) 99999-0000</div><div class="multiArtContact">OPERAÇÃO • (64) 99999-1111</div><div class="multiArtContact">FILIAL • (64) 99999-2222</div><div class="multiArtContact">SUPORTE • (64) 99999-3333</div></div></div></section>
 <footer class="multiArtFooter"><div><b>MAIS QUE FRETES,</b><br>PARCERIA EM CADA DESTINO.</div><div class="multiArtFooterBenefits"><span>◇ SEGURANÇA</span><span>◈ AGILIDADE</span><span>▥ RESULTADOS</span></div></footer>`;
 return div;
}
function single(){
 const div=model3.cloneNode(true),values={coletaCidade:DATA[0][0],coletaLocal:"ARMAZÉM CENTRAL",descargaCidade:DATA[0][1],descargaLocal:"PORTO DE SANTOS",produto:DATA[0][2],valor:DATA[0][3],filial:"RIO VERDE",contato1:"COMERCIAL • (64) 99999-0000",contato2:"OPERAÇÃO • (64) 99999-1111",contato3:"FILIAL • (64) 99999-2222"};
 div.querySelectorAll("[data-bind]").forEach(el=>el.textContent=values[el.dataset.bind]||"");
 div.querySelector(".m3HeroImg").src=HERO;return div;
}
function styles(){
 const el=document.createElement("style");el.textContent=`
 .art-model-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))}.art-model{min-width:0}
 .art-sample.pf-real-ready{padding:0;overflow:hidden;border:1px solid #7795ae;margin:13px 0 8px}
 .pf-real-viewport{width:100%;position:relative;overflow:hidden;background:#eaf2f7}
 .pf-real-stage{position:absolute;top:0;left:0;width:1080px;transform-origin:top left}
 .pf-real-stage .templatePreview3,.pf-real-stage .multiArt{transform:none!important;margin:0!important;width:1080px!important;box-shadow:none!important;border-radius:0!important}
 .pf-real-stage .templatePreview3{height:1440px!important}.pf-real-stage .multiArt{height:1350px!important}
 .pf-real-watermark{position:absolute;z-index:9;right:22px;top:345px;width:170px;height:90px;object-fit:contain;pointer-events:none}
 .pf-preview-large{width:100%;font-size:12px;margin:0 0 12px}.pf-preview-dialog{width:min(760px,95vw);max-width:95vw;max-height:95vh;overflow:auto;background:#10283f;color:white;border:1px solid #537c9a;border-radius:15px;padding:15px}
 .pf-preview-dialog::backdrop{background:#030b18d9}.pf-preview-canvas{width:100%;position:relative;overflow:hidden;background:white;aspect-ratio:1080/1350}
 .pf-preview-canvas>.multiArt,.pf-preview-canvas>.templatePreview3{position:absolute!important;top:0;left:0;width:1080px!important;transform-origin:top left!important}
 `;document.head.append(el);
}
function adjust(view,stage){if(view.clientWidth)stage.style.transform="scale("+(view.clientWidth/1080)+")";}
function expand(key){
 const record=canvases.get(key);if(!record)return;
 const dialog=document.createElement("dialog");dialog.className="pf-preview-dialog";
 const close=document.createElement("button");close.textContent="Fechar ✕";close.onclick=()=>dialog.close();
 const title=document.createElement("h3");title.textContent="Arte real · "+key.replace("modelo","Modelo ");
 const view=document.createElement("div");view.className="pf-preview-canvas";
 if(key==="modelo3")view.style.aspectRatio="1080/1440";
 const clone=record.art.cloneNode(true);view.append(clone);dialog.append(close,title,view);
 document.body.append(dialog);dialog.addEventListener("close",()=>dialog.remove(),{once:true});
 dialog.showModal();requestAnimationFrame(()=>adjust(view,clone));
}
function mount(key,index){
 const target=document.querySelector('[data-preview="'+key+'"]');if(!target)return;
 const count=index===0?1:index+1,art=index===0?single():multi(count);
 const view=document.createElement("div");view.className="pf-real-viewport";view.style.aspectRatio=count===1?"1080/1440":"1080/1350";
 const stage=document.createElement("div");stage.className="pf-real-stage";
 const mark=document.createElement("img");mark.className="pf-real-watermark";mark.alt="";art.append(mark);
 const image=art.querySelector(index===0?".m3Logo":".multiArtLogo");
 stage.append(art);view.append(stage);target.replaceChildren(view);target.classList.add("pf-real-ready");
 canvases.set(key,{art,image,mark});
 // Drag the logo on the true 1080px canvas; sliders remain source of truth.
 image.style.cursor="grab";image.style.touchAction="none";
 let drag=null;
 image.addEventListener("pointerdown",event=>{
  if(!logo()||typeof canEditBrand!=="function"||!canEditBrand())return;
  const get=name=>document.querySelector('[data-art-model="'+key+'"][data-art-field="'+name+'"]');
  drag={x:event.clientX,y:event.clientY,left:Number(get("logoX").value),top:Number(get("logoTop").value)};
  image.setPointerCapture(event.pointerId);image.style.cursor="grabbing";event.preventDefault();
 });
 image.addEventListener("pointermove",event=>{
  if(!drag)return;
  const scale=view.clientWidth/1080||1;
  for(const [name,value] of [
   ["logoX",drag.left+(event.clientX-drag.x)/scale],
   ["logoTop",drag.top+(event.clientY-drag.y)/scale]
  ]){
   const input=document.querySelector('[data-art-model="'+key+'"][data-art-field="'+name+'"]');
   if(!input)continue;
   input.value=String(Math.max(Number(input.min),Math.min(Number(input.max),Math.round(value))));
   input.dispatchEvent(new Event("input",{bubbles:true}));
  }
 });
 const release=()=>{drag=null;image.style.cursor="grab";};
 image.addEventListener("pointerup",release);
 image.addEventListener("pointercancel",release);
 const large=document.createElement("button");large.type="button";large.className="pf-preview-large";large.textContent="Ampliar prévia real";large.onclick=()=>expand(key);
 target.insertAdjacentElement("afterend",large);
 if(window.ResizeObserver)new ResizeObserver(()=>adjust(view,stage)).observe(view);else window.addEventListener("resize",()=>adjust(view,stage));
 adjust(view,stage);
}
function field(key,name){return document.querySelector('[data-art-model="'+key+'"][data-art-field="'+name+'"]')?.value;}
function paint(){
 const url=logo(),tenant=company();
 for(const [key,{art,image,mark}] of canvases){
  for(const [name,v] of [["primary","#113c70"],["accent","#08a968"],["surface","#f4f8fb"]])art.style.setProperty("--pf-art-"+name,field(key,name)||v);
  const wm=Math.max(0,Math.min(14,Number(field(key,"watermark"))||0));mark.style.opacity=String(wm/100);
  if(url){image.src=url;mark.src=url;}
  image.hidden=!url;mark.hidden=!url;
  const m3=key==="modelo3";
  const number=(name,fallback,min,max)=>{
   const n=Number(field(key,name));
   return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;
  };
  const w=number("logoWidth",m3?290:305,100,1500);
  const h=number("logoHeight",m3?96:128,35,1500);
  const top=number("logoTop",m3?4:8,-500,250);
  const x=number("logoX",0,-500,250);
  const opacity=number("logoOpacity",100,10,100);
  Object.assign(image.style,{
   top:top+"px",left:"calc(50% + "+x+"px)",width:w+"px",height:h+"px",
   opacity:String(opacity/100),objectFit:"contain",objectPosition:"center top",
   transform:"translateX(-50%)"
  });
  const quote=art.querySelector(".m3FooterQuote strong");if(quote&&tenant)quote.textContent=tenant.name+" conecta.";
  const filial=art.querySelector(".preview-filial");if(filial&&tenant)filial.textContent=tenant.name;
 }
}
async function start(){
 styles();
 try{
  const r=await fetch("./divulgacao.html",{credentials:"same-origin",cache:"no-cache"});
  if(!r.ok)throw Error("A página Divulgação não respondeu.");
  model3=new DOMParser().parseFromString(await r.text(),"text/html").querySelector(".templatePreview3");
  if(!model3)throw Error("Modelo 3 não encontrado nas artes atuais.");
  KEYS.forEach(mount);
  const original=window.drawArtPreviews;
  if(typeof original==="function")window.drawArtPreviews=function(){original();paint();};
  const load=window.loadArtThemes;
  if(typeof load==="function")window.loadArtThemes=async function(){const v=await load();paint();return v;};
  document.addEventListener("input",e=>{if(e.target?.matches("[data-art-model]"))paint();});
  const gallery=document.getElementById("companies");
  if(gallery){gallery.addEventListener("click",()=>queueMicrotask(paint));
    gallery.addEventListener("load",paint,true);new MutationObserver(paint).observe(gallery,{childList:true,subtree:true});}
  paint();
 }catch(e){const label=document.getElementById("artStatus");if(label)label.textContent="Prévia real indisponível: "+e.message;console.warn(e);}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
