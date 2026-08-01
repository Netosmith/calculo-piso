// =====================================================
// PATRIMÔNIO | PORTAL FRETE
// Cadastro e upload via Cloudflare Worker + Gateway seguro
// =====================================================

async function salvarPatrimonio(){
  const filesInput = document.getElementById("ptFiles");
  const files = filesInput?.files || [];

  if(files.length > 2){
    alert("Máximo de 2 arquivos.");
    return;
  }

  const payload = {
    filial: document.getElementById("ptFilial")?.value || "",
    estado: document.getElementById("ptEstado")?.value || "",
    equipamento: document.getElementById("ptEquipamento")?.value || "",
    numero: document.getElementById("ptNumero")?.value || "",
    responsavel: document.getElementById("ptResponsavel")?.value || "",
    status: document.getElementById("ptStatus")?.value || "",
    obs: document.getElementById("ptObs")?.value || "",
    arquivos: []
  };

  for(const file of files){
    const base64 = await toBase64(file);

    payload.arquivos.push({
      nome: file.name,
      tipo: file.type,
      base64: String(base64).split(",")[1] || ""
    });
  }

  try{
    const api = typeof ensurePortalApi === "function"
      ? await ensurePortalApi()
      : window.PortalAPI;

    if(!api){
      throw new Error("API segura do Portal indisponível.");
    }

    await api.call("patrimonio", "create", payload);

    alert("Patrimônio salvo com sucesso!");
    location.reload();
  }catch(error){
    console.error("[PATRIMÔNIO]", error);
    alert(error?.message || "Erro ao salvar o patrimônio.");
  }
}

function toBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}
