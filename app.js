const { createClient } = supabase;

const client = createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

async function requireUser() {
  const {
    data: { user },
    error
  } = await client.auth.getUser();

  if (error || !user) {
    location.href = "login.html";
    return null;
  }

  return user;
}

async function load() {
  const user = await requireUser();
  if (!user) return;

  // نمایش ایمیل کاربر، اگر عنصر مربوطه در HTML وجود داشته باشد
  if ($("userEmail")) {
    $("userEmail").textContent = user.email || "";
  }

  // -----------------------------
  // دریافت موجودی
  // -----------------------------
  const {
    data: balance,
    error: balanceError
  } = await client
    .from("balances")
    .select("usdt")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!balanceError && balance) {
    $("balance").textContent =
      `${Number(balance.usdt || 0).toFixed(6)} USDT`;
  } else {
    $("balance").textContent = "0.000000 USDT";
  }

  // -----------------------------
  // دریافت آدرس واریز
  // -----------------------------
  const {
    data: wallet,
    error: walletError
  } = await client
    .from("wallets")
    .select("address, network, token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!walletError && wallet) {
    $("depositAddress").textContent =
      wallet.address || "هنوز ایجاد نشده";
  } else {
    $("depositAddress").textContent =
      "هنوز ایجاد نشده";
  }

  // -----------------------------
  // دریافت واریزها
  // -----------------------------
  const {
    data: deposits
  } = await client
    .from("deposits")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // -----------------------------
  // دریافت برداشت‌ها
  // -----------------------------
  const {
    data: withdrawals
  } = await client
    .from("withdrawals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // ترکیب واریز و برداشت برای نمایش تراکنش‌ها
  const allTransactions = [];

  (deposits || []).forEach((d) => {
    allTransactions.push({
      type: "واریز",
      amount: Number(d.amount || 0),
      status: d.status || "pending",
      tx_hash: d.tx_hash || "-",
      created_at: d.created_at
    });
  });

  (withdrawals || []).forEach((w) => {
    allTransactions.push({
      type: "برداشت",
      amount: Number(w.amount || 0),
      status: w.status || "pending",
      tx_hash: w.tx_hash || "-",
      created_at: w.created_at
    });
  });

  allTransactions.sort(
    (a, b) =>
      new Date(b.created_at) -
      new Date(a.created_at)
  );

  if ($("transactions")) {
    $("transactions").innerHTML =
      allTransactions.slice(0, 50).map((t) => `
        <tr>
          <td>${t.type}</td>
          <td>${t.amount.toFixed(6)} USDT</td>
          <td class="status">${t.status}</td>
          <td>${t.tx_hash}</td>
          <td>${new Date(t.created_at).toLocaleString("fa-AF")}</td>
        </tr>
      `).join("");
  }
}

// -----------------------------
// خروج از حساب
// -----------------------------
if ($("logout")) {
  $("logout").onclick = async () => {
    await client.auth.signOut();
    location.href = "login.html";
  };
}

// -----------------------------
// تازه‌سازی
// -----------------------------
if ($("refresh")) {
  $("refresh").onclick = load;
}

// -----------------------------
// کپی آدرس
// -----------------------------
if ($("copyAddress")) {
  $("copyAddress").onclick = async () => {

    const address =
      $("depositAddress").textContent.trim();

    if (
      !address ||
      address === "هنوز ایجاد نشده"
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(address);

      $("copyAddress").textContent = "کپی شد";

      setTimeout(() => {
        $("copyAddress").textContent = "کپی آدرس";
      }, 1500);

    } catch (e) {
      alert("کپی آدرس انجام نشد");
    }
  };
}

// -----------------------------
// درخواست برداشت
// -----------------------------
if ($("withdrawBtn")) {

  $("withdrawBtn").onclick = async () => {

    $("withdrawMsg").textContent =
      "در حال ثبت درخواست...";

    const amount =
      Number($("withdrawAmount").value);

    const address =
      $("withdrawAddress").value.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      $("withdrawMsg").textContent =
        "مقدار برداشت صحیح نیست";
      return;
    }

    if (!address) {
      $("withdrawMsg").textContent =
        "آدرس TRON را وارد کنید";
      return;
    }

    const {
      data,
      error
    } = await client.functions.invoke(
      "request-withdrawal",
      {
        body: {
          amount,
          address
        }
      }
    );

    if (error) {
      $("withdrawMsg").textContent =
        error.message || "خطا در ثبت درخواست";
      return;
    }

    $("withdrawMsg").textContent =
      data?.message ||
      "درخواست برداشت ثبت شد";

    $("withdrawAmount").value = "";
    $("withdrawAddress").value = "";

    await load();
  };
}

// شروع
load();
