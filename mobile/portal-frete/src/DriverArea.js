import React,{useEffect,useState} from "react";
import {ActivityIndicator,Alert,Image,Linking,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {palette as c} from "./theme";
import {
  extractDriverToken,getDriverTrip,isDriverTripReady,startDriverTracking,
  driverTrackingStatus,flushPendingFixes,restoreApprovedTracking,
  stopAfterApprovedDriverStage
} from "./tracking";
import {
  rememberDriverJourney,restoreDriverJourney,forgetDriverJourney,
  acceptDriverTripTerm,finishDriverJourneyStage,
  takeDriverSelfie,takeDriverReceiptPhoto,chooseDriverReceiptPhoto,
  chooseDriverReceiptDocument,uploadDriverEvidence
} from "./driver-evidence";

const formatDriverFreight=value=>{
  const raw=String(value??"").trim();
  if(!raw)return "A consultar";
  const withoutCurrency=raw.replace(/^R\$\s*/i,"");
  const match=withoutCurrency.match(/^(\d[\d.,]*)(\s*\/\s*[a-zÀ-ÿ]+)?$/i);
  if(!match)return raw;
  const token=match[1];
  const numberText=token.includes(",")
    ?token.replace(/\./g,"").replace(",",".")
    :/^\d{1,3}(?:\.\d{3})+$/.test(token)?token.replace(/\./g,""):token;
  const numeric=Number(numberText);
  if(!Number.isFinite(numeric))return raw;
  return new Intl.NumberFormat("pt-BR",{
    style:"currency",currency:"BRL",minimumFractionDigits:2,maximumFractionDigits:2
  }).format(numeric)+(match[2]||"").replace(/\s+/g,"");
};

const AXLE_TYPES=[
  {key:"e5",label:"5E"},{key:"e6",label:"6E"},{key:"e7",label:"7E"},
  {key:"e4",label:"4E"},{key:"e9",label:"9E"}
];
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
  const [selfieAsset,setSelfieAsset]=useState(null);
  const [receiptAsset,setReceiptAsset]=useState(null);
  const [photoNotice,setPhotoNotice]=useState(false);
  const [termConsent,setTermConsent]=useState(false);

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
    return [offer.origem,offer.destino,offer.coleta,offer.descarga,offer.produto,offer.source].join(" ")
      .toLocaleUpperCase("pt-BR").includes(needle);
  };
  function whatsappForOffer(offer){
    const phone=String(offer?.whatsappEmbarcador||"").replace(/\D/g,"");
    return /^55\d{10,11}$/.test(phone)?phone:"";
  }
  async function contactEmbarcador(offer){
    const phone=whatsappForOffer(offer);
    if(!phone){
      Alert.alert("WhatsApp indisponível","Este frete ainda não tem um contato de embarcador autorizado. Peça à Nova Frota para republicar a oferta.");
      return;
    }
    const message=[
      "Olá! Vi este frete no aplicativo Portal Frete e gostaria de mais informações:",
      (offer.origem||"")+" → "+(offer.destino||""),
      ...(offer.coleta?["Coleta: "+offer.coleta]:[]),
      ...(offer.descarga?["Descarga: "+offer.descarga]:[]),
      "Produto: "+(offer.produto||"A consultar"),
      "Volume: "+(offer.volume||"A consultar"),
      "Frete motorista: "+(offer.valorMotorista||"A consultar")
    ].join("\n");
    const url="https://wa.me/"+phone+"?text="+encodeURIComponent(message);
    try{
      await Linking.openURL(url);
    }catch(e){
      Alert.alert("Não foi possível abrir o WhatsApp",e?.message||"Confira se o WhatsApp está instalado.");
    }
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
    (async()=>{
      const saved=await restoreApprovedTracking().catch(()=>({token:null}));
      const evidence=await restoreDriverJourney().catch(()=>null);
      if(!mounted)return;
      const recovered=initialLink||saved.token||evidence;
      if(recovered&&!initialLink){
        setLink("https://portalfrete.net.br/pages/monitorar-motorista.html#"+
          (extractDriverToken(recovered)||recovered));
      }
      if(recovered){
        const recoveredTrip=await getDriverTrip(extractDriverToken(recovered)).catch(()=>null);
        if(mounted&&recoveredTrip)setTrip(recoveredTrip);
      }
      await status();
    })().catch(()=>status().catch(()=>{}));
    return()=>{mounted=false;};
  },[]);
  useEffect(()=>{if(initialLink){setLink(initialLink);setTab("viagem");setTrip(null);}},[initialLink]);
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
    await rememberDriverJourney(token);
    const message=!data.active?"Viagem encerrada pela Central da Nova Frota.":
      data.receiptStatus==="approved"?"Comprovante aprovado pela Nova Frota. Confira a finalização na página da viagem.":
      data.receiptStatus==="rejected"?"Comprovante rejeitado. Abra a viagem e anexe um novo comprovante.":
      data.receiptStatus==="pending"?"Comprovante recebido. Aguardando conferência pela equipe da Nova Frota.":
      isDriverTripReady(data)?"Viagem ativa. O comprovante de descarga ainda precisa ser enviado.":
      "Antes de ativar o monitoramento, envie a selfie e aceite o termo da viagem.";
    setNotice(message);
  });
  const chooseSelfie=()=>job(async()=>{
    const item=await takeDriverSelfie();
    if(item){setSelfieAsset(item);setPhotoNotice(false);setNotice("Confira a foto do seu rosto antes de enviar.");}
  });
  const chooseReceipt=(source)=>job(async()=>{
    const item=source==="camera"?await takeDriverReceiptPhoto():
      source==="gallery"?await chooseDriverReceiptPhoto():await chooseDriverReceiptDocument();
    if(item){setReceiptAsset(item);setNotice("Confira o comprovante selecionado antes de enviar.");}
  });
  const uploadSelfie=()=>job(async()=>{
    if(!token||!selfieAsset||!photoNotice)throw Error("Selecione a selfie e confirme o aviso sobre a foto.");
    await uploadDriverEvidence(token,"selfie",selfieAsset);
    await rememberDriverJourney(token);
    setSelfieAsset(null);setPhotoNotice(false);
    setTrip(await getDriverTrip(token));
    setNotice("Selfie enviada com segurança. A Nova Frota fará a conferência.");
  });
  const uploadReceipt=()=>job(async()=>{
    if(!token||!receiptAsset)throw Error("Selecione um comprovante antes do envio.");
    await uploadDriverEvidence(token,"receipt",receiptAsset);
    await rememberDriverJourney(token);
    setReceiptAsset(null);
    setTrip(await getDriverTrip(token));
    setNotice("Comprovante enviado. A viagem continua aberta até a conferência da Nova Frota.");
  });
  const acceptTerm=()=>job(async()=>{
    if(!token||!termConsent)throw Error("Leia e aceite o termo da viagem.");
    await acceptDriverTripTerm(token);
    await rememberDriverJourney(token);
    setTrip(await getDriverTrip(token));
    setTermConsent(false);
    setNotice("Aceite registrado. Você pode ativar o rastreamento nativo da viagem.");
  });
  const finishStage=()=>Alert.alert("Finalizar etapa da viagem?",
    "A Nova Frota aprovou os documentos. A finalização interrompe o GPS desta viagem; o encerramento operacional será confirmado pela Central.",
    [{text:"Cancelar",style:"cancel"},{text:"Confirmar",onPress:()=>job(async()=>{
      if(!token)throw Error("Viagem não vinculada.");
      await finishDriverJourneyStage(token);
      await stopAfterApprovedDriverStage(token);
      setTrip(await getDriverTrip(token));
      await status();
      setNotice("Etapa finalizada após aprovação. A Central confirmará o encerramento operacional.");
    })}]);
  const begin=()=>job(async()=>{
    if(!token)throw Error("Informe o link da sua viagem.");
    const data=await startDriverTracking(token);
    await rememberDriverJourney(token);
    setTrip(data);await status();
    setNotice("Monitoramento nativo iniciado. Pode bloquear a tela ou usar outros aplicativos. Mantenha o GPS e os dados móveis ligados.");
  });
  const sync=()=>job(async()=>{
    const result=await flushPendingFixes();
    await status();
    setNotice(result.error?"Aguardando rede: "+result.error:result.sent+" posição(ões) sincronizada(s).");
  });
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}
    keyboardShouldPersistTaps="handled">
    <Pressable onPress={onBack} accessibilityRole="button"><Text style={styles.back}>‹ Voltar</Text></Pressable>
    <Text style={styles.eyebrow}>PORTAL FRETE · MOTORISTA</Text>
    <Text style={styles.title}>{tab==="fretes"?"Ofertas de Frete":"Sua rota, com segurança."}</Text>
    <Text style={styles.subtitle}>{tab==="fretes"
      ?"Confira as cargas disponíveis para você."
      :"Nesta área você encontra os fretes divulgados e acompanha sua viagem."}</Text>
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
          <View style={styles.offerLocations}>
            <View style={styles.offerLocationRow}>
              <Text style={styles.offerLocationIcon}>📍</Text>
              <Text style={styles.offerLocationText}>
                <Text style={styles.offerLocationLabel}>Coleta: </Text>
                {offer.coleta||"Local não informado"}
              </Text>
            </View>
            <View style={styles.offerLocationRow}>
              <Text style={styles.offerLocationIcon}>🏁</Text>
              <Text style={styles.offerLocationText}>
                <Text style={styles.offerLocationLabel}>Descarga: </Text>
                {offer.descarga||"Local não informado"}
              </Text>
            </View>
          </View>
          <View style={styles.offerDetailsRow}>
            <View style={styles.offerDetails}>
              <Text style={styles.offerDetail}>🌱 Produto: <Text style={styles.offerValue}>{offer.produto}</Text></Text>
              <View style={styles.offerDivider}/>
              <Text style={styles.offerDetail}>📦 Volume: <Text style={styles.offerValue}>{offer.volume||"A consultar"}</Text></Text>
              <View style={styles.offerDivider}/>
              <Text style={styles.offerAxleTitle}>🚛 Veículos aceitos:</Text>
              <View style={styles.offerAxleList}>
                {AXLE_TYPES.map(type=>{
                  const raw=String(offer[type.key]??"").trim().toUpperCase();
                  const status=raw==="S"?"S":raw==="N"?"N":"?";
                  return <View key={type.key} style={styles.offerAxleChip}>
                    <Text style={styles.offerAxleChipTitle}>{type.label}</Text>
                    <Text style={[styles.offerAxleStatus,
                      status==="S"?styles.offerAxleYes:
                      status==="N"?styles.offerAxleNo:styles.offerAxleUnknown]}>
                      {status}
                    </Text>
                  </View>;
                })}
              </View>
            </View>
            <View style={styles.offerAmountCard}>
              <Text style={styles.offerAmountLabel}>Frete motorista</Text>
              <Text style={styles.offerAmount} numberOfLines={2} adjustsFontSizeToFit>
                {formatDriverFreight(offer.valorMotorista)}
              </Text>
            </View>
          </View>
          <Text style={styles.offerExpiry}>▣  Oferta divulgada até {new Date(offer.expiresAt).toLocaleString("pt-BR")}</Text>
          <BTN title={whatsappForOffer(offer)?"🟢 Falar com o embarcador no WhatsApp":"WhatsApp do embarcador indisponível"}
            onPress={()=>contactEmbarcador(offer)} disabled={!whatsappForOffer(offer)}/>
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
        <Text style={styles.small}>As etapas abaixo são realizadas dentro do aplicativo, sem abrir o navegador.</Text>
      </View>
      {trip&&<View style={styles.receiptCard}>
        <Text style={styles.cardTitle}>1. Selfie de identificação</Text>
        <Text style={styles.receiptText}>Foto do rosto para conferência manual da identidade. Não há reconhecimento facial automático.</Text>
        <Text style={[styles.receiptStatus,
          trip.selfieStatus==="approved"?styles.receiptApproved:
          trip.selfieStatus==="rejected"?styles.receiptRejected:styles.receiptPending]}>
          {trip.selfieStatus==="approved"?"✓ Selfie aprovada":
           trip.selfieStatus==="pending"?"⌛ Selfie enviada: aguardando conferência":
           trip.selfieStatus==="rejected"?"✕ Selfie rejeitada: tire uma nova foto":
           "Selfie ainda não enviada"}
        </Text>
        {trip.active&&trip.selfieRequired&&["missing","rejected"].includes(trip.selfieStatus)&&<>
          <BTN title="📷 Tirar selfie com câmera frontal" onPress={chooseSelfie} disabled={busy} secondary/>
          {selfieAsset&&<View style={styles.previewBox}>
            <Image source={{uri:selfieAsset.uri}} style={styles.photoPreview} resizeMode="contain"/>
            <Text style={styles.small}>Prévia: {selfieAsset.name}. Verifique se o rosto está nítido.</Text>
          </View>}
          <Pressable onPress={()=>setPhotoNotice(!photoNotice)} style={styles.consentRow}
            accessibilityRole="checkbox" accessibilityState={{checked:photoNotice}}>
            <Text style={styles.consentMark}>{photoNotice?"☑":"□"}</Text>
            <Text style={styles.consentText}>Li o aviso sobre o uso da minha foto para conferência de identidade nesta viagem.</Text>
          </Pressable>
          <BTN title="Enviar selfie com segurança" onPress={uploadSelfie}
            disabled={busy||!selfieAsset||!photoNotice}/>
        </>}
      </View>}
      {trip&&<View style={styles.receiptCard}>
        <Text style={styles.cardTitle}>2. Termo e início da viagem</Text>
        <Text style={styles.receiptText}>Estou ciente de que, ao iniciar a viagem, a Nova Frota acompanhará as posições que meu celular enviar durante o transporte, para segurança da viagem, até a entrega e a conferência dos documentos.</Text>
        <Text style={styles.receiptText}>A finalização só será liberada após o envio e a aprovação da selfie (quando exigida) e do comprovante de descarga pela Nova Frota. Posso alterar a permissão de localização a qualquer momento nas configurações do celular, sem encerrar a viagem.</Text>
        {trip.gpsConsentAt?
          <Text style={[styles.receiptStatus,styles.receiptApproved]}>✓ Termo aceito e registrado no servidor</Text>:
          trip.active&&(!trip.selfieRequired||["pending","approved"].includes(trip.selfieStatus))?<>
            <Pressable onPress={()=>setTermConsent(!termConsent)} style={styles.consentRow}
              accessibilityRole="checkbox" accessibilityState={{checked:termConsent}}>
              <Text style={styles.consentMark}>{termConsent?"☑":"□"}</Text>
              <Text style={styles.consentText}>Li e aceito o termo desta viagem e autorizo o envio das posições durante o percurso.</Text>
            </Pressable>
            <BTN title="Aceitar termo de monitoramento" onPress={acceptTerm}
              disabled={busy||!termConsent}/>
          </>:
          <Text style={styles.receiptText}>Envie a selfie antes de aceitar o termo.</Text>}
        {trip.active&&!trip.gpsFinishedAt&&<BTN
          title={active?"Rastreamento já ativo":"Ativar rastreamento nativo"}
          onPress={begin} disabled={busy||active||!trip.gpsConsentAt||
            (trip.selfieRequired&&!["pending","approved"].includes(trip.selfieStatus))} secondary/>}
      </View>}
      {trip&&<View style={styles.receiptCard}>
        <Text style={styles.cardTitle}>3. Comprovante de descarga</Text>
        <Text style={[styles.receiptStatus,
          trip.receiptStatus==="approved"?styles.receiptApproved:
          trip.receiptStatus==="rejected"?styles.receiptRejected:styles.receiptPending]}>
          {trip.receiptStatus==="approved"?"✓ Aprovado pela Nova Frota":
           trip.receiptStatus==="pending"?"⌛ Enviado: aguardando conferência":
           trip.receiptStatus==="rejected"?"✕ Rejeitado: envie outro comprovante":
           "Pendente: comprovante não enviado"}
        </Text>
        <Text style={styles.receiptText}>Ao terminar a descarga, envie uma foto legível ou um PDF. A equipe da Nova Frota deverá conferir e aprovar antes de finalizar.</Text>
        {trip.active&&["missing","rejected"].includes(trip.receiptStatus)&&
          (!trip.selfieRequired||["pending","approved"].includes(trip.selfieStatus))&&<>
          <View style={styles.choiceRow}>
            <View style={styles.choiceHalf}><BTN title="📷 Câmera" onPress={()=>chooseReceipt("camera")} disabled={busy} secondary/></View>
            <View style={styles.choiceHalf}><BTN title="🖼 Galeria" onPress={()=>chooseReceipt("gallery")} disabled={busy} secondary/></View>
          </View>
          <BTN title="📄 Escolher PDF ou imagem do celular" onPress={()=>chooseReceipt("document")} disabled={busy} secondary/>
          {receiptAsset&&<View style={styles.previewBox}>
            {receiptAsset.isImage&&<Image source={{uri:receiptAsset.uri}}
              style={styles.photoPreview} resizeMode="contain"/>}
            <Text style={styles.small}>Arquivo escolhido: {receiptAsset.name}</Text>
            <Text style={styles.small}>Confira o documento antes de confirmar o envio.</Text>
          </View>}
          <BTN title="Enviar comprovante de descarga" onPress={uploadReceipt}
            disabled={busy||!receiptAsset}/>
        </>}
        <BTN title="Atualizar status da conferência" secondary
          onPress={verify} disabled={busy||!token}/>
      </View>}
      {trip&&<View style={styles.receiptCard}>
        <Text style={styles.cardTitle}>4. Finalização da viagem</Text>
        {trip.gpsFinishedAt?
          <Text style={[styles.receiptStatus,styles.receiptApproved]}>✓ Etapa de finalização concluída. A Central confirma o encerramento operacional.</Text>:
          <Text style={styles.receiptText}>Para finalizar, o comprovante precisa estar anexado e aprovado. Desligar o GPS ou revogar a permissão no celular não encerra esta viagem.</Text>}
        {trip.active&&!trip.gpsFinishedAt&&
          <BTN title={trip.receiptStatus==="approved"&&
              (!trip.selfieRequired||trip.selfieStatus==="approved")
              ?"Finalizar etapa da viagem":"🔒 Aguardando aprovação do comprovante"}
            onPress={finishStage} disabled={busy||trip.receiptStatus!=="approved"||
              (trip.selfieRequired&&trip.selfieStatus!=="approved")}/>}
      </View>}
      <View style={[styles.card,active&&styles.active]}>
        <Text style={styles.cardTitle}>{active?"● GPS nativo ativo":"GPS nativo desligado"}</Text>
        <Text style={styles.info}>{active?
          "O aplicativo está configurado para enviar localização com a tela bloqueada e em segundo plano, conforme permissões do sistema.":
          "O compartilhamento nativo só começa após sua autorização e início da viagem."}</Text>
        <Text style={styles.small}>Posições aguardando envio: {queued}</Text>
        <Text style={styles.small}>Internet ou GPS indisponíveis podem interromper o recebimento pela Central. Para revogar a localização, altere a permissão do Portal Frete nas configurações do celular. A viagem continua aberta e o comprovante segue obrigatório.</Text>
        {active&&<View style={styles.buttons}>
          <BTN title="Sincronizar agora" secondary onPress={sync} disabled={busy}/>
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
  choiceRow:{flexDirection:"row",gap:9,marginVertical:3},
  choiceHalf:{flex:1},
  previewBox:{borderWidth:1,borderColor:"#c8dbe9",borderRadius:12,
    padding:10,backgroundColor:"#fff",marginVertical:8,gap:5},
  photoPreview:{height:230,width:"100%",borderRadius:9,backgroundColor:"#edf5fa"},
  consentRow:{flexDirection:"row",alignItems:"flex-start",gap:9,paddingVertical:12},
  consentMark:{fontSize:24,color:"#168a4b",lineHeight:28},
  consentText:{flex:1,fontSize:12.5,color:"#244565",lineHeight:20},

  receiptCard:{backgroundColor:"#f6faff",borderWidth:1,borderColor:"#bfd5ea",
    borderRadius:16,padding:16,marginTop:14,gap:7},
  receiptStatus:{fontSize:12,fontWeight:"900",paddingVertical:9,paddingHorizontal:10,
    overflow:"hidden",borderRadius:9,alignSelf:"stretch"},
  receiptApproved:{backgroundColor:"#e5f8eb",color:"#136b36"},
  receiptRejected:{backgroundColor:"#fff0f1",color:"#aa2845"},
  receiptPending:{backgroundColor:"#eaf1fb",color:"#284e79"},
  receiptText:{fontSize:12,color:"#405d7a",lineHeight:19,marginBottom:7},
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
  offerCard:{backgroundColor:"#fff",borderRadius:20,borderWidth:1,borderColor:"#d8e4ef",padding:16,
    shadowColor:"#16375c",shadowOffset:{width:0,height:3},shadowOpacity:.08,shadowRadius:10,elevation:3},
  offerTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:6,
    backgroundColor:"#eaf2fc",borderRadius:12,paddingHorizontal:10,paddingVertical:10,marginBottom:13},
  offerSource:{color:"#082957",fontSize:10,fontWeight:"900",letterSpacing:.3,flexShrink:1},
  offerStatus:{color:"#176c38",backgroundColor:"#dcf7e4",overflow:"hidden",
    borderRadius:8,paddingHorizontal:7,paddingVertical:5,fontSize:10,fontWeight:"900"},
  offerRoute:{color:"#082957",fontSize:18,fontWeight:"900",lineHeight:25,marginBottom:10},
  offerLocations:{borderTopWidth:1,borderTopColor:"#dbe4ee",paddingTop:11,
    paddingBottom:14,gap:9},
  offerLocationRow:{flexDirection:"row",alignItems:"flex-start",gap:9},
  offerLocationIcon:{fontSize:15,width:20,textAlign:"center"},
  offerLocationText:{flex:1,color:"#1b3558",fontSize:12.5,lineHeight:19},
  offerLocationLabel:{color:"#082957",fontWeight:"900"},
  offerDetailsRow:{flexDirection:"row",gap:10,alignItems:"stretch"},
  offerDetails:{flex:1,backgroundColor:"#eff6fb",borderRadius:12,padding:12,justifyContent:"center",gap:8},
  offerDivider:{height:1,backgroundColor:"#d5e2ed"},
  offerDetail:{fontSize:11.5,color:"#536b86",lineHeight:18},
  offerAxleTitle:{fontSize:11.2,fontWeight:"900",color:"#082957",lineHeight:17},
  offerAxleList:{flexDirection:"row",flexWrap:"wrap",gap:4},
  offerAxleChip:{minWidth:26,flexGrow:1,maxWidth:36,backgroundColor:"#fff",
    borderRadius:7,borderWidth:1,borderColor:"#dae5f0",overflow:"hidden",alignItems:"center"},
  offerAxleChipTitle:{backgroundColor:"#113966",color:"#fff",fontSize:10,
    fontWeight:"900",textAlign:"center",width:"100%",paddingVertical:4},
  offerAxleStatus:{fontSize:10,fontWeight:"900",textAlign:"center",
    marginVertical:4,overflow:"hidden",borderRadius:10,paddingHorizontal:6},
  offerAxleYes:{color:"#087d3b",backgroundColor:"#d9f7e5"},
  offerAxleNo:{color:"#b42336",backgroundColor:"#fee5e9"},
  offerAxleUnknown:{color:"#65758b",backgroundColor:"#edf1f5"},
  offerValue:{fontWeight:"900",color:"#082957"},
  offerAmountCard:{flex:1.1,backgroundColor:"#e7f0fc",borderRadius:12,paddingHorizontal:9,
    paddingVertical:14,alignItems:"center",justifyContent:"center",minHeight:100},
  offerAmountLabel:{fontSize:11,color:"#082957",fontWeight:"900",textAlign:"center",marginBottom:8},
  offerAmount:{color:"#082957",fontSize:26,fontWeight:"900",letterSpacing:-.8,
    textAlign:"center",lineHeight:32},
  offerExpiry:{fontSize:10.5,color:c.muted,marginVertical:15,lineHeight:16},
  foot:{fontSize:11,color:c.muted,lineHeight:18,marginTop:10}
});
