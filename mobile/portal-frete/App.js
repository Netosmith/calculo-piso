import React,{useCallback,useEffect,useRef,useState} from "react";
import {
  ActivityIndicator,Alert,BackHandler,KeyboardAvoidingView,Linking,
  Platform,Pressable,ScrollView,StatusBar,StyleSheet,Text,TextInput,View
} from "react-native";
import {SafeAreaProvider,SafeAreaView} from "react-native-safe-area-context";
import {WebView} from "react-native-webview";
import {normalizeTenantSlug,portalPage,slugFromInvite,trustedNavigation} from "./src/routes";
import {palette as c} from "./src/theme";
import DriverArea from "./src/DriverArea";
import EmployeeDashboard from "./src/EmployeeDashboard";
import WelcomeScreen from "./src/WelcomeScreen";
import {EMPLOYEE_HOME_BRIDGE,parseEmployeeSessionMessage,validEmployeeHomeUrl} from "./src/employee-access";
import {extractDriverToken} from "./src/tracking";

function BottomTabs({active,onTab,employee}){
  const has=key=>employee?.modules?.some(item=>item.key===key);
  const tabs=[
    {key:"inicio",text:"Início",icon:"⌂"},
    {key:"portal",text:"Portal",icon:"▦"},
    ...(has("fretes")||has("fretes2")?[{key:"fretes",text:"Fretes",icon:"🚛"}]:[]),
    ...(has("monitoramento")?[{key:"viagens",text:"Viagens",icon:"📍"}]:[]),
    {key:"mais",text:"Mais",icon:"☰"}
  ];
  return <View style={styles.tabbar}>
    {tabs.map(tab=><Pressable key={tab.key} accessibilityRole="button"
      accessibilityState={{selected:active===tab.key}}
      onPress={()=>onTab(tab.key)} style={[styles.tab,active===tab.key&&styles.tabActive]}>
      <Text style={styles.tabIcon}>{tab.icon}</Text>
      <Text style={[styles.tabLabel,active===tab.key&&styles.tabLabelActive]}>{tab.text}</Text>
    </Pressable>)}
  </View>;
}
function AppContent(){
  const browser=useRef(null),canBack=useRef(false);
  const expectEmployeeHome=useRef(false);
  const [employee,setEmployee]=useState(null);
  const [tenant,setTenant]=useState("");
  const [tenantInput,setTenantInput]=useState("");
  const [screen,setScreen]=useState("escolha");
  const [driverInvite,setDriverInvite]=useState("");
  const [currentRoute,setCurrentRoute]=useState(portalPage("login"));
  const [error,setError]=useState("");
  const [onlineError,setOnlineError]=useState("");
  const [loading,setLoading]=useState(false);

  const navigate=useCallback((page,company=tenant)=>{
    try{
      const url=portalPage(page,company);
      // Só a tela de login pode redirecionar automaticamente ao painel nativo.
      expectEmployeeHome.current=page==="login";
      setOnlineError("");
      setCurrentRoute(url);
      setScreen("web");
      canBack.current=false;
    }catch(e){Alert.alert("Módulo indisponível",e.message);}
  },[tenant]);

  const activate=useCallback(()=>{
    const slug=normalizeTenantSlug(tenantInput);
    if(slug===null){setError("Confira o código. Use apenas letras, números e hífen.");return;}
    setError("");setTenant(slug);setEmployee(null);navigate("login",slug);
  },[tenantInput,navigate]);

  const handleInvite=useCallback(url=>{
    const driverToken=extractDriverToken(url);
    if(driverToken){setDriverInvite(url);setScreen("driver");return true;}
    const slug=slugFromInvite(url);
    if(slug===null)return false;
    setTenant(slug);setTenantInput(slug);setError("");setEmployee(null);
    navigate("login",slug);
    return true;
  },[navigate]);

  useEffect(()=>{
    let mounted=true;
    Linking.getInitialURL().then(url=>{if(mounted&&url)handleInvite(url);}).catch(()=>{});
    const sub=Linking.addEventListener("url",event=>handleInvite(event.url));
    return()=>{mounted=false;sub.remove();};
  },[handleInvite]);

  const goBack=useCallback(()=>{
    if(screen==="web"){
      if(canBack.current&&browser.current){browser.current.goBack();return true;}
      setScreen("inicio");return true;
    }
    if(screen==="mais"){setScreen("inicio");return true;}
    if(screen==="driver"||screen==="inicio"){setScreen("escolha");return true;}
    return false;
  },[screen]);
  useEffect(()=>{
    if(Platform.OS!=="android")return;
    const sub=BackHandler.addEventListener("hardwareBackPress",goBack);
    return()=>sub.remove();
  },[goBack]);

  const openExternal=useCallback(url=>{
    if(!url||!(/^(https?:|mailto:|tel:|whatsapp:)/i).test(url))return;
    Linking.openURL(url).catch(()=>Alert.alert("Link externo","Não foi possível abrir este endereço."));
  },[]);
  const mayNavigate=useCallback(event=>{
    const url=event.url;
    if(trustedNavigation(url))return true;
    openExternal(url);
    return false;
  },[openExternal]);

  const tab=key=>{
    if(key==="inicio"||key==="mais"){setScreen(key);return;}
    if(!employee){navigate("login");return;}
    if(key==="portal")navigate("home");
    if(key==="fretes"){
      const available=employee.modules.find(item=>item.key==="fretes"||item.key==="fretes2");
      if(available)navigate(available.page);
    }
    if(key==="viagens"&&employee.modules.some(item=>item.key==="monitoramento"))
      navigate("monitoramento");
  };
  const onPortalMessage=useCallback(event=>{
    const url=event.nativeEvent.url||"";
    const next=parseEmployeeSessionMessage(event.nativeEvent.data,tenant,url);
    if(!next)return;
    setEmployee(next);
    if(expectEmployeeHome.current){
      expectEmployeeHome.current=false;
      setScreen("inicio");
    }
  },[tenant]);
  const onPortalLoadEnd=useCallback(event=>{
    const url=event.nativeEvent.url||"";
    if(validEmployeeHomeUrl(url,tenant))browser.current?.injectJavaScript(EMPLOYEE_HOME_BRIDGE);
  },[tenant]);
  const toolbarTitle=(()=>{
    if(currentRoute.includes("/login.html"))return "Entrar no Portal";
    if(currentRoute.includes("/monitoramento.html"))return "Monitoramento";
    if(currentRoute.includes("/fretes.html"))return "Fretes";
    return "Portal Frete";
  })();

  return <SafeAreaView style={styles.safe} edges={["top","bottom","left","right"]}>
    <StatusBar barStyle="dark-content" backgroundColor={c.white}/>
    {screen==="driver"&&
      <View style={styles.topbar}>
        <View style={styles.logo}><Text style={styles.logoText}>PF</Text></View>
        <View style={styles.topbarHeading}>
          <Text style={styles.topbarTitle}>PORTAL FRETE</Text>
          <Text style={styles.topbarSub}>LOGÍSTICA & TRANSPORTES</Text>
        </View>
        <View style={styles.topbarDot}/>
      </View>}
    {screen==="escolha"&&
      <WelcomeScreen onDriver={()=>setScreen("driver")}
        onEmployee={()=>{setEmployee(null);setScreen("inicio");}}/>}
    {screen==="driver"&&<DriverArea initialLink={driverInvite} onBack={()=>setScreen("escolha")}/>}
    {(screen==="inicio"||screen==="mais")&&
      <EmployeeDashboard employee={employee} tenant={tenant} tenantInput={tenantInput}
        onCompanyChange={setTenantInput} onActivate={activate}
        onOpen={page=>navigate(page)}
        onExit={()=>setScreen("escolha")} error={error}/>}

    {screen==="web"&&<View style={styles.browser}>
      <View style={styles.webToolbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar"
          onPress={()=>goBack()} style={styles.toolbarButton}>
          <Text style={styles.toolbarButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.webTitle} numberOfLines={1}>{toolbarTitle}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Atualizar"
          onPress={()=>browser.current?.reload()} style={styles.toolbarButton}>
          <Text style={styles.toolbarButtonText}>↻</Text>
        </Pressable>
      </View>
      <WebView
        ref={browser}
        source={{uri:currentRoute}}
        originWhitelist={["https://*"]}
        onShouldStartLoadWithRequest={mayNavigate}
        onOpenWindow={event=>openExternal(event.nativeEvent.targetUrl)}
        onNavigationStateChange={nav=>{
          canBack.current=nav.canGoBack;setLoading(nav.loading);
          try{
            const current=new URL(nav.url);
            if(current.origin==="https://portalfrete.net.br" &&
               current.pathname===new URL(portalPage("login",tenant)).pathname){
              // Login novamente ou logout: nunca conservar cartões antigos.
              setEmployee(null);
            }
          }catch{}
        }}
        onLoadEnd={onPortalLoadEnd}
        onMessage={onPortalMessage}
        onError={event=>setOnlineError(event.nativeEvent.description||"Falha de conexão")}
        onHttpError={event=>{
          if(event.nativeEvent.statusCode>=500)
            setOnlineError("O servidor está indisponível. Verifique a conexão e tente novamente.");
        }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled domStorageEnabled
        allowsInlineMediaPlayback
        mixedContentMode="never"
        setSupportMultipleWindows
        startInLoadingState
        renderLoading={()=><View style={styles.loading}><ActivityIndicator color={c.blue} size="large"/><Text style={styles.loadingText}>Conectando ao Portal Frete...</Text></View>}
      />
      {!!onlineError&&
        <View style={styles.webError}>
          <Text style={styles.webErrorTitle}>Falha ao abrir o Portal</Text>
          <Text style={styles.webErrorBody}>{onlineError}</Text>
          <Pressable accessibilityRole="button" onPress={()=>{setOnlineError("");browser.current?.reload();}}>
            <Text style={styles.webErrorAction}>Tentar novamente</Text>
          </Pressable>
        </View>}
      {loading&&<View style={styles.webProgress}/>}
    </View>}
    {employee&&["inicio","mais","web"].includes(screen)&&
      <BottomTabs active={screen==="web"?"portal":screen} onTab={tab} employee={employee}/>}
  </SafeAreaView>;
}
export default function App(){
  return <SafeAreaProvider><AppContent/></SafeAreaProvider>;
}
const styles=StyleSheet.create({
  flex:{flex:1},safe:{flex:1,backgroundColor:c.white},
  choice:{flex:1,padding:20,backgroundColor:"#f6fafd"},
  choiceIntro:{marginTop:26,marginBottom:28},
  choiceEyebrow:{color:c.green,fontSize:11,fontWeight:"900",letterSpacing:1.2},
  choiceTitle:{fontSize:27,fontWeight:"900",color:c.navy,marginTop:10},
  choiceDesc:{fontSize:13,lineHeight:20,color:c.muted,marginTop:7},
  choiceCard:{borderRadius:18,backgroundColor:"#fff",borderWidth:1,borderColor:c.line,
    padding:18,marginBottom:15,flexDirection:"row",alignItems:"center",minHeight:124},
  choiceIcon:{fontSize:28,marginRight:15},
  choiceCardText:{flex:1},choiceCardTitle:{fontSize:16,fontWeight:"900",color:c.navy},
  choiceCardDesc:{fontSize:12,lineHeight:18,color:c.muted,marginTop:7},
  choiceFoot:{fontSize:12,lineHeight:19,color:c.muted,marginTop:17,textAlign:"center"},
  pressed:{opacity:.78},
  topbar:{height:65,backgroundColor:c.white,paddingHorizontal:20,flexDirection:"row",alignItems:"center",borderBottomWidth:1,borderBottomColor:c.line},
  logo:{width:38,height:38,backgroundColor:c.navy,borderRadius:12,alignItems:"center",justifyContent:"center",marginRight:12},
  logoText:{fontSize:16,color:c.white,fontWeight:"900"},
  topbarHeading:{flex:1},topbarTitle:{fontWeight:"900",fontSize:14,color:c.navy,letterSpacing:1},
  topbarSub:{fontSize:9,color:c.muted,letterSpacing:1.2,marginTop:3,fontWeight:"700"},
  topbarDot:{height:10,width:10,borderRadius:5,backgroundColor:c.green},
  landing:{paddingBottom:35,backgroundColor:"#f7fbfe"},
  hero:{backgroundColor:c.navy,paddingHorizontal:23,paddingTop:26,paddingBottom:27},
  heroMark:{width:44,height:44,backgroundColor:"#265779",borderRadius:14,justifyContent:"center",alignItems:"center",marginBottom:15,borderWidth:1,borderColor:"#4983aa"},
  heroMarkText:{color:"#fff",fontWeight:"900",fontSize:19},
  eyebrow:{fontSize:11,color:"#85e1a9",fontWeight:"800",letterSpacing:1.4},
  heroTitle:{fontSize:30,fontWeight:"900",lineHeight:37,color:"#fff",marginTop:9,letterSpacing:-.6},
  heroBody:{color:"#bcd5e8",fontSize:13,lineHeight:20,marginTop:11},
  heroButton:{height:51,marginTop:23,borderRadius:13,backgroundColor:c.green,alignItems:"center",flexDirection:"row",paddingHorizontal:17,justifyContent:"space-between"},
  heroButtonText:{fontWeight:"900",color:"#fff",fontSize:14},heroButtonArrow:{color:"#fff",fontSize:21},
  heroHint:{fontSize:10,color:"#b4cbdb",marginTop:12,lineHeight:15},
  sectionHead:{marginTop:25,marginHorizontal:20,marginBottom:12},
  sectionTitle:{fontWeight:"900",fontSize:20,color:c.navy,marginBottom:4},
  sectionSub:{fontSize:12,color:c.muted,lineHeight:18},
  shortcutGroup:{marginHorizontal:16,backgroundColor:c.white,borderWidth:1,borderColor:c.line,borderRadius:17,overflow:"hidden"},
  shortcut:{flexDirection:"row",alignItems:"center",padding:14,minHeight:83,borderBottomWidth:1,borderBottomColor:"#ecf2f7"},
  shortcutIcon:{height:42,width:42,justifyContent:"center",alignItems:"center",borderRadius:13,backgroundColor:c.pale,marginRight:12},
  shortcutEmoji:{fontSize:20,color:c.blue},shortcutText:{flex:1,paddingRight:8},
  shortcutTitle:{fontSize:14,fontWeight:"800",color:c.text},
  shortcutDescription:{fontSize:11,color:c.muted,lineHeight:16,marginTop:4},
  chevron:{fontSize:26,color:"#86a0b4"},
  activation:{marginHorizontal:16,marginTop:22,padding:18,borderRadius:18,backgroundColor:"#eff7fd",borderWidth:1,borderColor:"#d2e7f5"},
  activationTitle:{fontSize:16,fontWeight:"900",color:c.navy},
  activationDesc:{fontSize:12,color:c.muted,lineHeight:19,marginTop:6},
  activationForm:{flexDirection:"row",gap:9,marginTop:13},
  activationInput:{flex:1,minWidth:0,height:45,paddingHorizontal:12,borderRadius:10,borderWidth:1,borderColor:"#bad5e7",backgroundColor:c.white,color:c.text,fontSize:13},
  activationButton:{backgroundColor:c.blue,borderRadius:10,paddingHorizontal:15,justifyContent:"center"},
  activationButtonText:{fontWeight:"800",fontSize:13,color:"#fff"},
  activationHint:{fontSize:10,color:c.muted,marginTop:10,lineHeight:15},error:{color:"#b3263e",fontSize:12,marginTop:9},
  footer:{textAlign:"center",color:"#87a1b4",fontSize:10,marginTop:22,fontWeight:"700",letterSpacing:.5},
  more:{flex:1,paddingTop:25,backgroundColor:"#f7fbfe"},
  warning:{margin:16,fontSize:12,color:c.warning,lineHeight:19},
  tabbar:{height:65,flexDirection:"row",alignItems:"center",borderTopWidth:1,borderTopColor:c.line,backgroundColor:c.white},
  tab:{flex:1,height:"100%",justifyContent:"center",alignItems:"center"},
  tabActive:{backgroundColor:"#f0f8fc"},
  tabIcon:{fontSize:21,color:c.navy},tabLabel:{color:c.muted,fontSize:10,fontWeight:"750",marginTop:2},
  tabLabelActive:{color:c.blue,fontWeight:"900"},
  browser:{flex:1,backgroundColor:"#fff"},
  webToolbar:{height:48,backgroundColor:c.white,borderBottomWidth:1,borderBottomColor:c.line,flexDirection:"row",alignItems:"center"},
  toolbarButton:{height:48,width:54,alignItems:"center",justifyContent:"center"},
  toolbarButtonText:{fontSize:30,color:c.blue,fontWeight:"600"},webTitle:{flex:1,textAlign:"center",fontWeight:"850",fontSize:13,color:c.navy},
  loading:{flex:1,justifyContent:"center",alignItems:"center",backgroundColor:c.white},
  loadingText:{fontSize:12,color:c.muted,marginTop:14},
  webError:{position:"absolute",top:65,left:20,right:20,borderWidth:1,borderColor:"#efb6c1",backgroundColor:"#fff2f4",padding:15,borderRadius:14},
  webErrorTitle:{fontWeight:"900",fontSize:14,color:"#a32743"},webErrorBody:{fontSize:12,color:"#9f425a",marginVertical:8},
  webErrorAction:{fontWeight:"800",color:c.blue,fontSize:13},webProgress:{height:2,backgroundColor:c.green}
});
