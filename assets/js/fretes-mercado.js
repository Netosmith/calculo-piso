const BASES = [
"RIO VERDE","INDIARA","PARAUNA","JATAI","CHAP CEU",
"CAIAPONIA","MONTIVIDIU","ITUMBIARA","PIRACANJUBA",
"BOM JESUS","MINEIROS","ANAPOLIS","PADRE BERNARDO","URUACU","NOVA CRIXAS"
];

const tbody = document.getElementById("tbody");

function render(){
tbody.innerHTML = BASES.map(b => `
<tr>
<td>${b}</td>
<td><input type="number"/></td>
<td><input type="number"/></td>
<td>
<select>
<option>Alta</option>
<option>Baixa</option>
<option>Estável</option>
</select>
</td>
</tr>
`).join('');
}

function zerar(){
document.querySelectorAll("input").forEach(i=>i.value="");
}

function printTela(){
html2canvas(document.body).then(canvas=>{
const link = document.createElement("a");
link.download="fretes.png";
link.href=canvas.toDataURL();
link.click();
});
}

render();
