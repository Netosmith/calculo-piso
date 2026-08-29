from pathlib import Path

path = Path('pages/embarques.html')
text = path.read_text(encoding='utf-8')

replacements = {
    '*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font-family:Inter,Arial,sans-serif}button,input,select,textarea{font:inherit}a{color:inherit}':
    '*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font-family:Inter,Arial,sans-serif}html,body{width:100%;max-width:100%;overflow-x:hidden}button,input,select,textarea{font:inherit}a{color:inherit}',

    '.topbar{height:68px;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 3px 14px rgba(15,35,63,.04)}.topbar-inner{width:min(100% - 30px,1720px);height:100%;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:16px}':
    '.topbar{height:68px;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 3px 14px rgba(15,35,63,.04)}.topbar-inner{width:calc(100% - 20px);max-width:none;height:100%;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:14px}',

    '.page{width:min(100% - 28px,1720px);margin:auto;padding:16px 0 34px}':
    '.page{width:calc(100% - 20px);max-width:none;margin:auto;padding:12px 0 28px}',

    '.kpis{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:10px;margin-bottom:12px}':
    '.kpis{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px;margin-bottom:10px}',

    '.kpi{--accent:var(--blue);min-height:102px;padding:14px;':
    '.kpi{--accent:var(--blue);min-height:96px;padding:12px;',

    '.kpi strong{display:block;margin-top:9px;font-size:25px;line-height:1;color:#0b1830}.kpi span{display:block;margin-top:8px;color:#73859a;font-size:8.5px}':
    '.kpi strong{display:block;margin-top:8px;font-size:23px;line-height:1;color:#0b1830}.kpi span{display:block;margin-top:7px;color:#73859a;font-size:8px}',

    '.filters{padding:10px;border:1px solid var(--line);border-radius:12px;background:#fff;box-shadow:var(--shadow);display:grid;grid-template-columns:145px 170px 160px 160px 150px 150px minmax(240px,1fr) auto auto auto auto;gap:8px;align-items:end;margin-bottom:12px}':
    '.filters{padding:10px;border:1px solid var(--line);border-radius:12px;background:#fff;box-shadow:var(--shadow);display:grid;grid-template-columns:repeat(6,minmax(118px,1fr)) minmax(220px,1.55fr) repeat(5,max-content);gap:7px;align-items:end;margin-bottom:10px;min-width:0}.filters>*{min-width:0}',

    '.panel{border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden;box-shadow:var(--shadow)}':
    '.panel{border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden;box-shadow:var(--shadow);min-width:0}',

    '.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:1720px}th,td{padding:9px 10px;':
    '.table-wrap{overflow-x:auto;overflow-y:visible;max-width:100%;overscroll-behavior-x:contain}table{width:max(100%,1580px);border-collapse:collapse;min-width:1580px}th,td{padding:8px 7px;',

    'th{position:sticky;top:0;z-index:2;background:#f8fafc;color:#50637a;font-size:7.5px;text-transform:uppercase}td{font-size:8.5px;color:#243a52}':
    'th{position:sticky;top:0;z-index:2;background:#f8fafc;color:#50637a;font-size:7px;text-transform:uppercase}td{font-size:8px;color:#243a52}',

    '.bottom{display:grid;grid-template-columns:240px minmax(0,1fr);gap:12px;margin-top:12px}':
    '.bottom{display:grid;grid-template-columns:220px minmax(0,1fr);gap:10px;margin-top:10px;min-width:0}',

    '@media(max-width:1450px){.kpis{grid-template-columns:repeat(4,1fr)}.filters{grid-template-columns:repeat(5,1fr)}}@media(max-width:850px){':
    '@media(max-width:1600px){.filters{grid-template-columns:repeat(6,minmax(118px,1fr)) minmax(220px,1.6fr) repeat(4,max-content)}.privacy-toggle{grid-column:1/3;justify-self:start}}@media(max-width:1450px){.kpis{grid-template-columns:repeat(4,1fr)}.filters{grid-template-columns:repeat(4,minmax(130px,1fr)) minmax(220px,1.5fr) repeat(3,max-content)}.privacy-toggle{grid-column:auto}}@media(max-width:1100px){.filters{grid-template-columns:repeat(3,minmax(150px,1fr)) minmax(220px,1.5fr) repeat(2,max-content)}}@media(max-width:850px){'
}

changed = False
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'Trecho esperado não encontrado: {old[:100]}')
    text = text.replace(old, new, 1)
    changed = True

if changed:
    path.write_text(text, encoding='utf-8')
    print('Layout de embarques ajustado para aproveitar melhor a largura da tela.')
