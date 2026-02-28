<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Home | NOVA FROTA</title>
  <link rel="stylesheet" href="../assets/css/app.css" />

  <style>
    .topbar .actions a.icon-btn{ text-decoration:none; }

    .hero .grid{
      display:grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap:14px;
      margin-top:16px;
    }
    @media (max-width: 900px){ .hero .grid{ grid-template-columns: 1fr; } }

    .hero .card{
      min-height: 112px;
      display:flex;
      align-items:center;
      gap:14px;
    }
    .hero .card-left{ display:flex; align-items:center; justify-content:center; }
    .hero .tile{
      width:64px; height:64px;
      display:flex; align-items:center; justify-content:center;
      border-radius:18px;
      background: rgba(255,255,255,.12);
      backdrop-filter: blur(6px);
    }
    .hero .card-right h3{ margin:0 0 4px; }
    .hero .card-right p{ margin:0; opacity:.9; }

    .badge{
      margin-left:6px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:18px;
      height:18px;
      padding:0 6px;
      border-radius:999px;
      font-size:11px;
      font-weight:900;
    }

    /* Card Solicitações (topo) */
    .sumCard{
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(17,26,51,.70);
      box-shadow: var(--shadow);
      display:flex;
      align-items:center;
      gap: 10px;
      padding: 10px 12px;
      cursor:pointer;
      transition: transform .12s ease, filter .12s ease;
      margin-right: 10px;
    }
    .sumCard:hover{ transform: translateY(-2px); filter: brightness(1.06); }
    .sumIcon{
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: rgba(255,255,255,.10);
      border: 1px solid rgba(255,255,255,.12);
      display:grid;
      place-items:center;
      font-size: 18px;
    }
    .sumTitle{ font-weight: 950; font-size: 13px; }
    .sumValue{ margin-top: 2px; font-weight: 1000; opacity: .92; }
    .sumGold{ background: linear-gradient(135deg, rgba(116,92,24,.86), rgba(20,22,32,.72)); }

    /* Modal (mesmo estilo do app) */
    #homeSolicModal{
      position: fixed;
      inset: 0;
      display:none;
      align-items:center;
      justify-content:center;
      z-index: 9999;
      background: rgba(0,0,0,.55);
      backdrop-filter: blur(8px);
      padding: 18px;
    }
    #homeSolicModal.isOpen{ display:flex; }

    .modalCard{
      width: min(980px, 100%);
      border-radius: 18px;
      background: rgba(17,26,51,.92);
      border: 1px solid rgba(255,255,255,.12);
      box-shadow: 0 18px 55px rgba(0,0,0,.55);
      overflow:hidden;
    }
    .modalHead{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding: 12px 14px;
      background: rgba(255,255,255,.06);
      border-bottom: 1px solid rgba(255,255,255,.10);
    }
    .modalHead h2{ margin:0; font-size: 14px; font-weight: 1000; }
    .iconClose{
      width: 36px;
      height: 36px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.06);
      color: var(--text);
      cursor:pointer;
      font-weight: 1000;
    }
    .modalBody{ padding: 14px; max-height: calc(100vh - 220px); overflow:auto; }
    .grid2{ display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 900px){ .grid2{ grid-template-columns: 1fr; } }
    .field label{
      display:block;
      font-size: 11px;
      font-weight: 950;
      color: rgba(233,238,252,.92);
      margin: 0 0 6px;
    }
    .field input, .field select, .field textarea{
      width:100%;
      border-radius: 12px;
      padding: 10px 10px;
      outline:none;
      color: var(--text);
      background: rgba(13,20,48,.65);
      border: 1px solid rgba(255,255,255,.14);
    }
    .field textarea{ min-height: 110px; resize: vertical; }
    .modalFoot{
      display:flex;
      justify-content:flex-end;
      gap:10px;
      padding: 12px 14px;
      border-top: 1px solid rgba(255,255,255,.10);
      background: rgba(255,255,255,.06);
    }
    .btnAdmin{
      height: 38px;
      padding: 0 12px;
      border-radius: 12px;
      border: 1px solid rgba(91,124,250,.60);
      background: rgba(27,42,90,.75);
      color: var(--text);
      font-weight: 900;
      cursor:pointer;
    }
    .btnAdmin.ghost{
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.06);
    }
  </style>
</head>

<body>
  <div class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <div class="burger" title="Menu"><div></div></div>
        <img src="../assets/img/logo-novafrota.png" alt="NOVA FROTA" />
      </div>

      <!-- ✅ Solicitações no topo -->
      <button class="sumCard sumGold" id="homeSolicCard" type="button">
        <div class="sumIcon">📋</div>
        <div class="sumTxt">
          <div class="sumTitle">Solicitações</div>
          <div class="sumValue"><span id="homeSolicOpen">0</span> abertas</div>
        </div>
      </button>

      <div class="actions">
        <a class="icon-btn" href="./notificacoes.html" title="Notificações" aria-label="Notificações">🔔</a>
        <a class="icon-btn" href="./mensagens.html" title="Mensagens" aria-label="Mensagens">✉️ <span class="badge">3</span></a>
        <a class="icon-btn" href="./arquivos.html" title="Arquivos" aria-label="Arquivos">📁</a>
        <a class="icon-btn" href="./config.html" title="Configurações" aria-label="Configurações">⚙️</a>
        <div class="icon-btn" title="Sair" data-logout aria-label="Sair">👤</div>
      </div>
    </div>
  </div>

  <!-- ✅ Modal Solicitação -->
  <div id="homeSolicModal" aria-hidden="true">
    <div class="modalCard" role="dialog" aria-modal="true" aria-labelledby="homeSolicTitle">
      <div class="modalHead">
        <h2 id="homeSolicTitle">Nova Solicitação</h2>
        <button class="iconClose" id="homeSolicClose" type="button">✕</button>
      </div>

      <div class="modalBody">
        <div class="grid2">
          <div class="field">
            <label>Filial</label>
            <select id="hsFilial"></select>
          </div>

          <div class="field">
            <label>Tipo (editável)</label>
            <input id="hsTipo" placeholder="Ex: CHEQUES / MANUTENÇÃO / TONER..." />
          </div>

          <div class="field">
            <label>Data</label>
            <input id="hsData" placeholder="dd/mm/aaaa" />
          </div>

          <div class="field">
            <label>Status</label>
            <select id="hsStatus">
              <option value="ABERTA">ABERTA</option>
              <option value="EM ANDAMENTO">EM ANDAMENTO</option>
              <option value="FINALIZADA">FINALIZADA</option>
            </select>
          </div>

          <div class="field" style="grid-column:1/-1;">
            <label>Observação</label>
            <textarea id="hsObs" placeholder="Descreva o pedido..."></textarea>
          </div>

          <div class="field" style="grid-column:1/-1;">
            <label>Solicitante</label>
            <input id="hsSolicitante" readonly />
          </div>
        </div>
      </div>

      <div class="modalFoot">
        <button class="btnAdmin ghost" id="homeSolicCancel" type="button">Cancelar</button>
        <button class="btnAdmin" id="homeSolicSend" type="button">Salvar</button>
      </div>
    </div>
  </div>

  <section class="hero">
    <div class="container hero-content">
      <div class="hero-title">Bem-vindo ao <b>Sistema Operacional</b></div>

      <div class="hero-sub" id="homeSub">
        Escolha uma das opções abaixo para continuar
      </div>

      <div class="grid">
        <a class="card theme-blue" data-feature="piso" href="./calculo-piso.html">
          <div class="card-left"><div class="tile" style="font-size:34px;">🧾📈</div></div>
          <div class="card-right">
            <h3>Cálculo de Piso ANTT</h3>
            <p>Faça o cálculo do piso mínimo de frete</p>
          </div>
        </a>

        <a class="card theme-green" data-feature="fretes" href="./fretes.html">
          <div class="card-left"><div class="tile" style="font-size:40px;">🚛</div></div>
          <div class="card-right">
            <h3>Fretes (Operacional)</h3>
            <p>Gerencie e atualize os fretes diários</p>
          </div>
        </a>

        <a class="card theme-purple" data-feature="share" href="./share-clientes.html">
          <div class="card-left"><div class="tile" style="font-size:40px;">👥</div></div>
          <div class="card-right">
            <h3>Share Clientes</h3>
            <p>Compartilhe informações com clientes</p>
          </div>
        </a>

        <a class="card theme-gold" data-feature="divulgacao" href="./divulgacao.html">
          <div class="card-left"><div class="tile" style="font-size:38px;">📣</div></div>
          <div class="card-right">
            <h3>Divulgação</h3>
            <p>Ferramentas para comunicação e marketing</p>
          </div>
        </a>

        <a class="card theme-blue" data-feature="administrativo" href="./administrativo.html">
          <div class="card-left"><div class="tile" style="font-size:38px;">🗂️</div></div>
          <div class="card-right">
            <h3>Administrativo</h3>
            <p>Frota leve, cheques e solicitações por filial</p>
          </div>
        </a>
      </div>
    </div>
  </section>

  <script src="../assets/js/auth.js"></script>
  <script src="../assets/js/home-solicitacoes.js"></script>
  <script>
    requireHomeAuth();
    bindLogoutButton();

    window.addEventListener("DOMContentLoaded", () => {
      const uf = getSelectedState?.() || "";
      const user = getUser?.() || "";
      const sub = document.getElementById("homeSub");
      if(sub) sub.textContent = `Acesso liberado para ${user} | Estado: ${uf}`;

      document.querySelectorAll("[data-feature]").forEach((card) => {
        const feature = card.getAttribute("data-feature");
        if(typeof canAccessFeature === "function" && !canAccessFeature(feature)){
          card.style.display = "none";
        }
      });
    });
  </script>
</body>
</html>
