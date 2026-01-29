// ======== CONFIG (troque as senhas aqui) ========
const AUTH = {
  HOME_PASSWORD: "1234",   // Login 1 (entrada geral)
  PISO_PASSWORD: "9999",   // Login 2 (somente cálculo piso)
};

// ======== KEYS ========
const KEY_HOME = "nf_auth_home";
const KEY_PISO = "nf_auth_piso";

// ======== HELPERS ========
function setAuth(key, value=true){
  localStorage.setItem(key, value ? "1" : "0");
}
function isAuthed(key){
  return localStorage.getItem(key) === "1";
}
function logoutAll(){
  localStorage.removeItem(KEY_HOME);
  localStorage.removeItem(KEY_PISO);
}

// ======== GUARDS ========
function requireHomeAuth(){
  if(!isAuthed(KEY_HOME)){
    window.location.href = "../pages/login.html";
  }
}
function requirePisoAuth(){
  // precisa estar logado no sistema E no piso
  if(!isAuthed(KEY_HOME)){
    window.location.href = "../pages/login.html";
    return;
  }
  if(!isAuthed(KEY_PISO)){
    // manda para a mesma página com modal/senha (simples: prompt)
    const ok = prompt("Acesso restrito: digite a senha do Cálculo de Piso:");
    if(ok === null) { window.location.href = "../pages/home.html"; return; }
    if(ok === AUTH.PISO_PASSWORD){
      setAuth(KEY_PISO, true);
      return;
    }
    alert("Senha do Piso inválida.");
    window.location.href = "../pages/home.html";
  }
}

// botão sair (se existir)
function bindLogoutButton(){
  const btn = document.querySelector("[data-logout]");
  if(btn){
    btn.addEventListener("click", () => {
      logoutAll();
      window.location.href = "../pages/login.html";
    });
  }
}
