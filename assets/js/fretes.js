/* fretes.js | NOVA FROTA */
(function () {
  "use strict";

  const API_URL = "https://script.google.com/macros/s/AKfycbw2kZd_eo0pXX0FXIBcwLFc-kw48U_ABPNv0FO6J0ElIUKCvxT-5vfRQT5S6m_geocg/exec";

  const LS_KEY_ROWS = "nf_fretes_rows_v1";
  const LS_KEY_WEIGHTS_PREFIX = "nf_fretes_weights_";
  const LS_KEY_USER = "nf_auth_user";

  const FILIAIS_ORDEM = [
    "ITUMBIARA", "ANAPOLIS", "RIO VERDE", "CRISTALINA", "BOM JESUS", "JATAI",
    "CATALÃO", "INDIARA", "MINEIROS", "MONTIVIDIU", "CHAP CÉU"
  ];

  const CONTATOS_FIXOS = [
    "ARIEL 64 99227-7537",
    "JHONATAN",
    "NARCISO",
    "SERGIO",
    "ELTON",
    "EVERALDO",
    "RONE",
    "RAFAEL",
    "KIEWERSON",
    "PIRULITO"
  ];

  const $ = (id) => document.getElementById(id);

  function safeText(v) { return (v ?? "").toString().trim(); }

  function num(v) {
    const n = Number(String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
    return isFinite(n) ? n : 0;
  }

  function formatBRL(v) {
    const n = Number(v);
    if (!isFinite(n)) return "";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function extractPhoneBR(text) {
    const s = safeText(text);
    if (!s) return "";
    let digits = s.replace(/\D/g, "");
    if (digits.startsWith("55")) return digits;
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return "";
  }

  function whatsappLinkFromContato(contato) {
    const phone = extractPhoneBR(contato);
    return phone ? ("https://wa.me/" + phone) : "";
  }

  function render(rows) {

    const tbody = $("tbody");
    tbody.innerHTML = "";

    rows.forEach((row) => {

      const tr = document.createElement("tr");

      const wpp = whatsappLinkFromContato(row.contato);

      const tdContato = document.createElement("td");

      const wrap = document.createElement("div");
      wrap.style.display = "flex";
      wrap.style.alignItems = "center";
      wrap.style.justifyContent = "space-between";
      wrap.style.gap = "6px";

      const span = document.createElement("span");
      span.textContent = row.contato || "";
      span.style.whiteSpace = "nowrap";
      span.style.overflow = "hidden";
      span.style.textOverflow = "ellipsis";

      wrap.appendChild(span);

      // ✅ BOTÃO WHATSAPP COM ÍCONE
      if (wpp) {

        const a = document.createElement("a");
        a.href = wpp;
        a.target = "_blank";
        a.title = "Chamar no WhatsApp";

        a.style.display = "inline-flex";
        a.style.alignItems = "center";
        a.style.justifyContent = "center";
        a.style.width = "32px";
        a.style.height = "32px";
        a.style.borderRadius = "10px";
        a.style.border = "1px solid rgba(17,24,39,.14)";
        a.style.background = "#E6F6ED";
        a.style.flex = "0 0 auto";

        const img = document.createElement("img");
        img.src = "../assets/img/whatsapp.png";
        img.style.width = "18px";
        img.style.height = "18px";

        img.onerror = () => {
          a.textContent = "📞";
          a.style.background = "#EEF2F7";
        };

        a.appendChild(img);
        wrap.appendChild(a);
      }

      tdContato.appendChild(wrap);
      tr.appendChild(tdContato);

      tbody.appendChild(tr);
    });
  }

})();
