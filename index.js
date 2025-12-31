/***********************
 * English Practice Partner
 * Webhook + Telegram Stars
 * Render FREE compatible
 * AI Grammar (OpenAI)
 ************************/

const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const fs = require("fs");
const OpenAI = require("openai");

/* ---------- OPENAI ---------- */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ---------- CONFIG ---------- */
const TOKEN = process.env.BOT_TOKEN;
const APP_URL = process.env.RENDER_EXTERNAL_URL;
const PORT = process.env.PORT || 3000;

/* ---------- BOT & SERVER ---------- */
const bot = new TelegramBot(TOKEN);
const app = express();
app.use(express.json());

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
  users[id] = users[id] || { freeCount: 0, premiumUntil: 0 };
  users[id].premiumUntil = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  users[id].freeCount = 0;
  saveUsers();
}

/* ---------- AI GRAMMAR ---------- */
async function checkGrammar(sentence, premium) {
  const systemPrompt = premium
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
  users[id] = users[id] || { freeCount: 0, premiumUntil: 0 };
  saveUsers();

  bot.sendMessage(
    msg.chat.id,
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

// PRACTICE (AI)
bot.onText(/\/practice/, (msg) => {
  const id = msg.from.id;

  if (!isPremium(id) && users[id].freeCount >= 3) {
    return bot.sendMessage(
      msg.chat.id,
      "❌ Daily free limit reached.\nUpgrade to continue ➜ /upgrade"
    );
  }

  bot.sendMessage(msg.chat.id, "✍️ Send your English sentence:");

  bot.once("message", async (m) => {
    if (!m.text || m.text.startsWith("/")) return;

    const aiReply = await checkGrammar(m.text, isPremium(id));

    let reply = isPremium(id)
      ? `✅ *Corrected + Explanation:*\n${aiReply}`
      : `✅ *Corrected:*\n${aiReply}`;

    if (!isPremium(id)) {
      users[id].freeCount += 1;
      saveUsers();
    }

    bot.sendMessage(msg.chat.id, reply, { parse_mode: "Markdown" });
  });
});

// CHAT
bot.onText(/\/chat/, (msg) => {
  const id = msg.from.id;
  if (!isPremium(id)) {
    return bot.sendMessage(msg.chat.id, "⭐ Chat mode is premium.\nUse /upgrade");
  }
  bot.sendMessage(msg.chat.id, "🗣️ Chat mode active. Start chatting in English!");
});

// STATUS
bot.onText(/\/status/, (msg) => {
  const id = msg.from.id;
  if (isPremium(id)) {
    bot.sendMessage(msg.chat.id, "⭐ Premium active\n⏳ Valid for 7 days");
  } else {
    bot.sendMessage(msg.chat.id, "🆓 Free user\nUpgrade ➜ /upgrade");
  }
});

/* ---------- TELEGRAM STARS PAYMENT ---------- */

bot.onText(/\/upgrade/, (msg) => {
  bot.sendInvoice(
    msg.chat.id,
    "English Practice Partner – Premium",
    "Unlimited practice, explanations & chat for 7 days",
    "premium_7_days",
    "",        // provider token EMPTY for Stars
    "XTR",     // Telegram Stars currency
    [{ label: "Premium (7 days)", amount: 10 }]
  );
});

bot.on("pre_checkout_query", (q) => {
  bot.answerPreCheckoutQuery(q.id, true);
});

bot.on("successful_payment", (msg) => {
  activatePremium(msg.from.id);
  bot.sendMessage(
    msg.chat.id,
    "✅ Payment successful!\n⭐ Premium activated for 7 days 🎉"
  );
});
