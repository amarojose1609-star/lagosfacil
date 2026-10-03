import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.LAGOSFACIL_CONFIG || {};
const configured = /^https:\/\/.+\.supabase\.co$/.test(config.supabaseUrl || "") && Boolean(config.supabaseAnonKey && !config.supabaseAnonKey.includes("SUA_CHAVE"));
let db;
let session;
let authMode = "login";

function addAuthModal() {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `<div class="modal-backdrop" id="accountModal"><div class="modal"><button class="close" id="accountClose">×</button><h2 id="accountTitle">Entrar no LagosFácil</h2><p id="accountIntro">Entre para anunciar um imóvel ou iniciar sua reserva.</p><form id="accountForm" class="formgrid"><div class="input full" id="accountNameWrap" style="display:none"><label>Seu nome</label><input name="full_name" autocomplete="name"></div><div class="input full"><label>E-mail</label><input name="email" type="email" autocomplete="email" required></div><div class="input full"><label>Senha</label><input name="password" type="password" minlength="8" autocomplete="current-password" required></div><button class="btn" id="accountSubmit">Entrar</button></form><button class="btn btn-light" id="accountSwitch" style="width:100%;margin-top:10px">Criar uma conta</button><p id="accountMessage" style="margin:14px 0 0;color:#657b82;font-size:12px"></p></div></div>`;
  document.body.append(wrapper.firstElementChild);
  document.getElementById("accountClose").onclick = () => closeModal("accountModal");
  document.getElementById("accountModal").addEventListener("click", e => { if (e.target.id === "accountModal") closeModal("accountModal"); });
  document.getElementById("accountSwitch").onclick = () => setAuthMode(authMode === "login" ? "signup" : "login");
  document.getElementById("accountForm").addEventListener("submit", signInOrUp);
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === "signup";
  document.getElementById("accountTitle").textContent = isSignup ? "Crie sua conta" : "Entrar no LagosFácil";
  document.getElementById("accountIntro").textContent = isSignup ? "Cadastre-se para publicar imóveis ou reservar." : "Entre para anunciar um imóvel ou iniciar sua reserva.";
  document.getElementById("accountNameWrap").style.display = isSignup ? "flex" : "none";
  document.querySelector('#accountForm [name="full_name"]').required = isSignup;
  document.getElementById("accountSubmit").textContent = isSignup ? "Criar conta" : "Entrar";
  document.getElementById("accountSwitch").textContent = isSignup ? "Já tenho uma conta" : "Criar uma conta";
  document.getElementById("accountMessage").textContent = "";
}

function openAccount(mode = "login") {
  if (!configured) return toast("Para ativar contas compartilhadas, falta configurar o projeto Supabase.");
  setAuthMode(mode);
  openModal("accountModal");
}

async function signInOrUp(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = form.get("email"), password = form.get("password");
  const message = document.getElementById("accountMessage");
  message.textContent = "Aguarde…";
  const result = authMode === "signup"
    ? await db.auth.signUp({ email, password, options: { data: { full_name: form.get("full_name") } } })
    : await db.auth.signInWithPassword({ email, password });
  if (result.error) { message.textContent = result.error.message; return; }
  if (result.data.session) {
    session = result.data.session;
    await db.from("profiles").upsert({ id: session.user.id, full_name: session.user.user_metadata.full_name || "" });
    closeModal("accountModal");
    updateAccountButton();
    toast(authMode === "signup" ? "Conta criada e conectada!" : "Você entrou na sua conta!");
  } else {
    message.textContent = "Confira seu e-mail para confirmar o cadastro e depois entre na sua conta.";
  }
}

function updateAccountButton() {
  let button = document.getElementById("accountNavButton");
  if (!button) {
    button = document.createElement("button"); button.id = "accountNavButton"; button.className = "btn btn-light small";
    document.querySelector(".top-actions").prepend(button);
  }
  button.textContent = session ? "Minha conta · Sair" : "Entrar";
  button.onclick = async () => {
    if (session) { await db.auth.signOut(); session = null; updateAccountButton(); toast("Você saiu da sua conta."); }
    else openAccount();
  };
}

async function loadProperties() {
  const { data, error } = await db.from("properties").select("id,title,city,rental_type,price_brl,bedrooms,description,contact_phone,property_photos(storage_path,sort_order)").eq("published", true).order("created_at", { ascending: false });
  if (error) { toast("Não foi possível carregar os anúncios online."); return; }
  if (!data) return;
  listings = data.map(p => {
    const imagePath = p.property_photos?.sort((a,b) => a.sort_order-b.sort_order)[0]?.storage_path;
    const image = imagePath ? db.storage.from("property-photos").getPublicUrl(imagePath).data.publicUrl : "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=85";
    return { id:p.id, name:p.title, city:p.city, type:p.rental_type, price:Number(p.price_brl), rooms:p.bedrooms, guests:p.bedrooms*2, image, desc:p.description, phone:p.contact_phone };
  });
  renderListings();
}

async function connectMercadoPago() {
  if (!session) return openAccount();
  const { data, error } = await db.functions.invoke("mp-oauth-start", { body: {} });
  if (error || !data?.url) return toast("Não foi possível iniciar a conexão com o Mercado Pago.");
  location.href = data.url;
}

async function addProperty(event) {
  event.preventDefault(); event.stopImmediatePropagation();
  if (!session) { closeModal("listingModal"); return openAccount(); }
  const form = event.currentTarget, f = new FormData(form), button = form.querySelector('button[type="submit"]');
  button.disabled = true; button.textContent = "Salvando…";
  let contactPhone=String(f.get("phone")).replace(/\D/g,"");
  if (contactPhone.length===10 || contactPhone.length===11) contactPhone=`55${contactPhone}`;
  if (contactPhone.length<12 || contactPhone.length>13) { toast("Informe um WhatsApp com DDD.");button.disabled=false;button.textContent="Salvar anúncio";return; }
  const { data: property, error } = await db.from("properties").insert({ owner_id:session.user.id, title:f.get("name"), city:f.get("city"), rental_type:f.get("type"), price_brl:Number(f.get("price")), bedrooms:Number(f.get("rooms")), contact_phone:contactPhone, description:"" , published:true }).select("id").single();
  if (error) { toast("Não foi possível salvar o anúncio. Confira os dados e tente novamente."); button.disabled=false;button.textContent="Salvar anúncio";return; }
  const photo = f.get("image");
  if (photo instanceof File && photo.size) {
    if (!photo.type.startsWith("image/") || photo.size > 5*1024*1024) { toast("A foto precisa ser JPG, PNG ou WebP e ter até 5 MB."); await db.from("properties").delete().eq("id",property.id); button.disabled=false;button.textContent="Salvar anúncio";return; }
    const path = `${session.user.id}/${property.id}/${crypto.randomUUID()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const uploaded = await db.storage.from("property-photos").upload(path,photo,{upsert:false,contentType:photo.type});
    if (!uploaded.error) await db.from("property_photos").insert({property_id:property.id,storage_path:path,sort_order:0});
  }
  document.getElementById("listingFormWrap").style.display="none";
  document.getElementById("listingSuccess").style.display="block";
  await loadProperties(); button.disabled=false;button.textContent="Salvar anúncio";
}

async function beginBooking(id) {
  if (!session) return openAccount();
  const checkIn=document.getElementById("bookingCheckIn")?.value, checkOut=document.getElementById("bookingCheckOut")?.value;
  if (!checkIn || !checkOut) return toast("Escolha as datas de entrada e saída.");
  const { data, error } = await db.functions.invoke("create-booking", { body:{propertyId:id,checkIn,checkOut} });
  if (error || !data?.checkoutUrl) return toast(data?.error || "Não foi possível abrir o pagamento.");
  location.href=data.checkoutUrl;
}

function activateAccountFeatures() {
  updateAccountButton();
  document.querySelector('#listingForm [name="image"]').type = "file";
  document.querySelector('#listingForm [name="image"]').accept = "image/jpeg,image/png,image/webp";
  document.querySelector('#listingForm [name="image"]').previousElementSibling.textContent = "Foto do imóvel (JPG, PNG ou WebP, até 5 MB)";
  document.querySelector('#listingForm [name="phone"]').required = true;
  document.querySelector('#listingForm [name="phone"]').previousElementSibling.textContent = "Seu WhatsApp com DDD (será exibido no anúncio)";
  document.querySelector('#listingForm .note').textContent = "ℹ️ Seu número de WhatsApp ficará visível no anúncio para interessados. As fotos são públicas para que os clientes possam visualizar o imóvel.";
  document.getElementById("listingForm").addEventListener("submit",addProperty,true);
  const oldSuccess=document.querySelector("#listingSuccess p");
  oldSuccess.textContent="Seu anúncio foi salvo. Adicione fotos nítidas e mantenha valores e disponibilidade atualizados.";
  const accountParam=new URLSearchParams(location.search).get("mp");
  if(accountParam==="conectado") toast("Conta Mercado Pago conectada com sucesso!");
  if(accountParam==="erro") toast("Não foi possível conectar ao Mercado Pago. Tente novamente.");
  if(accountParam) history.replaceState({},"",location.pathname+location.hash);
  db.auth.getSession().then(({data})=>{session=data.session;updateAccountButton();});
  db.auth.onAuthStateChange((_event,newSession)=>{session=newSession;updateAccountButton();});
}

const originalShowDetail=window.showDetail;
window.showDetail=function(id) {
  originalShowDetail(id);
  const x=listings.find(i=>i.id===id);
  const detail=document.getElementById("detailContent");
  if (!x || !configured) return;
  if (x.type === "Fixo") {
    const contact=detail.querySelector("button.btn");
    if (x.phone) {
      contact.textContent="Conversar pelo WhatsApp";
      contact.onclick=()=>window.open(`https://wa.me/${String(x.phone).replace(/\D/g,"")}?text=${encodeURIComponent(`Olá! Tenho interesse no imóvel ${x.name} anunciado no LagosFácil.`)}`,"_blank","noopener");
    } else { contact.textContent="Contato do anfitrião indisponível";contact.disabled=true; }
    return;
  }
  const dateFields=document.createElement("div");
  dateFields.className="formgrid"; dateFields.style.marginTop="14px";
  dateFields.innerHTML=`<div class="input"><label>Entrada</label><input id="bookingCheckIn" type="date" min="${new Date().toISOString().slice(0,10)}" required></div><div class="input"><label>Saída</label><input id="bookingCheckOut" type="date" min="${new Date(Date.now()+86400000).toISOString().slice(0,10)}" required></div>`;
  const payButton=detail.querySelector("button.btn");
  payButton.textContent="Reservar e ir para pagamento"; payButton.onclick=()=>beginBooking(id);
  detail.insertBefore(dateFields,payButton);
};

addAuthModal();
const existingOpenModal=window.openModal;
window.openModal=function(id) {
  if(id==="listingModal") {
    document.getElementById("listingFormWrap").style.display="block";
    document.getElementById("listingSuccess").style.display="none";
  }
  existingOpenModal(id);
};
if (!configured) {
  updateAccountButton();
} else {
  db=createClient(config.supabaseUrl,config.supabaseAnonKey);
  activateAccountFeatures();
  loadProperties();
}
