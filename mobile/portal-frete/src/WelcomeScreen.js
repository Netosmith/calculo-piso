import React,{useState} from "react";
import {Image,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";

// Arquivo oficial já publicado pelo próprio Portal Frete.
const NOVA_LOGO="https://portalfrete.net.br/assets/img/logo-novafrota.png";

function AccessCard({title,description,icon,accent,onPress,accessibilityLabel}){
  const motor=accent==="green";
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
    onPress={onPress}
    style={({pressed})=>[s.card,pressed&&s.cardPressed]}>
    <View style={[s.cardAccent,{backgroundColor:motor?"#1eac62":"#1672b6"}]}/>
    <View style={[s.cardIcon,{backgroundColor:motor?"#e1f8ed":"#e9f3fe"}]}>
      <Text style={s.cardEmoji}>{icon}</Text>
    </View>
    <View style={s.cardBody}>
      <Text style={s.cardTitle}>{title}</Text>
      <Text style={s.cardDescription}>{description}</Text>
    </View>
    <View style={[s.arrowCircle,{backgroundColor:motor?"#e6f8ee":"#eaf3fc"}]}>
      <Text style={[s.arrow,{color:motor?"#148d4d":"#156aa4"}]}>›</Text>
    </View>
  </Pressable>;
}

export default function WelcomeScreen({onDriver,onEmployee}){
  const [logoFailed,setLogoFailed]=useState(false);
  return <ScrollView style={s.screen}
    contentContainerStyle={s.content}
    showsVerticalScrollIndicator={false}>
    <View>
      <View style={s.hero}>
        <View pointerEvents="none" style={s.glowGreen}/>
        <View pointerEvents="none" style={s.glowBlue}/>
        <View pointerEvents="none" style={s.heroLine}/>
        <View style={s.brandPlate}>
          {logoFailed?
            <View style={s.logoFallback}>
              <Text style={s.logoFallbackNova}>NOVA<Text style={s.logoFallbackFrota}>FROTA</Text></Text>
              <Text style={s.logoFallbackTag}>TRANSPORTES E LOGÍSTICA</Text>
            </View>:
            <Image source={{uri:NOVA_LOGO}} style={s.novaLogo}
              onError={()=>setLogoFailed(true)}
              accessibilityLabel="Logo oficial Nova Frota"
              resizeMode="contain"/>}
        </View>
        <View style={s.heroEyebrowRow}>
          <View style={s.activeDot}/>
          <Text style={s.heroEyebrow}>CONECTANDO ESTRADAS E OPORTUNIDADES</Text>
        </View>
        <Text style={s.heroTitle}>Sua jornada,{"\n"}mais conectada.</Text>
        <Text style={s.heroSubtitle}>Fretes, viagens e ferramentas da operação em um só lugar.</Text>
      </View>
      <View style={s.main}>
        <View style={s.sectionHeading}>
          <Text style={s.sectionEyebrow}>ESCOLHA SEU ACESSO</Text>
          <Text style={s.sectionTitle}>Como deseja entrar?</Text>
          <Text style={s.sectionInfo}>Selecione a área para continuar.</Text>
        </View>
        <AccessCard title="SOU MOTORISTA"
          description="Fretes disponíveis, GPS da viagem e comprovantes de descarga."
          icon="🚛" accent="green" onPress={onDriver}
          accessibilityLabel="Entrar na área Sou Motorista"/>
        <AccessCard title="SOU FUNCIONÁRIO"
          description="Módulos operacionais conforme suas permissões no Portal Frete."
          icon="💼" accent="blue" onPress={onEmployee}
          accessibilityLabel="Entrar na área Sou Funcionário"/>
        <View style={s.privacy}>
          <View style={s.privacyIcon}><Text style={s.privacyEmoji}>🛡️</Text></View>
          <Text style={s.privacyText}>Sua localização só será solicitada após vincular uma viagem e aceitar o termo de monitoramento.</Text>
        </View>
      </View>
    </View>
    <View style={s.footer}>
      <View style={s.footerDivider}/>
      <View style={s.portalIdentity}>
        <View style={s.portalMark}><Text style={s.portalMarkText}>PF</Text></View>
        <View>
          <Text style={s.portalName}>PORTAL FRETE</Text>
          <Text style={s.portalSub}>LOGÍSTICA & TRANSPORTES</Text>
        </View>
      </View>
      <Text style={s.footerNote}>Tecnologia a serviço da Nova Frota.</Text>
    </View>
  </ScrollView>;
}

const s=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#f7fafd"},
  content:{flexGrow:1,justifyContent:"space-between",paddingBottom:10},
  hero:{backgroundColor:"#082c55",paddingHorizontal:24,paddingTop:32,
    paddingBottom:61,borderBottomLeftRadius:30,borderBottomRightRadius:30,
    overflow:"hidden"},
  glowGreen:{position:"absolute",top:-90,right:-105,width:285,height:285,
    backgroundColor:"rgba(24,181,100,.24)",borderRadius:200},
  glowBlue:{position:"absolute",bottom:-135,left:-100,width:290,height:290,
    backgroundColor:"rgba(21,118,191,.25)",borderRadius:190},
  heroLine:{position:"absolute",width:170,height:4,right:-28,top:52,
    backgroundColor:"#1baa62",borderRadius:9,transform:[{rotate:"-25deg"}],opacity:.6},
  brandPlate:{alignSelf:"center",width:"100%",maxWidth:282,minHeight:91,
    backgroundColor:"#fff",borderRadius:18,paddingHorizontal:17,paddingVertical:12,
    alignItems:"center",justifyContent:"center",
    shadowColor:"#00182f",shadowOpacity:.15,shadowOffset:{width:0,height:7},
    shadowRadius:14,elevation:5},
  novaLogo:{width:"100%",height:64},
  logoFallback:{alignItems:"center",justifyContent:"center"},
  logoFallbackNova:{color:"#103e69",fontSize:27,fontWeight:"900",letterSpacing:-.5},
  logoFallbackFrota:{color:"#13934f"},
  logoFallbackTag:{color:"#4d6678",fontSize:10,fontWeight:"800",letterSpacing:.5},
  heroEyebrowRow:{marginTop:25,flexDirection:"row",alignItems:"center",gap:8},
  activeDot:{width:7,height:7,borderRadius:4,backgroundColor:"#39d58a"},
  heroEyebrow:{fontSize:10.5,fontWeight:"900",color:"#92e6bd",letterSpacing:.65,flexShrink:1},
  heroTitle:{fontSize:30,lineHeight:36,letterSpacing:-.9,fontWeight:"900",color:"#fff",marginTop:12},
  heroSubtitle:{color:"#d0e4f3",fontSize:13,lineHeight:20,marginTop:11,maxWidth:330},
  main:{paddingHorizontal:19,marginTop:-28},
  sectionHeading:{backgroundColor:"#fff",borderWidth:1,borderColor:"#e1ebf3",
    borderRadius:16,paddingHorizontal:16,paddingVertical:14,marginBottom:15,
    shadowColor:"#0b3354",shadowOpacity:.055,shadowOffset:{width:0,height:3},shadowRadius:8,elevation:2},
  sectionEyebrow:{color:"#177b4d",fontSize:10.5,fontWeight:"900",letterSpacing:1.1},
  sectionTitle:{color:"#0b345e",fontSize:22,fontWeight:"900",marginTop:6,letterSpacing:-.4},
  sectionInfo:{color:"#657e94",fontSize:12,marginTop:4},
  card:{minHeight:121,marginBottom:13,backgroundColor:"#fff",borderRadius:19,
    borderWidth:1,borderColor:"#d6e5f1",flexDirection:"row",alignItems:"center",
    paddingVertical:16,paddingHorizontal:15,overflow:"hidden",
    shadowColor:"#173d60",shadowOpacity:.075,shadowOffset:{width:0,height:4},
    shadowRadius:10,elevation:3},
  cardPressed:{transform:[{scale:.99}],opacity:.87},
  cardAccent:{position:"absolute",left:0,top:0,bottom:0,width:5},
  cardIcon:{height:53,width:53,borderRadius:15,alignItems:"center",justifyContent:"center",marginRight:12},
  cardEmoji:{fontSize:25},
  cardBody:{flex:1,minWidth:0},
  cardTitle:{fontSize:15.5,fontWeight:"900",color:"#0c365e",letterSpacing:.3},
  cardDescription:{fontSize:11.7,lineHeight:18,color:"#627b91",marginTop:5},
  arrowCircle:{width:28,height:28,borderRadius:15,alignItems:"center",justifyContent:"center",marginLeft:5},
  arrow:{fontSize:25,fontWeight:"500",lineHeight:29,marginTop:-3},
  privacy:{flexDirection:"row",alignItems:"center",gap:10,backgroundColor:"#eaf5fc",
    borderWidth:1,borderColor:"#d2e6f3",borderRadius:14,
    paddingHorizontal:13,paddingVertical:12,marginTop:3},
  privacyIcon:{width:30,height:30,borderRadius:9,backgroundColor:"#d9edea",
    justifyContent:"center",alignItems:"center"},
  privacyEmoji:{fontSize:17},
  privacyText:{flex:1,fontSize:11.5,lineHeight:17,color:"#456984"},
  footer:{paddingHorizontal:24,paddingTop:22,paddingBottom:13,alignItems:"center"},
  footerDivider:{backgroundColor:"#d9e6ef",height:1,width:"100%",marginBottom:17},
  portalIdentity:{flexDirection:"row",alignItems:"center",gap:10},
  portalMark:{width:41,height:41,borderRadius:12,backgroundColor:"#124b7a",
    justifyContent:"center",alignItems:"center",borderWidth:1,borderColor:"#3887ad"},
  portalMarkText:{fontSize:17,fontWeight:"900",color:"#fff"},
  portalName:{fontSize:14,fontWeight:"900",color:"#17426a",letterSpacing:.6},
  portalSub:{fontSize:9,color:"#69859b",fontWeight:"800",letterSpacing:.6,marginTop:2},
  footerNote:{fontSize:10,color:"#91a5b5",marginTop:12}
});
