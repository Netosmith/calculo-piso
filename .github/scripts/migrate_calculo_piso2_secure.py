from pathlib import Path

path = Path("pages/calculo-antt2.html")
text = path.read_text(encoding="utf-8")
original = text

text = text.replace(
    '<script src="../assets/js/auth.js"></script>',
    '<script src="../assets/js/auth.js?v=4"></script>',
    1,
)

old_auth = '''/* =======================
   AUTENTICAÇÃO OPCIONAL
======================= */
function portalUser(){ try{ if(typeof getUser === "function") return String(getUser()||"").trim().toUpperCase(); }catch(e){} return String(localStorage.getItem("nf_auth_user")||"").trim().toUpperCase(); }
function goHome(){ window.location.href = "./home.html"; }'''

new_auth = '''/* =======================
   AUTENTICAÇÃO SEGURA DO PORTAL
======================= */
function enforcePiso2Auth(){
  try{
    if(typeof requirePiso2Auth === "function"){
      return requirePiso2Auth() === true;
    }
    console.error("[PISO2] requirePiso2Auth não encontrado.");
    window.location.href = "../pages/login.html";
    return false;
  }catch(error){
    console.error("[PISO2] Erro ao validar acesso:", error);
    window.location.href = "../pages/login.html";
    return false;
  }
}
function portalUser(){ try{ if(typeof getUser === "function") return String(getUser()||"").trim().toUpperCase(); }catch(e){} return ""; }
function goHome(){ window.location.href = "./home.html"; }'''

if old_auth not in text:
    raise SystemExit("Bloco de autenticação opcional não encontrado.")
text = text.replace(old_auth, new_auth, 1)

old_init = 'document.addEventListener("DOMContentLoaded",()=>{ bind(); applyToggles(); applyQuoteMode(); setEixosFromSelectedVehicle(); renderAll(); });'
new_init = '''document.addEventListener("DOMContentLoaded",()=>{
  if(enforcePiso2Auth() !== true) return;
  bind();
  applyToggles();
  applyQuoteMode();
  setEixosFromSelectedVehicle();
  renderAll();
});'''

if old_init not in text:
    raise SystemExit("Inicialização antiga não encontrada.")
text = text.replace(old_init, new_init, 1)

for forbidden in ["AUTENTICAÇÃO OPCIONAL", 'localStorage.getItem("nf_auth_user")']:
    if forbidden in text:
        raise SystemExit(f"Referência insegura restante: {forbidden}")

for required in ["requirePiso2Auth", "enforcePiso2Auth", "auth.js?v=4"]:
    if required not in text:
        raise SystemExit(f"Referência obrigatória ausente: {required}")

if text == original:
    raise SystemExit("Nenhuma alteração aplicada.")

path.write_text(text, encoding="utf-8")
