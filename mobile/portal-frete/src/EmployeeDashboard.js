import React,{useState} from "react";
import {Image,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {palette as c} from "./theme";

const BRAND_IMAGE="https://portalfrete.net.br/assets/img/logo-novafrota.png";
const count=value=>value===null||value===undefined?"—":new Intl.NumberFormat("pt-BR").format(value);

function ModuleCard({item,onPress}){
  return <Pressable accessibilityRole="button" accessibilityLabel={item.title}
    onPress={()=>onPress(item.page)}
    style={({pressed})=>[styles.moduleCard,pressed&&styles.pressed]}>
    <View style={styles.moduleIcon}><Text style={styles.moduleEmoji}>{item.icon}</Text></View>
    <Text style={styles.moduleTitle} numberOfLines={2}>{item.title}</Text>
    <Text style={styles.moduleDesc} numberOfLines={2}>{item.description}</Text>
    <Text style={styles.moduleArrow}>›</Text>
  </Pressable>;
}
function Metric({label,value,icon,tint,ink}){
  return <View style={[styles.metric,{backgroundColor:tint}]}>
    <Text style={styles.metricIcon}>{icon}</Text>
    <Text style={styles.metricLabel} numberOfLines={2}>{label}</Text>
    <Text style={[styles.metricValue,{color:ink}]}>{count(value)}</Text>
  </View>;
}
export default function EmployeeDashboard({
  employee,tenant,tenantInput,onCompanyChange,onActivate,onLogin,onOpen,onExit,error
}){
  const [logoFailed,setLogoFailed]=useState(false);
  const isNova=!tenant;
  const signed=Boolean(employee);
  const name=employee?.nome||employee?.usuario||"";
  const companyName=employee?.transportadoraNome||"Portal Frete";
  return <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
    keyboardShouldPersistTaps="handled">
    <View style={styles.header}>
      <View style={styles.brandRow}>
        {isNova&&!logoFailed?
          <View style={styles.brandPlate}>
            <Image source={{uri:BRAND_IMAGE}} resizeMode="contain"
              style={styles.brandImage} onError={()=>setLogoFailed(true)}
              accessibilityLabel="Logo Nova Frota"/>
          </View>:
          <Text style={styles.brandFallback}>{isNova?"NOVA FROTA":companyName}</Text>}
        <Pressable accessibilityRole="button" onPress={onExit} style={styles.exit}
          accessibilityLabel="Trocar área de acesso">
          <Text style={styles.exitText}>⌂</Text>
        </Pressable>
      </View>
      <Text style={styles.headerKicker}>PORTAL FRETE · FUNCIONÁRIO</Text>
      <Text style={styles.headerTitle}>{signed?"Painel do Funcionário":"Acesso do Funcionário"}</Text>
      <Text style={styles.headerCaption}>{signed?
        "Acesse os módulos liberados para o seu perfil.":
        "Entre com seu usuário do Portal Frete para visualizar seus módulos."}</Text>
    </View>
    {!signed?<View style={styles.gate}>
      <Text style={styles.gateTitle}>Entrar com meu usuário</Text>
      <Text style={styles.gateText}>O acesso permanece vinculado ao login e às permissões cadastradas no servidor.</Text>
      <Text style={styles.fieldLabel}>Código da transportadora</Text>
      <TextInput accessibilityLabel="Código da transportadora" autoCapitalize="none"
        autoCorrect={false} maxLength={40} value={tenantInput}
        placeholder="Deixe vazio para Nova Frota" placeholderTextColor="#7892a6"
        onChangeText={onCompanyChange} style={styles.field}/>
      {!!error&&<Text style={styles.error}>{error}</Text>}
      <Pressable onPress={onActivate} style={styles.loginButton} accessibilityRole="button">
        <Text style={styles.loginButtonText}>Acessar Portal Frete</Text>
        <Text style={styles.loginButtonText}>→</Text>
      </Pressable>
      <Text style={styles.help}>Após o login, somente os cards autorizados serão exibidos. Outras transportadoras não são listadas.</Text>
    </View>:<>
      <View style={styles.welcome}>
        <View style={{flex:1}}>
          <Text style={styles.welcomeLabel}>ACESSO ATIVO</Text>
          <Text style={styles.welcomeName} numberOfLines={2}>{name}</Text>
          <Text style={styles.welcomeProfile}>Perfil: {employee.perfil}{tenant?" · "+companyName:""}</Text>
        </View>
        <Text style={styles.welcomeTick}>✓</Text>
      </View>
      {employee.perfil!=="PISO"&&
        <View style={styles.metrics}>
          <Metric label="Fretes ativos" icon="🚛" value={employee.metrics.fretesAtivos}
            tint="#e5f8ed" ink="#0a6439"/>
          <Metric label="Veículos" icon="🚚" value={employee.metrics.veiculos}
            tint="#e8f4fd" ink="#103b70"/>
          <Metric label="Solicitações" icon="📋" value={employee.metrics.solicitacoes}
            tint="#fff3e9" ink="#9c5d21"/>
        </View>}
      {employee.perfil!=="PISO"&&
        <Text style={styles.metricsNote}>Indicadores da HOME do Portal. “—” significa dado não disponível para este acesso.</Text>}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.sectionTitle}>Meus módulos</Text>
          <Text style={styles.sectionHint}>Liberados pelo seu login</Text>
        </View>
        <Text style={styles.counter}>{employee.modules.length} disponível(is)</Text>
      </View>
      {employee.modules.length?
        <View style={styles.grid}>
          {employee.modules.map(item=><ModuleCard key={item.key} item={item} onPress={onOpen}/>)}
        </View>:
        <View style={styles.noModules}>
          <Text style={styles.noModulesTitle}>Nenhum módulo habilitado</Text>
          <Text style={styles.noModulesBody}>Solicite a liberação do seu perfil ao administrador da transportadora.</Text>
        </View>}
      <Pressable style={styles.portalButton} accessibilityRole="button" onPress={()=>onOpen("home")}>
        <Text style={styles.portalButtonText}>▦  Abrir HOME completa do Portal</Text>
        <Text style={styles.portalButtonText}>→</Text>
      </Pressable>
      <Text style={styles.safety}>Cada módulo continua protegido pelas permissões do Portal Frete. A lista é atualizada ao entrar novamente.</Text>
    </>}
  </ScrollView>;
}
const styles=StyleSheet.create({
  scroll:{flex:1,backgroundColor:"#f7fafd"},
  content:{paddingBottom:30},
  header:{backgroundColor:"#082d57",paddingHorizontal:20,paddingTop:18,paddingBottom:27,
    borderBottomLeftRadius:22,borderBottomRightRadius:22},
  brandRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",minHeight:56,marginBottom:20},
  brandPlate:{width:205,height:57,borderRadius:12,backgroundColor:"#fff",
    alignItems:"center",justifyContent:"center",paddingHorizontal:8},
  brandImage:{width:"100%",height:48},
  brandFallback:{color:"#fff",fontSize:20,fontWeight:"900",maxWidth:240},
  exit:{width:40,height:40,borderWidth:1,borderColor:"#52759a",borderRadius:12,
    alignItems:"center",justifyContent:"center"},
  exitText:{fontSize:24,color:"#fff"},
  headerKicker:{color:"#61eaa0",fontSize:11,fontWeight:"900",letterSpacing:.7},
  headerTitle:{color:"#fff",fontSize:26,fontWeight:"900",marginTop:9},
  headerCaption:{color:"#d8eafa",fontSize:13,lineHeight:20,marginTop:7},
  gate:{backgroundColor:"#fff",margin:17,borderWidth:1,borderColor:"#d9e6ef",
    borderRadius:18,padding:20},
  gateTitle:{fontSize:20,fontWeight:"900",color:"#082d57"},
  gateText:{color:c.muted,fontSize:13,lineHeight:20,marginTop:8,marginBottom:18},
  fieldLabel:{fontSize:12,fontWeight:"900",color:"#183c5f",marginBottom:8},
  field:{backgroundColor:"#f7fafd",borderWidth:1,borderColor:"#cbdde8",
    color:"#183c5f",borderRadius:11,height:48,paddingHorizontal:12,fontSize:14},
  loginButton:{marginTop:14,backgroundColor:"#188747",borderRadius:12,
    paddingHorizontal:16,height:52,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  loginButtonText:{color:"#fff",fontSize:14,fontWeight:"900"},
  help:{color:c.muted,fontSize:11,lineHeight:18,marginTop:13},
  error:{color:"#b42336",fontSize:12,marginTop:8},
  welcome:{marginHorizontal:17,marginTop:17,backgroundColor:"#fff",borderWidth:1,
    borderColor:"#d7e6f1",borderRadius:16,padding:15,flexDirection:"row",alignItems:"center"},
  welcomeLabel:{color:"#178448",fontWeight:"900",fontSize:10,letterSpacing:.7},
  welcomeName:{color:"#082d57",fontWeight:"900",fontSize:17,marginTop:5},
  welcomeProfile:{fontSize:11.5,color:c.muted,marginTop:5},
  welcomeTick:{fontSize:20,color:"#118447",backgroundColor:"#e2f8ea",overflow:"hidden",
    borderRadius:22,paddingHorizontal:11,paddingVertical:6},
  metrics:{marginHorizontal:17,marginTop:15,flexDirection:"row",gap:8},
  metric:{flex:1,borderRadius:13,paddingVertical:13,paddingHorizontal:8,alignItems:"center",
    minHeight:104,borderWidth:1,borderColor:"#dceaf3"},
  metricIcon:{fontSize:19},metricLabel:{fontSize:10.5,textAlign:"center",fontWeight:"800",
    color:"#244565",marginTop:5,minHeight:24},
  metricValue:{fontSize:23,fontWeight:"900",marginTop:3},
  metricsNote:{fontSize:10,color:"#6e8497",marginHorizontal:19,marginTop:8,lineHeight:15},
  titleRow:{marginHorizontal:19,marginTop:24,marginBottom:13,flexDirection:"row",
    alignItems:"center",justifyContent:"space-between",gap:7},
  sectionTitle:{fontSize:20,fontWeight:"900",color:"#082d57"},
  sectionHint:{fontSize:11,color:c.muted,marginTop:3},
  counter:{fontSize:10,color:"#19724e",fontWeight:"800",flexShrink:1},
  grid:{marginHorizontal:17,flexDirection:"row",flexWrap:"wrap",gap:10},
  moduleCard:{width:"48.3%",backgroundColor:"#103b70",borderRadius:15,minHeight:137,
    padding:13,justifyContent:"flex-start",position:"relative"},
  pressed:{opacity:.8},
  moduleIcon:{width:35,height:35,borderRadius:10,backgroundColor:"#082c55",
    alignItems:"center",justifyContent:"center",marginBottom:8},
  moduleEmoji:{fontSize:19},
  moduleTitle:{color:"#fff",fontWeight:"900",fontSize:13.5,lineHeight:18,paddingRight:13},
  moduleDesc:{color:"#c6dcee",fontSize:10,lineHeight:14,marginTop:5,paddingRight:8},
  moduleArrow:{position:"absolute",right:10,top:54,fontSize:25,color:"#d9edfa"},
  noModules:{marginHorizontal:17,backgroundColor:"#fff",padding:20,borderWidth:1,
    borderColor:"#d9e6ef",borderRadius:14},
  noModulesTitle:{fontWeight:"900",color:"#082d57"},
  noModulesBody:{color:c.muted,fontSize:12,lineHeight:19,marginTop:7},
  portalButton:{marginHorizontal:17,marginTop:18,height:52,backgroundColor:"#eaf4ff",
    borderRadius:13,paddingHorizontal:16,flexDirection:"row",justifyContent:"space-between",
    alignItems:"center",borderWidth:1,borderColor:"#c3def4"},
  portalButtonText:{color:"#0c467f",fontWeight:"900",fontSize:13},
  safety:{fontSize:10.5,lineHeight:16,marginTop:15,marginHorizontal:19,color:c.muted}
});
