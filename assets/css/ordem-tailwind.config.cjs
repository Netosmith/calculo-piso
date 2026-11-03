// Reproduces the Tailwind Play theme embedded in the ONE shared Ordem HTML.
// Compile once in GitHub CI, never at runtime on tenant pages.
const plugins=[];
for(const name of ["@tailwindcss/forms","@tailwindcss/container-queries"]){
 try{plugins.push(require("/tmp/pf-controle-css/node_modules/"+name));}catch(_){}
}
module.exports={
  "content": [
    "./pages/ordem.html"
  ],
  "theme": {
    "extend": {
      "colors": {
        "surface-bright": "#f9f9ff",
        "primary-fixed": "#d6e3ff",
        "on-tertiary-fixed": "#181c1e",
        "on-tertiary": "#ffffff",
        "outline": "#74777f",
        "primary-container": "#112b4e",
        "surface": "#f9f9ff",
        "inverse-surface": "#263142",
        "on-secondary-container": "#00734c",
        "secondary": "#006c47",
        "outline-variant": "#c4c6cf",
        "tertiary-fixed": "#e0e3e6",
        "background": "#f9f9ff",
        "on-secondary-fixed-variant": "#005235",
        "primary-fixed-dim": "#b0c7f3",
        "secondary-container": "#85f9bf",
        "on-background": "#111c2c",
        "on-surface-variant": "#44474e",
        "on-primary-fixed-variant": "#30476c",
        "surface-container-high": "#dee8ff",
        "tertiary-fixed-dim": "#c3c7ca",
        "surface-dim": "#cfdaf1",
        "surface-container-low": "#f0f3ff",
        "surface-container-highest": "#d8e3fa",
        "on-primary-container": "#7c93bc",
        "surface-container-lowest": "#ffffff",
        "on-error": "#ffffff",
        "on-primary": "#ffffff",
        "secondary-fixed": "#85f9bf",
        "error": "#ba1a1a",
        "on-tertiary-fixed-variant": "#43474a",
        "on-primary-fixed": "#001b3c",
        "primary": "#001633",
        "on-tertiary-container": "#8e9295",
        "surface-variant": "#d8e3fa",
        "on-error-container": "#93000a",
        "on-surface": "#111c2c",
        "surface-tint": "#485f85",
        "inverse-primary": "#b0c7f3",
        "error-container": "#ffdad6",
        "on-secondary-fixed": "#002113",
        "tertiary-container": "#272b2d",
        "secondary-fixed-dim": "#68dca5",
        "on-secondary": "#ffffff",
        "surface-container": "#e7eeff",
        "inverse-on-surface": "#ebf1ff",
        "tertiary": "#131719"
      },
      "borderRadius": {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      },
      "spacing": {
        "gutter": "16px",
        "margin-desktop": "32px",
        "base": "8px",
        "container-max-width": "1280px",
        "margin-mobile": "16px"
      },
      "fontFamily": {
        "label-caps": [
          "Inter"
        ],
        "headline-lg": [
          "Work Sans"
        ],
        "headline-sm": [
          "Work Sans"
        ],
        "body-lg": [
          "Inter"
        ],
        "headline-md": [
          "Work Sans"
        ],
        "body-md": [
          "Inter"
        ],
        "headline-md-mobile": [
          "Work Sans"
        ],
        "data-mono": [
          "JetBrains Mono"
        ]
      },
      "fontSize": {
        "label-caps": [
          "12px",
          {
            "lineHeight": "16px",
            "letterSpacing": "0.05em",
            "fontWeight": "700"
          }
        ],
        "headline-lg": [
          "32px",
          {
            "lineHeight": "40px",
            "letterSpacing": "-0.02em",
            "fontWeight": "700"
          }
        ],
        "headline-sm": [
          "20px",
          {
            "lineHeight": "28px",
            "fontWeight": "600"
          }
        ],
        "body-lg": [
          "16px",
          {
            "lineHeight": "24px",
            "fontWeight": "400"
          }
        ],
        "headline-md": [
          "24px",
          {
            "lineHeight": "32px",
            "fontWeight": "600"
          }
        ],
        "body-md": [
          "14px",
          {
            "lineHeight": "20px",
            "fontWeight": "400"
          }
        ],
        "headline-md-mobile": [
          "20px",
          {
            "lineHeight": "28px",
            "fontWeight": "600"
          }
        ],
        "data-mono": [
          "13px",
          {
            "lineHeight": "18px",
            "fontWeight": "500"
          }
        ]
      }
    }
  },
  "safelist": [
    "grid",
    "flex",
    "hidden",
    "block"
  ]
  ,plugins
};
