/***********************
 * English Practice Partner
 * Webhook + Telegram Stars
 * Render FREE compatible
 ************************/

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ---------- CONFIG ---------- */
const TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.RENDER_EXTERNAL_URL; // Render auto provides
const PORT = process.env.PORT || 3000;

/* ---------- BOT ---------- */
const bot = new TelegramBot(TOKEN);
const app = express();
app.use(express.json());

/* ---------- WEBHOOK ---------- */
bot.setWebHook(`${APP_URL}/bot${TOKEN}`);

app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("English Practice Partner Bot is running");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

/* ---------- DATABASE ---------- */
let users = fs.existsSync("users.json")
  ? JSON.parse(fs.readFileSync("users.json"))
  : {};

function saveUsers() {
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
}

function isPremium(id) {
  return users[id]?.premiumUntil && users[id].premiumUntil > Date.now();
}

function activatePremium(id) {
  users[id].premiumUntil = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  users[id].freeCount = 0;
  saveUsers();
}

async function checkGrammar(sentence, isPremium) {
  const systemPrompt = isPremium
    ? "You are an English teacher. Correct the sentence and explain the grammar clearly."
    : "Correct the English sentence only. No explanation.";

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: sentence }
    ],
    temperature: 0.2
  });

  return response.choices[0].message.content;
}


/* ---------- COMMANDS ---------- */

// START
bot.onText(/\/start/, (msg) => {
  const id = msg.from.id;
  if (!users[id]) {
    users[id] = { freeCount: 0, premiumUntil: 0 };
    saveUsers();
  }

  bot.sendMessage(
    id,
`👋 Welcome to *English Practice Partner*

🆓 Free: 3 practices/day  
⭐ Premium: Unlimited + Explanation  

Commands:
/practice – Practice sentence
/chat – Conversation (Premium)
/upgrade – Buy Premium ⭐
/status – Check account`,
    { parse_mode: "Markdown" }
  );
});

// PRACTICE
bot.onText(/\/practice/, (msg) => {
  const id = msg.from.id;

  if (!isPremium(id) && users[id].freeCount >= 3) {
    return bot.sendMessage(
      id,
      "❌ Daily free limit reached.\nUpgrade to continue ➜ /upgrade"
    );
  }

  bot.sendMessage(id, "✍️ Send your English sentence:");

  bot.once("message", (m) => {
    if (!m.text || m.text.startsWith("/")) return;

    let corrected = m.text; // placeholder
    let reply = `✅ *Corrected:*\n${corrected}`;

    if (isPremium(id)) {
      reply += `\n\n📘 *Explanation:*\nThe sentence has been corrected for grammar and tense.`;
    } else {
      users[id].freeCount += 1;
      saveUsers();
    }

    bot.sendMessage(id, reply, { parse_mode: "Markdown" });
  });
});

// CHAT
bot.onText(/\/chat/, (msg) => {
  const id = msg.from.id;
  if (!isPremium(id)) {
    return bot.sendMessage(id, "⭐ Chat mode is premium.\nUse /upgrade");
  }
  bot.sendMessage(id, "🗣️ Chat mode active. Start chatting in English!");
});

// STATUS
bot.onText(/\/status/, (msg) => {
  const id = msg.from.id;
  if (isPremium(id)) {
    bot.sendMessage(id, "⭐ Premium active\n⏳ Valid for 7 days");
  } else {
    bot.sendMessage(id, "🆓 Free user\nUpgrade ➜ /upgrade");
  }
});

/* ---------- TELEGRAM STARS PAYMENT ---------- */

// UPGRADE
bot.onText(/\/upgrade/, (msg) => {
  bot.sendInvoice(
    msg.chat.id,
    "English Practice Partner – Premium",
    "Unlimited practice, explanations & chat for 7 days",
    "premium_7_days",
    "",           // provider_token EMPTY for Stars
    "XTR",        // Telegram Stars currency
    [
      { label: "Premium (7 days)", amount: 10 }
    ]
  );
});

// REQUIRED
bot.on("pre_checkout_query", (q) => {
  bot.answerPreCheckoutQuery(q.id, true);
});

// PAYMENT SUCCESS
bot.on("successful_payment", (msg) => {
  const id = msg.from.id;

  if (!users[id]) {
    users[id] = { freeCount: 0, premiumUntil: 0 };
  }

  activatePremium(id);

  bot.sendMessage(
    msg.chat.id,
    "✅ Payment successful!\n⭐ Premium activated for 7 days 🎉"
  );
});
