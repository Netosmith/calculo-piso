const API_URL = "https://script.google.com/macros/s/AKfycbyqSyvr27oAYOd8gJofbEyR12mXgzm8gqHjDS0FEMZkhzEbduEyJ5zfm0LtDZ9PojJQ/exec";

async function salvarPatrimonio(){

  const filesInput = document.getElementById("ptFiles");
  const files = filesInput.files;

  if(files.length > 2){
    alert("Máximo 2 arquivos!");
    return;
  }

  const payload = {
    action: "patrimonio_add",
    filial: document.getElementById("ptFilial").value,
    estado: document.getElementById("ptEstado").value,
    equipamento: document.getElementById("ptEquipamento").value,
    numero: document.getElementById("ptNumero").value,
    responsavel: document.getElementById("ptResponsavel").value,
    status: document.getElementById("ptStatus").value,
    obs: document.getElementById("ptObs").value,
    arquivos: []
  };

  // Converter arquivos para base64
  for(let file of files){
    const base64 = await toBase64(file);

    payload.arquivos.push({
      nome: file.name,
      tipo: file.type,
      base64: base64.split(",")[1]
    });
  }

  try{

    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if(data.ok){
      alert("Patrimônio salvo com sucesso!");
      location.reload();
    }else{
      alert("Erro ao salvar");
    }

  }catch(e){
    console.error(e);
    alert("Erro na comunicação");
  }
}

// converter arquivo
function toBase64(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}
