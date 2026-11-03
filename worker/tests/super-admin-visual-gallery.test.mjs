import test from "node:test";
import assert from "node:assert/strict";
import {Script} from "node:vm";
import {readFileSync} from "node:fs";
import {stagingPanelHtml} from "../src/staging-panel.js";

test("Super Admin owner gallery shows private logos and opens current company settings",()=>{
 const html=stagingPanelHtml();
 for(const id of ["galleryPanel","companies","companyCount","companySearch",
  "companyDetail","galleryBack","artThemePanel","artModelGrid","artSave","artStatus",
  "integrationPanel","userList","auditList","brandFile","uploadLogo"]){
  assert.ok(html.includes('id="'+id+'"'),"Missing "+id);
 }
 assert.ok(html.includes('id="companyDetail" hidden'));
 assert.ok(html.includes("galleryLogoUrls"));
 assert.ok(html.includes("galleryLogoImage(company,image,initials)"));
 assert.ok(html.includes("loadArtThemes();"));
 assert.ok(html.includes("await refreshGalleryLogo(tenant)"));
 assert.ok(html.includes("rememberSelectedCompany(company.id)"));
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new Script(script));
 assert.ok(script.includes("renderCompanies=function()"));
 assert.ok(script.includes("showGalleryDetail(true)"));
 assert.ok(!html.includes('value="AKfycbxu'));
});
test("company identity derives from owner authenticated logo and signed tenant art endpoint",()=>{
 const art=readFileSync(new URL("../src/services/tenant-art-themes.js",import.meta.url),"utf8");
 const router=readFileSync(new URL("../src/controllers/tenant-unified.js",import.meta.url),"utf8");
 const branding=readFileSync(new URL("../../assets/js/tenant-route.js",import.meta.url),"utf8");
 assert.ok(art.includes('tenant/"+id+"/visual/arts-v1.json'));
 assert.ok(router.includes("/v1/tenant/artes"));
 assert.ok(branding.includes("/v1/tenant/artes"));
 assert.ok(branding.includes("/v1/tenant/logo"));
 assert.ok(branding.includes("addArtWatermarks()"));
 assert.ok(branding.includes("modelo4a"));
 assert.ok(branding.includes("modelo4b"));
 assert.ok(branding.includes("modelo4c"));
});
