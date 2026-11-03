// Build-only settings for the shared Controle de Embarque UI.
// Static CSS replaces the Tailwind Play CDN on private tenant pages.
// The original Nova Frota page is unchanged.
module.exports = {
  content: ["./pages/controle.html","./assets/js/controle.js"],
  safelist: [
    "hidden","flex","grid","block","inline-flex","modal","show",
    "bg-blue-600","bg-green-600","text-blue-600","text-green-600",
    "border-blue-600","bg-slate-50"
  ],
  theme:{
    extend:{
      colors:{
        background:"#f5f7fb",surface:"#ffffff",surface2:"#f8fafc",
        line:"#dbe4ee",primary:"#2563eb",primary2:"#eaf2ff",
        yellow:"#d69e00",text:"#10233d",muted:"#6f8195"
      },
      fontFamily:{
        sans:["Inter","Arial","sans-serif"],
        head:["Hanken Grotesk","Arial","sans-serif"]
      }
    }
  }
};
