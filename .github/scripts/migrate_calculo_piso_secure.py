from pathlib import Path
import re

path = Path("pages/calculo-antt.html")
text = path.read_text(encoding="utf-8")
original = text

text = text.replace(
    '<script src="../assets/js/auth.js?v=3"></script>',
    '<script src="../assets/js/auth.js?v=4"></script>'
)

text = re.sub(
    r'\n\s*/\* Admin modal \*/.*?\n\s*</style>',
    '\n  </style>',
    text,
    count=1,
    flags=re.S,
)

text = re.sub(
    r'\n\s*<!-- ADMIN MODAL -->.*?\n\s*<div class="wrap" id="app">',
    '\n\n  <div class="wrap" id="app">',
    text,
    count=1,
    flags=re.S,
)

text = re.sub(
    r'\n\s*<button class="smallBtn" id="btnAdmin"[^>]*>.*?</button>',
    '',
    text,
    count=1,
)

text = re.sub(r'\nconst ADMIN_USER = "LUZIANO";\n', '\n', text, count=1)
text = re.sub(r'\nfunction isAdmin\(\)\{.*?\}\n', '\n', text, count=1)

old_guard = '''function enforcePisoAuth(){
  try{
    if(typeof requirePiso2Auth==="function"){
      return requirePiso2Auth()===true;
    }

    console.error("[PISO2] requirePiso2Auth não encontrado.");
    alert("Não foi possível validar o acesso ao Piso 2.");
    window.location.href="../pages/home.html";
    return false;

  }catch(e){
    console.error("[PISO2] Erro:",e);
    alert("Erro ao validar acesso ao Piso 2.");
    window.location.href="../pages/home.html";
    return false;
  }
}'''

new_guard = '''function enforcePisoAuth(){
  try{
    if(typeof requirePisoAuth === "function"){
      return requirePisoAuth() === true;
    }

    console.error("[PISO] requirePisoAuth não encontrado.");
    alert("Não foi possível validar o acesso ao Cálculo de Piso.");
    window.location.href = "../pages/login.html";
    return false;
  }catch(error){
    console.error("[PISO] Erro ao validar acesso:", error);
    alert("Erro ao validar o acesso ao Cálculo de Piso.");
    window.location.href = "../pages/login.html";
    return false;
  }
}'''

if old_guard not in text:
    raise SystemExit("Guarda antiga do Cálculo de Piso não encontrada.")
text = text.replace(old_guard, new_guard, 1)

text = re.sub(
    r'\n/\*\* logout do portal \*/\nfunction logoutPortal\(\)\{.*?\n\}\n',
    '\n',
    text,
    count=1,
    flags=re.S,
)

text = re.sub(
    r'\n/\* ================== ADMIN UI ================== \*/.*?\n/\* ================== INIT ================== \*/',
    '\n/* ================== INIT ================== */',
    text,
    count=1,
    flags=re.S,
)

text = re.sub(
    r'\n\s*\$\("btnAdmin"\)\.style\.display = isAdmin\(\) \? "" : "none";',
    '',
    text,
    count=1,
)

old_logout = '''  $("btnLogout").addEventListener("click", (e)=>{
    e.preventDefault();
    logoutPortal();
  });'''

new_logout = '''  $("btnLogout")?.addEventListener("click", async (event)=>{
    event.preventDefault();
    const button = event.currentTarget;
    if(button) button.disabled = true;

    try{
      if(typeof logoutPortal === "function"){
        await logoutPortal();
      }
    }finally{
      window.location.href = "../pages/login.html";
    }
  });'''

if old_logout not in text:
    raise SystemExit("Listener antigo de logout não encontrado.")
text = text.replace(old_logout, new_logout, 1)

text = text.replace(
    '["km","pedagio","margem","icms","tipo","admUserName","admUserPass"].forEach(id=>bindGlow($(id)));',
    '["km","pedagio","margem","icms","tipo"].forEach(id=>bindGlow($(id)));',
)

text = re.sub(
    r'\n\s*\$\("btnAdminClose"\).*?\n\s*\$\("btnAdminResetAllPesos"\).*?\n\s*\}\);',
    '',
    text,
    count=1,
    flags=re.S,
)

forbidden = [
    'piso_users_v1',
    'admUserPass',
    'admUserName',
    'btnAdmin',
    'adminModal',
    'function isAdmin()',
    'const ADMIN_USER',
    'requirePiso2Auth()',
]
leftovers = [item for item in forbidden if item in text]
if leftovers:
    raise SystemExit("Referências locais inseguras restantes: " + ", ".join(leftovers))

if text == original:
    raise SystemExit("Nenhuma alteração foi aplicada.")

path.write_text(text, encoding="utf-8")
