const { createClient } = supabase;
const client = createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_PUBLISHABLE_KEY);

const $ = id => document.getElementById(id);

async function requireUser(){
  const {data:{user}} = await client.auth.getUser();
  if(!user){ location.href = "login.html"; return null; }
  return user;
}

async function load(){
  const user = await requireUser();
  if(!user) return;

  const {data: wallet} = await client.from("wallets").select("balance_usdt,deposit_address").eq("user_id",user.id).maybeSingle();
  if(wallet){
    $("balance").textContent = `${Number(wallet.balance_usdt||0).toFixed(6)} USDT`;
    $("depositAddress").textContent = wallet.deposit_address || "هنوز ایجاد نشده";
  }

  const {data: txs} = await client.from("transactions").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);
  $("transactions").innerHTML = (txs||[]).map(t=>`
    <tr><td>${t.type}</td><td>${Number(t.amount).toFixed(6)} USDT</td>
    <td class="status">${t.status}</td><td>${t.tx_hash||"-"}</td>
    <td>${new Date(t.created_at).toLocaleString("fa-AF")}</td></tr>`).join("");

  if(!wallet?.deposit_address){
    const {data,error} = await client.functions.invoke("create-deposit-address");
    if(!error && data?.address) $("depositAddress").textContent = data.address;
  }
}

$("logout").onclick = async()=>{await client.auth.signOut(); location.href="login.html"};
$("refresh").onclick = load;
$("copyAddress").onclick = async()=>{await navigator.clipboard.writeText($("depositAddress").textContent); $("copyAddress").textContent="کپی شد";};

$("withdrawBtn").onclick = async()=>{
  $("withdrawMsg").textContent = "در حال ثبت...";
  const amount = Number($("withdrawAmount").value);
  const address = $("withdrawAddress").value.trim();
  const {data,error}=await client.functions.invoke("request-withdrawal",{body:{amount,address}});
  $("withdrawMsg").textContent = error ? (error.message||"خطا") : `درخواست ثبت شد: ${data.withdrawal_id}`;
  if(!error){ $("withdrawAmount").value=""; $("withdrawAddress").value=""; load(); }
};

load();
