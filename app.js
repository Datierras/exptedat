import { firebaseConfig } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, limit } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const $ = s=>document.querySelector(s);
const $$ = s=>Array.from(document.querySelectorAll(s));
const showEl = el=> el&&el.classList.remove('hidden');
const hideEl = el=> el&&el.classList.add('hidden');

const loginScreen = $('#loginScreen');
const appRoot     = $('#appRoot');
const loginEmail  = $('#loginEmail');
const loginPass   = $('#loginPass');
const btnLogin    = $('#btnLogin');
const loginMsg    = $('#loginMsg');
const btnLogout   = $('#btnLogout');
const btnConfig   = $('#btnConfig');
const tabBtnCarga = $('#tabBtnCarga');
const tabBtnBusqueda = $('#tabBtnBusqueda');
const panelCarga = $('#panelCarga');
const panelBusqueda = $('#panelBusqueda');
const btnGenerarCodigo = $('#btnGenerarCodigo');
const btnEscaner = $('#btnEscaner');
const btnGuardar = $('#btnGuardar');
const msgGuardar = $('#msgGuardar');
const etiquetaBox = $('#etiquetaBox');
const barcodeSvg  = $('#barcode');
const btnImprimirEtiqueta = $('#btnImprimirEtiqueta');
const btnPdfEtiqueta = $('#btnPdfEtiqueta');

const inCodigo=$('#inCodigo'), inNumero=$('#inNumero'), inLetra=$('#inLetra'), inAnio=$('#inAnio'), inExtracto=$('#inExtracto');
const inCirc=$('#inCirc'), inSec=$('#inSec'), inChacra=$('#inChacra'), inLch=$('#inLch');
const inQuinta=$('#inQuinta'), inLq=$('#inLq'), inFraccion=$('#inFraccion'), inLf=$('#inLf');
const inManzana=$('#inManzana'), inLm=$('#inLm'), inParcela=$('#inParcela'), inLp=$('#inLp');
const inProv=$('#inProv'), inMun=$('#inMun');

const bId=$('#bId'), bExtracto=$('#bExtracto'), bArea=$('#bArea');
const btnBuscar=$('#btnBuscar'), btnLimpiar=$('#btnLimpiar'), resultados=$('#resultados');

const modalConfig=$('#modalConfig'), confApodo=$('#confApodo'), btnGuardarApodo=$('#btnGuardarApodo'), msgApodo=$('#msgApodo');
const modalEscaner=$('#modalEscaner'), selCamaras=$('#selCamaras'), previewVideo=$('#previewVideo'), msgEscaner=$('#msgEscaner');

let currentUser=null, currentApodo='', codeReader=null, currentDeviceId=null, stream=null, decodeCancel=null;

function setActiveTab(tab){ if(tab==='carga'){ tabBtnCarga.classList.add('active'); tabBtnBusqueda.classList.remove('active'); hideEl(panelBusqueda); showEl(panelCarga);} else { tabBtnBusqueda.classList.add('active'); tabBtnCarga.classList.remove('active'); hideEl(panelCarga); showEl(panelBusqueda);}}
tabBtnCarga.addEventListener('click', ()=> setActiveTab('carga'));
tabBtnBusqueda.addEventListener('click', ()=> setActiveTab('busqueda'));

btnConfig.addEventListener('click', ()=> showEl(modalConfig));
$$('[data-close-modal]').forEach(b=> b.addEventListener('click', e=>{ const id=e.currentTarget.getAttribute('data-close-modal'); const el=document.getElementById(id); hideEl(el); if(id==='modalEscaner') stopScanner(); }));
[modalConfig, modalEscaner].forEach(m=> m.addEventListener('click', e=>{ if(e.target.classList.contains('backdrop')){ hideEl(m); if(m===modalEscaner) stopScanner(); }}));

onAuthStateChanged(auth, async (user)=>{
  if(user){ currentUser=user; hideEl(loginScreen); showEl(appRoot); setActiveTab('carga'); await loadApodo(user.uid); }
  else { currentUser=null; showEl(loginScreen); hideEl(appRoot); hideEl(modalConfig); hideEl(modalEscaner); stopScanner(); }
});

btnLogin.addEventListener('click', async ()=>{
  loginMsg.textContent='';
  try{ await signInWithEmailAndPassword(auth, (loginEmail.value||'').trim(), loginPass.value||''); }
  catch(e){
    console.error(e); let msg='No se pudo iniciar sesión.'; const map={"auth/invalid-email":"Email inválido.","auth/missing-password":"Falta la contraseña.","auth/invalid-credential":"Usuario o contraseña incorrectos.","auth/user-not-found":"Usuario no encontrado.","auth/wrong-password":"Contraseña incorrecta.","auth/too-many-requests":"Demasiados intentos. Esperá unos minutos.","auth/operation-not-allowed":"Proveedor Email/Password deshabilitado.","auth/unauthorized-domain":"Agregá tu dominio de GitHub Pages en Auth > Settings > Authorized domains."}; if(e&&e.code) msg=map[e.code]||e.message||msg; loginMsg.textContent=msg;
  }
});
btnLogout.addEventListener('click', ()=> signOut(auth));

async function loadApodo(uid){ try{ const snap=await getDoc(doc(db,'usuarios',uid)); currentApodo=snap.exists()? (snap.data().apodo||''):''; confApodo.value=currentApodo||''; }catch(e){ console.warn('loadApodo',e);} }
btnGuardarApodo.addEventListener('click', async ()=>{ msgApodo.textContent=''; try{ if(!currentUser) throw new Error('No autenticado'); const apodo=(confApodo.value||'').trim(); await setDoc(doc(db,'usuarios',currentUser.uid), {apodo}, {merge:true}); currentApodo=apodo; msgApodo.textContent='Guardado'; msgApodo.classList.add('ok'); setTimeout(()=> msgApodo.textContent='', 1500);} catch(e){ msgApodo.textContent=e.message||'Error al guardar'; }});

btnGuardar.addEventListener('click', async ()=>{
  msgGuardar.textContent='';
  try{ if(!currentUser) throw new Error('No autenticado'); const d=readExpedienteForm(); d.autor=currentApodo||currentUser.email; d.createdAt=new Date().toISOString(); await addDoc(collection(db,'expedientes'), d); msgGuardar.textContent='Expediente guardado'; msgGuardar.classList.add('ok'); setTimeout(()=> msgGuardar.textContent='', 2000);} catch(e){ console.error(e); msgGuardar.textContent=e.message||'No se pudo guardar'; }
});

function readExpedienteForm(){ return { codigo:val(inCodigo), numero:val(inNumero), letra:val(inLetra).toUpperCase(), anio:val(inAnio), extracto:val(inExtracto), nomen:{ circ:val(inCirc), sec:val(inSec), chacra:val(inChacra), lch:val(inLch), quinta:val(inQuinta), lq:val(inLq), fraccion:val(inFraccion), lf:val(inLf), manzana:val(inManzana), lm:val(inLm), parcela:val(inParcela), lp:val(inLp)}, partidas:{ prov:val(inProv), mun:val(inMun)}}}
function val(i){ return (i.value||'').trim(); }

function buildEtiquetaString(){ const c=val(inCodigo), n=val(inNumero), l=(val(inLetra)||'').toUpperCase(), a=val(inAnio); return [c,n,l,a].filter(Boolean).join('-'); }

btnGenerarCodigo.addEventListener('click', ()=>{ const v=buildEtiquetaString(); if(!v){ etiquetaBox.classList.add('hidden'); return;} try{ window.JsBarcode(barcodeSvg, v, {format:'CODE128', lineColor:'#111827', width:2, height:80, displayValue:true}); etiquetaBox.classList.remove('hidden'); }catch{ etiquetaBox.classList.add('hidden'); } });
btnImprimirEtiqueta.addEventListener('click', ()=>{ const w=window.open('','_blank'); w.document.write('<html><head><title>Etiqueta</title></head><body>'+barcodeSvg.outerHTML+'</body></html>'); w.document.close(); w.focus(); w.print(); w.close(); });
btnPdfEtiqueta.addEventListener('click', ()=>{ const { jsPDF }=window.jspdf; const pdf=new jsPDF({unit:'pt', format:'a6'}); const v=buildEtiquetaString()||'SIN-DATO'; pdf.setFont('helvetica','bold'); pdf.setFontSize(16); pdf.text('Etiqueta de Expediente',24,28); pdf.setFont('helvetica','normal'); pdf.setFontSize(12); pdf.text(v,24,52); pdf.save('etiqueta-'+v+'.pdf'); });

btnBuscar.addEventListener('click', async ()=>{
  resultados.innerHTML='';
  try{
    const f=[];
    if(val(bId)){ const p=val(bId).split('-'); if(p[0]) f.push(where('codigo','==',p[0])); if(p[1]) f.push(where('numero','==',p[1])); if(p[2]) f.push(where('letra','==',p[2].toUpperCase())); if(p[3]) f.push(where('anio','==',p[3])); }
    else { if(val(bExtracto)) f.push(where('extracto','==',val(bExtracto))); if(val(bArea)) f.push(where('partidas.mun','==',val(bArea))); }
    const q = f.length? query(collection(db,'expedientes'), ...f, limit(25)) : query(collection(db,'expedientes'), limit(25));
    const snap = await getDocs(q);
    if(snap.empty){ resultados.innerHTML='<div class="muted">Sin resultados</div>'; return; }
    snap.forEach(s=>{
      const d=s.data(); const id=[d.codigo,d.numero,d.letra,d.anio].filter(Boolean).join('-');
      const div=document.createElement('div'); div.className='result-item';
      div.innerHTML = '<div class="meta">'+esc(id)+'</div><div class="title">'+esc(d.extracto||'(sin extracto)')+'</div><div class="muted">Autor: '+esc(d.autor||'-')+' — Prov: '+esc((d.partidas&&d.partidas.prov)||'-')+' — Mun: '+esc((d.partidas&&d.partidas.mun)||'-')+'</div>';
      resultados.appendChild(div);
    });
  }catch(e){ console.error(e); resultados.innerHTML='<div class="msg">Error en la búsqueda</div>'; }
});
btnLimpiar.addEventListener('click', ()=>{ [bId,bExtracto,bArea].forEach(i=> i.value=''); resultados.innerHTML=''; });

async function getZXingReaderClass(){ if(!window.__ZXingReaderClass){ const m=await import('https://cdn.jsdelivr.net/npm/@zxing/browser@latest/+esm'); window.__ZXingReaderClass=m.BrowserMultiFormatReader; } return window.__ZXingReaderClass; }
async function listCameras(){ const ds=await navigator.mediaDevices.enumerateDevices(); const cams=ds.filter(d=> d.kind==='videoinput'); selCamaras.innerHTML=''; cams.forEach((d,i)=>{ const opt=document.createElement('option'); opt.value=d.deviceId; opt.textContent=d.label||('Cámara '+(i+1)); selCamaras.appendChild(opt); }); if(cams[0]) currentDeviceId=cams[0].deviceId; }
async function playStream(deviceId){ if(stream){ stream.getTracks().forEach(t=> t.stop()); stream=null; } stream=await navigator.mediaDevices.getUserMedia({video:{deviceId: deviceId? {exact:deviceId}: undefined}}); previewVideo.srcObject=stream; await previewVideo.play(); }
async function startDecoding(deviceId){ const RC=await getZXingReaderClass(); const r=new RC(); codeReader=r; decodeCancel=r.decodeFromVideoDevice(deviceId||null, previewVideo, (res, err)=>{ if(res){ msgEscaner.textContent='Leído: '+res.getText(); const txt=res.getText(); const m=txt.match(/^([^-]+)-([^-]+)-([^-]+)-([^-]+)$/); if(m){ inCodigo.value=m[1]; inNumero.value=m[2]; inLetra.value=m[3]; inAnio.value=m[4]; } } }); }
function stopScanner(){ try{ if(decodeCancel) decodeCancel(); }catch{} try{ if(stream){ stream.getTracks().forEach(t=> t.stop()); stream=null;} }catch{} try{ if(codeReader){ codeReader.reset(); codeReader=null;} }catch{} msgEscaner.textContent=''; }

btnEscaner.addEventListener('click', async ()=>{
  showEl(modalEscaner); msgEscaner.textContent='';
  try{ await listCameras(); selCamaras.onchange= async e=>{ currentDeviceId=e.target.value; await playStream(currentDeviceId); }; await playStream(currentDeviceId); await startDecoding(currentDeviceId); } catch(e){ msgEscaner.textContent='No se pudo iniciar la cámara.'; }
});

setActiveTab('carga');

function esc(s=''){ return s.replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
