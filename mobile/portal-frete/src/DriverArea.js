import React,{useEffect,useState} from "react";
import {ActivityIndicator,Alert,Linking,Pressable,ScrollView,Share,StyleSheet,Text,TextInput,View} from "react-native";
import {palette as c} from "./theme";
import {
  extractDriverToken,getDriverTrip,isDriverTripReady,startDriverTracking,
  driverTrackingStatus,flushPendingFixes,revokeDriverTracking,restoreApprovedTracking
} from "./tracking";

const BTN=({title,onPress,disabled=false,secondary=false})=>
  <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={[styles.button,secondary&&styles.secondary,disabled&&{opacity:.5}]}>
    <Text style={[styles.buttonText,secondary&&styles.secondaryText]}>{title}</Text>
  </Pressable>;

export default function DriverArea({initialLink="",onBack}){
  const [tab,setTab]=useState("viagem");
  const [link,setLink]=useState(initialLink);
  const [trip,setTrip]=useState(null);
  const [active,setActive]=useState(false);
  const [queued,setQueued]=useState(0);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [freightOffers,setFreightOffers]=useState([]);
  const [freightLoading,setFreightLoading]=useState(false);
  const [freightError,setFreightError]=useState("");
  const [freightSearch,setFreightSearch]=useState("");

  async function loadFreightOffers(){
    if(freightLoading)return;
    setFreightLoading(true);setFreightError("");
    try{
      const response=await fetch("https://api.portalfrete.net.br/v1/driver-freights",{
        method:"GET",headers:{"Accept":"application/json"},cache:"no-store"
      });
      const data=await response.json().catch(()=>({ok:false}));
      if(!response.ok||!data.ok||!Array.isArray(data.fretes))
        throw Error(data.error||"Não foi possível carregar os fretes.");
      // Nunca ler recursos do portal operacional: só ofertas já divulgadas.
      setFreightOffers(data.fretes);
    }catch(e){setFreightError(e.message||"Falha ao atualizar os fretes.");}
    finally{setFreightLoading(false);}
  }
  useEffect(()=>{if(tab==="fretes")void loadFreightOffers();},[tab]);
  const offerMatches=(offer)=>{
    const needle=freightSearch.trim().toLocaleUpperCase("pt-BR");
    if(!needle)return true;
    return [offer.origem,offer.destino,offer.produto,offer.source].join(" ")
      .toLocaleUpperCase("pt-BR").includes(needle);
  };
  async function shareOffer(offer){
    try{
      const text=[
        "🚛 FRETE NOVA FROTA",
        (offer.origem||"")+" → "+(offer.destino||""),
        "Produto: "+(offer.produto||"A consultar"),
        "Volume: "+(offer.volume||"A consultar"),
        "Valor motorista: "+(offer.valorMotorista||"A consultar"),
        "Oferta divulgada pelo Portal Frete."
      ].join("\n");
      await Share.share({message:text});
    }catch(e){Alert.alert("Compartilhamento",e.message||"Não foi possível compartilhar.");}
  }
  const token=extractDriverToken(link);
  async function status(){
    const state=await driverTrackingStatus();
    setActive(state.running);setQueued(state.queued);
    if(state.trip)setTrip(state.trip);
    return state;
  }
  useEffect(()=>{
    let mounted=true;
    restoreApprovedTracking().then(async saved=>{
      if(!mounted)return;
      if(saved.token&&!initialLink){
        setLink("https://portalfrete.net.br/pages/monitorar-motorista.html#"+saved.token);
      }
      await status();
    }).catch(()=>status().catch(()=>{}));
    return()=>{mounted=false;};
  },[]);
  useEffect(()=>{if(initialLink){setLink(initialLink);setTab("viagem");}},[initialLink]);
  useEffect(()=>{
    if(!active)return;
    const id=setInterval(()=>status().catch(()=>{}),30000);
    return()=>clearInterval(id);
  },[active]);
  const job=async(fn)=>{
    if(busy)return;
    setBusy(true);setNotice("");
    try{await fn();}
    catch(e){setNotice(e.message||"Não foi possível concluir.");}
    finally{setBusy(false);}
  };
  const verify=()=>job(async()=>{
    if(!token)throw Error("Cole o link completo da viagem enviado pela Nova Frota.");
    const data=await getDriverTrip(token);
    setTrip(data);
    setNotice(isDriverTripReady(data)?
      "Viagem autorizada. Ative o rastreamento nativo para continuar com a tela bloqueada.":
      "Antes de ativar o monitoramento, envie a selfie e aceite o termo da viagem.");
  });
  const openEvidence=()=>job(async()=>{
    if(!token)throw Error("Cole o link da viagem para abrir as etapas.");
    const url="https://portalfrete.net.br/pages/monitorar-motorista.html#"+token;
    await Linking.openURL(url);
  });
  const begin=()=>job(async()=>{
    if(!token)throw Error("Informe o link da sua viagem.");
    const data=await startDriverTracking(token);
    setTrip(data);await status();
    setNotice("Monitoramento nativo iniciado. Pode bloquear a tela ou usar outros aplicativos. Mantenha o GPS e os dados móveis ligados.");
  });
  const sync=()=>job(async()=>{
    const result=await flushPendingFixes();
    await status();
    setNotice(result.error?"Aguardando rede: "+result.error:result.sent+" posição(ões) sincronizada(s).");
  });
  const revoke=()=>Alert.alert("Desativar compartilhamento",
    "A Central da Nova Frota poderá identificar a ausência de posições. A viagem não será finalizada.",
    [{text:"Manter monitoramento",style:"cancel"},
     {text:"Desativar",style:"destructive",onPress:()=>job(async()=>{
       await revokeDriverTracking();await status();
       setNotice("O compartilhamento deste dispositivo foi desativado. A viagem permanece aberta.");
     })}]);
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}
    keyboardShouldPersistTaps="handled">
    <Pressable onPress={onBack} accessibilityRole="button"><Text style={styles.back}>‹ Voltar</Text></Pressable>
    <Text style={styles.eyebrow}>PORTAL FRETE · MOTORISTA</Text>
    <Text style={styles.title}>Sua rota, com segurança.</Text>
    <Text style={styles.subtitle}>Nesta área você encontra os fretes divulgados e acompanha sua viagem.</Text>
    <View style={styles.tabs}>
      <Pressable style={[styles.tab,tab==="viagem"&&styles.selected]} onPress={()=>setTab("viagem")}>
        <Text style={[styles.tabText,tab==="viagem"&&styles.tabTextSelected]}>📍 Minha viagem</Text>
      </Pressable>
      <Pressable style={[styles.tab,tab==="fretes"&&styles.selected]} onPress={()=>setTab("fretes")}>
        <Text style={[styles.tabText,tab==="fretes"&&styles.tabTextSelected]}>🚛 Fretes</Text>
      </Pressable>
    </View>
    {tab==="fretes"?<View style={styles.freightsArea}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fretes disponíveis da Nova Frota</Text>
        <Text style={styles.info}>Ofertas selecionadas para divulgação pela equipe Nova Frota. Os dados operacionais internos não são exibidos.</Text>
        <TextInput accessibilityLabel="Buscar frete por cidade ou produto"
          value={freightSearch} onChangeText={setFreightSearch}
          autoCapitalize="characters" autoCorrect={false}
          placeholder="Buscar origem, destino ou produto"
          placeholderTextColor="#7890a3" style={styles.search}/>
        <BTN title={freightLoading?"Atualizando...":"Atualizar fretes"}
          onPress={loadFreightOffers} disabled={freightLoading} secondary/>
        {freightLoading&&<ActivityIndicator color={c.blue} style={{marginTop:12}}/>}
        {!!freightError&&<Text style={styles.error}>{freightError}</Text>}
        {!freightLoading&&!freightError&&!freightOffers.filter(offerMatches).length&&
          <View style={styles.emptyOffers}>
            <Text style={styles.emptyTitle}>Nenhum frete divulgado neste momento</Text>
            <Text style={styles.info}>Quando a equipe publicar um frete nos módulos operacionais, ele aparecerá aqui. Novas ofertas podem ser divulgadas a qualquer momento.</Text>
          </View>}
      </View>
      {freightOffers.filter(offerMatches).map(offer=>
        <View key={offer.source+":"+offer.sourceId} style={styles.offerCard}>
          <View style={styles.offerTop}>
            <Text style={styles.offerSource}>{offer.source==="fretes2"?"NOVA FROTA • MT":"NOVA FROTA • OPERACIONAL"}</Text>
            <Text style={styles.offerStatus}>DISPONÍVEL</Text>
          </View>
          <Text style={styles.offerRoute}>{offer.origem} → {offer.destino}</Text>
          <View style={styles.offerDetails}>
            <Text style={styles.offerDetail}>Produto: <Text style={styles.offerValue}>{offer.produto}</Text></Text>
            {!!offer.volume&&<Text style={styles.offerDetail}>Volume: <Text style={styles.offerValue}>{offer.volume}</Text></Text>}
            <Text style={styles.offerDetail}>Frete motorista: <Text style={styles.offerValue}>{offer.valorMotorista||"A consultar"}</Text></Text>
          </View>
          <Text style={styles.offerExpiry}>Oferta divulgada até {new Date(offer.expiresAt).toLocaleString("pt-BR")}</Text>
          <BTN title="Compartilhar frete" onPress={()=>shareOffer(offer)} secondary/>
        </View>
      )}
    </View>:<>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Vincular uma viagem</Text>
        <Text style={styles.info}>Cole o link da viagem recebido da Nova Frota. Ele identifica somente a sua viagem.</Text>
        <TextInput value={link} onChangeText={setLink} autoCapitalize="none"
          autoCorrect={false} accessibilityLabel="Link da sua viagem"
          placeholder="Cole aqui o link da viagem..." style={styles.input}
          placeholderTextColor="#7890a3" multiline numberOfLines={2}/>
        <BTN title="Conferir viagem" onPress={verify} disabled={busy||!token} secondary/>
        {trip&&<View style={styles.trip}>
          <Text style={styles.tripName}>{trip.plate} · {trip.driver}</Text>
          <Text style={styles.info}>{trip.origin||"Origem não informada"} → {trip.destination||"Destino não informado"}</Text>
          <Text style={styles.small}>Selfie: {trip.selfieStatus||"não enviada"} · Aceite: {trip.gpsConsentAt?"registrado":"pendente"}</Text>
        </View>}
        <BTN title="1. Abrir selfie, termo e comprovante" onPress={openEvidence} disabled={busy||!token} secondary/>
        <View style={{height:10}}/>
        <BTN title={active?"Monitoramento já ativo":"2. Ativar rastreamento nativo"} onPress={begin}
          disabled={busy||!token||active}/>
      </View>
      <View style={[styles.card,active&&styles.active]}>
        <Text style={styles.cardTitle}>{active?"● GPS nativo ativo":"GPS nativo desligado"}</Text>
        <Text style={styles.info}>{active?
          "O aplicativo está configurado para enviar localização com a tela bloqueada e em segundo plano, conforme permissões do sistema.":
          "O compartilhamento nativo só começa após sua autorização e início da viagem."}</Text>
        <Text style={styles.small}>Posições aguardando envio: {queued}</Text>
        <Text style={styles.small}>Internet ou GPS indisponíveis podem interromper o recebimento pela Central. O sistema não impede a revogação das permissões.</Text>
        {active&&<View style={styles.buttons}>
          <BTN title="Sincronizar agora" secondary onPress={sync} disabled={busy}/>
          <View style={{height:8}}/>
          <BTN title="Desativar compartilhamento" secondary onPress={revoke} disabled={busy}/>
        </View>}
      </View>
    </>}
    {busy&&<ActivityIndicator style={{marginTop:14}} color={c.blue}/>}
    {!!notice&&<Text accessibilityRole="alert" style={styles.notice}>{notice}</Text>}
    <Text style={styles.foot}>Sua localização só deve ser coletada durante a viagem autorizada. Para cargas de alto risco, um rastreador veicular independente continua sendo recomendado.</Text>
  </ScrollView>;
}
const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#f6fafd"},
  content:{padding:18,paddingBottom:35},
  back:{color:c.blue,fontSize:15,fontWeight:"800",marginBottom:20},
  eyebrow:{color:c.green,fontSize:11,fontWeight:"900",letterSpacing:1},
  title:{fontSize:25,color:c.navy,fontWeight:"900",marginTop:8},
  subtitle:{color:c.muted,fontSize:13,lineHeight:20,marginTop:8,marginBottom:20},
  tabs:{flexDirection:"row",gap:9,marginBottom:14},
  tab:{flex:1,borderRadius:10,padding:13,alignItems:"center",backgroundColor:"#e7f0f7"},
  selected:{backgroundColor:c.navy},
  tabText:{fontWeight:"800",color:c.navy,fontSize:12},
  tabTextSelected:{color:"#fff"},
  card:{backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:c.line,padding:18,marginBottom:12},
  active:{backgroundColor:"#effaf3",borderColor:"#91c8a2"},
  cardTitle:{fontSize:17,fontWeight:"900",color:c.navy,marginBottom:9},
  info:{fontSize:12,lineHeight:19,color:c.muted,marginBottom:12},
  input:{minHeight:60,borderWidth:1,borderColor:"#b9d3e4",borderRadius:11,
    padding:12,marginBottom:12,fontSize:12,color:c.text,textAlignVertical:"top"},
  button:{backgroundColor:c.green,padding:14,borderRadius:10,alignItems:"center"},
  secondary:{backgroundColor:"#e5f0fa"},
  buttonText:{fontSize:12,fontWeight:"900",color:"#fff",textAlign:"center"},
  secondaryText:{color:c.navy},
  trip:{borderRadius:10,padding:12,backgroundColor:"#edf6fc",marginBottom:12},
  tripName:{fontSize:14,fontWeight:"900",color:c.navy,marginBottom:5},
  small:{fontSize:11,color:c.muted,lineHeight:17,marginTop:4},
  buttons:{marginTop:12},
  notice:{backgroundColor:"#ecf3fc",borderRadius:10,padding:13,color:c.navy,fontSize:12,lineHeight:19,marginTop:8},
  freightsArea:{gap:12},
  search:{height:48,borderWidth:1,borderColor:"#b9d3e4",borderRadius:11,
    paddingHorizontal:12,marginBottom:12,color:c.navy,backgroundColor:"#fff",fontSize:13},
  error:{color:"#ae3044",fontWeight:"700",fontSize:12,marginTop:10,lineHeight:19},
  emptyOffers:{paddingTop:18},
  emptyTitle:{fontWeight:"900",fontSize:14,color:c.navy,marginBottom:7},
  offerCard:{backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:c.line,padding:17},
  offerTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:13},
  offerSource:{color:c.navy,fontSize:10,fontWeight:"900",letterSpacing:.5},
  offerStatus:{color:c.green,fontSize:10,fontWeight:"900"},
  offerRoute:{color:c.navy,fontSize:17,fontWeight:"900",lineHeight:25,marginBottom:13},
  offerDetails:{backgroundColor:"#eff6fb",borderRadius:10,padding:13,gap:9},
  offerDetail:{fontSize:12,color:c.muted,lineHeight:19},
  offerValue:{fontWeight:"900",color:c.navy},
  offerExpiry:{fontSize:10,color:c.muted,marginVertical:13},
  foot:{fontSize:11,color:c.muted,lineHeight:18,marginTop:10}
});
