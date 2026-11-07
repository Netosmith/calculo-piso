/* Portal Frete | Exportação fiel de logo nas artes (Modelo 3 e 4).
 * Corrige a diferença entre a logo visível na prévia e a imagem copiada/baixada:
 * desenha a imagem original em um canvas transparente do tamanho EXATO do hero,
 * respeitando object-fit:contain, object-position, opacidade e posição visível.
 * O html2canvas recebe a imagem congelada, em vez de recalcular o <img>.
 */
(function(){
  "use strict";
  const noop=()=>({onclone(){},finish(){}});
  const CSS_MARKER="data-pf-art-logo-raster";
  const DEFAULT_POSITION="center top";

  function axisPosition(value,axis){
    const s=String(value||"").toLowerCase();
    if(axis==="x"){
      if(s==="left")return 0;
      if(s==="right")return 1;
    }else{
      if(s==="top")return 0;
      if(s==="bottom")return 1;
    }
    if(s==="center")return 0.5;
    if(/^-?\d+(?:\.\d+)?%$/.test(s))return Number.parseFloat(s)/100;
    return 0.5;
  }
  function positionFractions(value){
    const parts=String(value||DEFAULT_POSITION).trim().toLowerCase().split(/\s+/);
    if(parts.length===1){
      return ["top","bottom"].includes(parts[0])
        ?{x:0.5,y:axisPosition(parts[0],"y")}
        :{x:axisPosition(parts[0],"x"),y:0.5};
    }
    if(["top","bottom"].includes(parts[0])||["left","right"].includes(parts[1])){
      return {x:axisPosition(parts[1],"x"),y:axisPosition(parts[0],"y")};
    }
    return {x:axisPosition(parts[0],"x"),y:axisPosition(parts[1],"y")};
  }

  async function prepare(source,{logoSelector,heroSelector}={}){
    if(!source||!logoSelector||!heroSelector)throw new Error("Área de exportação da logo inválida.");
    const image=source.querySelector(logoSelector);
    const hero=image?.closest(heroSelector);
    if(!image||!hero)return noop();
    const computed=getComputedStyle(image);
    if(image.hidden||computed.display==="none"||computed.visibility==="hidden")return noop();
    if(!image.complete||!image.naturalWidth||!image.naturalHeight){
      throw new Error("A logo não terminou de carregar. Atualize a prévia e tente novamente.");
    }
    const parent=hero.getBoundingClientRect();
    const rect=image.getBoundingClientRect();
    const heroWidth=hero.offsetWidth,heroHeight=hero.offsetHeight;
    if(!(parent.width>0&&parent.height>0&&heroWidth>0&&heroHeight>0&&rect.width>0&&rect.height>0)){
      throw new Error("Não foi possível medir a logo configurada na prévia.");
    }

    // BoundingClientRect inclui as transformações da prévia (0.2222 / 0.375).
    // Os fatores do HERO devolvem a geometria real em pixels do JPEG final.
    const sx=heroWidth/parent.width,sy=heroHeight/parent.height;
    const box={
      x:(rect.left-parent.left)*sx,
      y:(rect.top-parent.top)*sy,
      width:rect.width*sx,
      height:rect.height*sy
    };
    const ratio=Math.min(box.width/image.naturalWidth,box.height/image.naturalHeight);
    if(!(ratio>0&&Number.isFinite(ratio)))throw new Error("Dimensões da logo inválidas.");
    const width=image.naturalWidth*ratio,height=image.naturalHeight*ratio;
    const {x:alignX,y:alignY}=positionFractions(computed.objectPosition);
    const opacity=Number.parseFloat(computed.opacity);

    // A logo original é renderizada apenas uma vez, sem passar sua largura/altura
    // a um segundo elemento com proporção diferente.
    const raster=document.createElement("canvas");
    raster.width=heroWidth;raster.height=heroHeight;
    const ctx=raster.getContext("2d");
    if(!ctx)throw new Error("Não foi possível preparar a imagem para exportação.");
    ctx.globalAlpha=Number.isFinite(opacity)?Math.max(0,Math.min(1,opacity)):1;
    ctx.drawImage(image,
      box.x+(box.width-width)*alignX,
      box.y+(box.height-height)*alignY,
      width,height);
    let frozen;
    try{frozen=raster.toDataURL("image/png");}
    catch(_){throw new Error("Não foi possível processar a logo. Verifique o formato e a origem do arquivo.");}
    const ready=new Image();
    ready.src=frozen;
    if(ready.decode)await ready.decode();
    const zIndex=computed.zIndex==="auto"?"4":String(computed.zIndex||"4");
    const scope=logoSelector.startsWith(".")?logoSelector:logoSelector.trim();
    source.setAttribute(CSS_MARKER,"true");
    return {
      onclone(doc){
        const clone=doc.querySelector('['+CSS_MARKER+'="true"] '+scope);
        if(!clone)return;
        const replacement=doc.createElement("img");
        replacement.src=frozen;
        replacement.alt="";
        replacement.setAttribute("aria-hidden","true");
        for(const [name,value] of Object.entries({
          position:"absolute",left:"0px",top:"0px",
          width:heroWidth+"px",height:heroHeight+"px",
          maxWidth:"none",maxHeight:"none",objectFit:"fill",
          objectPosition:"center center",transform:"none",
          display:"block",visibility:"visible",opacity:"1",
          zIndex,pointerEvents:"none"
        })){
          replacement.style.setProperty(name.replace(/[A-Z]/g,x=>"-"+x.toLowerCase()),value,"important");
        }
        clone.replaceWith(replacement);
      },
      finish(){source.removeAttribute(CSS_MARKER);}
    };
  }
  window.PortalArtLogoRaster=Object.freeze({prepare});
})();