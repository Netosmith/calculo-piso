from pathlib import Path

p = Path('assets/js/embarques.js')
s = p.read_text(encoding='utf-8')
old = 'liberacaoId:String(r.liberacaoId||""),previsaoChegada:r.previsaoChegada||""'
new = 'liberacaoId:String(r.liberacaoId||""),itinerarioNome:String(r.itinerarioNome||""),itinerarioUrl:String(r.itinerarioUrl||""),itinerarioId:String(r.itinerarioId||""),previsaoChegada:r.previsaoChegada||""'
if old not in s:
    raise SystemExit('normalize target not found')
s = s.replace(old, new, 1)
old2 = 'function formPayload(){return{id:$("mId").value,numeroCarga:up($("mNumeroCarga").value),dataCarga:$("mDataCarga").value,cliente:up($("mCliente").value),origem:up($("mOrigem").value),localOrigem:up($("mLocalOrigem").value),destino:up($("mDestino").value),localDestino:up($("mLocalDestino").value),roteiro:$("mRoteiro").value.trim(),placa:up($("mPlaca").value),tipoVeiculo:up($("mTipoVeiculo").value),tipoCarga:$("mTipoCarga").value,pesoKg:num($("mPeso").value),freteEmpresa:num($("mFreteEmpresa").value),freteMotorista:num($("mFreteMotorista").value),situacao:$("mSituacao").value,previsaoChegada:$("mPrevisao").value,observacao:$("mObservacao").value.trim()}}'
new2 = 'function formPayload(){const id=$("mId").value,current=rows.find(r=>r.id===id)||{};return{id,numeroCarga:up($("mNumeroCarga").value),dataCarga:$("mDataCarga").value,cliente:up($("mCliente").value),origem:up($("mOrigem").value),localOrigem:up($("mLocalOrigem").value),destino:up($("mDestino").value),localDestino:up($("mLocalDestino").value),roteiro:$("mRoteiro").value.trim(),placa:up($("mPlaca").value),tipoVeiculo:up($("mTipoVeiculo").value),tipoCarga:$("mTipoCarga").value,pesoKg:num($("mPeso").value),freteEmpresa:num($("mFreteEmpresa").value),freteMotorista:num($("mFreteMotorista").value),situacao:$("mSituacao").value,previsaoChegada:$("mPrevisao").value,observacao:$("mObservacao").value.trim(),comprovanteNome:current.comprovanteNome||"",comprovanteUrl:current.comprovanteUrl||"",comprovanteId:current.comprovanteId||"",liberacaoNome:current.liberacaoNome||"",liberacaoUrl:current.liberacaoUrl||"",liberacaoId:current.liberacaoId||"",itinerarioNome:current.itinerarioNome||"",itinerarioUrl:current.itinerarioUrl||"",itinerarioId:current.itinerarioId||""}}'
if old2 not in s:
    raise SystemExit('formPayload target not found')
s = s.replace(old2, new2, 1)
p.write_text(s, encoding='utf-8')

h = Path('pages/embarques.html')
t = h.read_text(encoding='utf-8')
t = t.replace('embarques.js?v=7', 'embarques.js?v=8').replace('embarques-itinerario.js?v=2', 'embarques-itinerario.js?v=3').replace('embarques-itinerario.js?v=1', 'embarques-itinerario.js?v=3')
h.write_text(t, encoding='utf-8')
