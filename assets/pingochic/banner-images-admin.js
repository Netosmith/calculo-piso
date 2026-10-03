/* Pingo Chic — extensão do painel de banners com imagem fixa ou GIF */
(function () {
  "use strict";

  const PCX = window.PC;
  if (!PCX) return;

  const { api, compressImage, imgUrl, toast, svg, esc } = PCX;
  let serverBanners = [];
  let syncing = false;
  let decorateQueued = false;

  const style = document.createElement("style");
  style.textContent = `
    .pc-banner-image-box{margin:14px 0 4px;padding:14px;border:1px dashed #d8d9df;border-radius:12px;background:#fbfbfc}
    .pc-banner-image-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;font-size:12.5px;font-weight:700;color:#252832}
    .pc-banner-image-title small{font-size:11px;font-weight:500;color:#8b8e98}
    .pc-banner-image-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
    .pc-banner-thumb{width:124px;height:76px;border-radius:10px;overflow:hidden;background:#f0f1f4;border:1px solid #e0e1e6;display:grid;place-items:center;color:#999;flex:0 0 auto;position:relative}
    .pc-banner-thumb img{width:100%;height:100%;object-fit:cover;display:block}
    .pc-banner-kind{position:absolute;left:6px;bottom:6px;padding:3px 7px;border-radius:999px;background:rgba(20,20,20,.72);color:#fff;font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
    .pc-banner-image-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1}
    .pc-banner-image-actions .hint{width:100%;font-size:11.5px;color:#8b8e98;line-height:1.45}
    .pc-banner-file{position:absolute;inline-size:1px;block-size:1px;opacity:0;pointer-events:none}
    .pc-banner-upload-label{cursor:pointer}
    .pc-banner-upload-label.is-busy{pointer-events:none;opacity:.65}
    .pc-banner-gif{border-color:#ef6f9d!important;color:#c74375!important;background:#fff7fa!important}
    .pc-banner-gif:hover{background:#fdebf2!important}
    .banner-prev.pc-banner-has-image{background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;position:relative;overflow:hidden;text-shadow:0 1px 3px rgba(0,0,0,.28)}
    @media(max-width:820px){.pc-banner-thumb{width:100%;height:130px}.pc-banner-image-actions{width:100%}}
  `;
  document.head.appendChild(style);

  function isBannerView() {
    return location.hash.replace(/^#/, "").split("?")[0] === "banners";
  }

  function mainEl() {
    return document.getElementById("main");
  }

  function queueDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    queueMicrotask(() => {
      decorateQueued = false;
      decorate();
    });
  }

  function isGif(value) {
    return /\.gif(?:$|[?#])/i.test(String(value || ""));
  }

  function currentMedia(index, card) {
    const hidden = card?.querySelector(`[data-pc-banner-image="${index}"]`);
    if (hidden) return hidden.value || "";
    return serverBanners[index]?.image || "";
  }

  function applyPreview(card, index) {
    const prev = card.querySelector(".banner-prev");
    if (!prev) return;
    const media = currentMedia(index, card);
    if (!media) {
      prev.classList.remove("pc-banner-has-image");
      prev.style.backgroundImage = "";
      prev.style.backgroundSize = "";
      prev.style.backgroundPosition = "";
      return;
    }

    const url = imgUrl(media);
    prev.classList.add("pc-banner-has-image");
    prev.style.backgroundImage = `linear-gradient(rgba(20,20,20,.20),rgba(20,20,20,.38)),url(${JSON.stringify(url)})`;
    prev.style.backgroundSize = "cover";
    prev.style.backgroundPosition = "center";
  }

  function refreshThumb(box, media) {
    const thumb = box.querySelector(".pc-banner-thumb");
    const remove = box.querySelector("[data-pc-remove]");
    if (media) {
      thumb.innerHTML = `<img src="${esc(imgUrl(media))}" alt="Mídia do banner"><span class="pc-banner-kind">${isGif(media) ? "GIF" : "Imagem"}</span>`;
      remove.hidden = false;
    } else {
      thumb.innerHTML = svg("image", 24);
      remove.hidden = true;
    }
  }

  async function uploadMedia(file, kind, index, card, box) {
    if (!file) return;

    const gif = kind === "gif";
    const type = String(file.type || "").toLowerCase();
    const name = String(file.name || "");

    if (gif) {
      if (!(type === "image/gif" || /\.gif$/i.test(name))) {
        toast("Selecione um arquivo GIF válido.", "bad");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast("O GIF deve ter no máximo 8 MB.", "bad");
        return;
      }
    } else {
      if (!/^image\/(jpeg|png|webp)$/i.test(type)) {
        toast("Use uma imagem JPG, PNG ou WEBP.", "bad");
        return;
      }
    }

    const label = box.querySelector(gif ? ".pc-banner-gif" : ".pc-banner-static");
    const text = label.querySelector("[data-pc-upload-text]");
    const oldText = text.textContent;
    label.classList.add("is-busy");
    text.textContent = gif ? "Enviando GIF..." : "Enviando...";

    try {
      const blob = gif ? file : await compressImage(file, 1800, 0.86);
      const result = await api("/admin/images", { method: "POST", body: blob });
      if (!result?.url) throw new Error("O upload não retornou uma URL válida.");

      const hidden = box.querySelector(`[data-pc-banner-image="${index}"]`);
      hidden.value = result.url;
      if (!serverBanners[index]) serverBanners[index] = {};
      serverBanners[index].image = result.url;
      if (window.PCAdminState?.banners?.[index]) window.PCAdminState.banners[index].image = result.url;
      hidden.dispatchEvent(new Event("input", { bubbles: true }));
      refreshThumb(box, result.url);
      queueMicrotask(() => applyPreview(card, index));
      toast(gif ? "GIF carregado. Clique em Salvar banners para publicar." : "Imagem carregada. Clique em Salvar banners para publicar.");
    } catch (error) {
      toast(error?.message || (gif ? "Não foi possível enviar o GIF." : "Não foi possível enviar a imagem."), "bad");
    } finally {
      label.classList.remove("is-busy");
      text.textContent = oldText;
      box.querySelectorAll("input[type=file]").forEach((input) => { input.value = ""; });
    }
  }

  function addImageControls(card, index) {
    if (card.querySelector(`[data-pc-banner-box="${index}"]`)) {
      applyPreview(card, index);
      return;
    }

    const formSide = card.children[1];
    if (!formSide) return;

    const media = serverBanners[index]?.image || "";
    const box = document.createElement("div");
    box.className = "pc-banner-image-box";
    box.dataset.pcBannerBox = String(index);
    box.innerHTML = `
      <div class="pc-banner-image-title">
        <span>${svg("image", 15)} Mídia do banner</span>
        <small>opcional</small>
      </div>
      <div class="pc-banner-image-row">
        <div class="pc-banner-thumb"></div>
        <div class="pc-banner-image-actions">
          <label class="btn btn-line btn-sm pc-banner-upload-label pc-banner-static">
            ${svg("image", 15)} <span data-pc-upload-text>Imagem fixa</span>
            <input class="pc-banner-file" data-pc-file="image" type="file" accept="image/jpeg,image/png,image/webp">
          </label>
          <label class="btn btn-line btn-sm pc-banner-upload-label pc-banner-gif">
            ${svg("play", 15)} <span data-pc-upload-text>GIF animado</span>
            <input class="pc-banner-file" data-pc-file="gif" type="file" accept="image/gif,.gif">
          </label>
          <button type="button" class="btn btn-line btn-sm" data-pc-remove ${media ? "" : "hidden"}>${svg("trash", 14)} Remover mídia</button>
          <div class="hint">Imagem fixa: JPG, PNG ou WEBP, otimizada automaticamente. GIF: enviado sem conversão para preservar a animação, até 8 MB. Recomendado: 1200 × 600 px.</div>
        </div>
      </div>
      <input type="hidden" data-pc-banner-image="${index}" data-b="${index}" data-k="image" value="${esc(media)}">
    `;

    formSide.appendChild(box);
    refreshThumb(box, media);
    applyPreview(card, index);

    box.querySelector('[data-pc-file="image"]').addEventListener("change", (event) => {
      uploadMedia(event.target.files?.[0], "image", index, card, box);
    });
    box.querySelector('[data-pc-file="gif"]').addEventListener("change", (event) => {
      uploadMedia(event.target.files?.[0], "gif", index, card, box);
    });

    box.querySelector("[data-pc-remove]").addEventListener("click", () => {
      const hidden = box.querySelector(`[data-pc-banner-image="${index}"]`);
      hidden.value = "";
      if (!serverBanners[index]) serverBanners[index] = {};
      serverBanners[index].image = "";
      if (window.PCAdminState?.banners?.[index]) window.PCAdminState.banners[index].image = "";
      hidden.dispatchEvent(new Event("input", { bubbles: true }));
      refreshThumb(box, "");
      queueMicrotask(() => applyPreview(card, index));
      toast("Mídia removida. Clique em Salvar banners para publicar.");
    });
  }

  function decorate() {
    if (!isBannerView()) return;
    const main = mainEl();
    if (!main) return;

    const cards = [...main.querySelectorAll(".card")].filter((card) => card.querySelector(".banner-prev"));
    cards.forEach((card) => {
      const indexed = card.querySelector("[data-b]");
      if (!indexed) return;
      const index = Number(indexed.dataset.b);
      if (!Number.isInteger(index) || index < 0) return;
      addImageControls(card, index);
      applyPreview(card, index);
    });
  }

  async function syncFromServer() {
    if (!isBannerView() || syncing) return;
    syncing = true;
    try {
      const result = await api("/admin/banners");
      serverBanners = Array.isArray(result?.banners) ? result.banners.map((b) => ({ ...b })) : [];
    } catch {
      // O painel principal já mostra o erro de API. Aqui apenas evitamos duplicar alertas.
    } finally {
      syncing = false;
      queueDecorate();
    }
  }

  const observer = new MutationObserver(() => {
    if (isBannerView()) queueDecorate();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("input", (event) => {
    if (!isBannerView() || !event.target.closest?.("#main")) return;
    queueMicrotask(decorate);
  });
  document.addEventListener("change", (event) => {
    if (!isBannerView() || !event.target.closest?.("#main")) return;
    queueMicrotask(decorate);
  });

  document.addEventListener("click", (event) => {
    if (!isBannerView()) return;
    const target = event.target;

    const del = target.closest?.("[data-del]");
    if (del) {
      const index = Number(del.dataset.del);
      if (Number.isInteger(index)) serverBanners.splice(index, 1);
      setTimeout(queueDecorate, 0);
      return;
    }

    if (target.closest?.("#add")) {
      serverBanners.push({ image: "" });
      setTimeout(queueDecorate, 0);
      return;
    }

    if (target.closest?.("#save")) {
      setTimeout(syncFromServer, 700);
    }
  });

  window.addEventListener("hashchange", () => {
    if (isBannerView()) setTimeout(syncFromServer, 0);
  });

  if (isBannerView()) setTimeout(syncFromServer, 0);
})();
