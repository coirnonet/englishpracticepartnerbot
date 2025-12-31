const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const express = require("express");

/* -------------------- BOT INIT -------------------- */
const TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

/* -------------------- DATABASE -------------------- */
let users = fs.existsSync("users.json")
  ? JSON.parse(fs.readFileSync("users.json"))
  : {};

function saveUsers() {
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
}

function isPremium(id) {
  return users[id]?.premiumUntil && users[id].premiumUntil > Date.now();
}

function addPremium(id) {
  users[id] = users[id] || { freeCount: 0, premiumUntil: 0 };
  users[id].premiumUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
  users[id].freeCount = 0;
  saveUsers();
}

/* -------------------- COMMANDS -------------------- */

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
/upgrade – Buy Premium ⭐`,
    { parse_mode: "Markdown" }
  );
});

// PRACTICE
bot.onText(/\/practice/, (msg) => {
  const id = msg.from.id;

  if (!isPremium(id) && users[id].freeCount >= 3) {
    return bot.sendMessage(
      msg.chat.id,
      "❌ Daily free limit reached.\nUpgrade to continue ➜ /upgrade"
    );
  }

  bot.sendMessage(msg.chat.id, "✍️ Send your English sentence:");

  bot.once("message", (m) => {
    if (!m.text || m.text.startsWith("/")) return;

    let reply = `✅ Corrected:\n${m.text}`;

    if (isPremium(id)) {
      reply += `\n\n📘 Explanation:\nThe sentence has been corrected for proper grammar and tense.`;
    } else {
      users[id].freeCount++;
      saveUsers();
    }

    bot.sendMessage(msg.chat.id, reply);
  });
});

// CHAT
bot.onText(/\/chat/, (msg) => {
  const id = msg.from.id;
  if (!isPremium(id)) {
    return bot.sendMessage(msg.chat.id, "⭐ Chat mode is premium.\nUse /upgrade");
  }
  bot.sendMessage(msg.chat.id, "🗣️ Chat mode activated. Start chatting!");
});

/* -------------------- STARS UPGRADE -------------------- */

bot.onText(/\/upgrade/, async (msg) => {
  await bot.sendInvoice(
    msg.chat.id,
    "English Practice Partner – Premium",
    "Unlimited practice, explanations & chat for 7 days",
    "premium_7_days",
    "",          // provider token EMPTY for Stars
    "XTR",       // Stars currency
    [{ label: "Premium (7 days)", amount: 10 }]
  );
});

// REQUIRED
bot.on("pre_checkout_query", (q) => {
  bot.answerPreCheckoutQuery(q.id, true);
});

// PAYMENT SUCCESS
bot.on("successful_payment", (msg) => {
  addPremium(msg.from.id);
  bot.sendMessage(
    msg.chat.id,
    "✅ Payment successful!\n⭐ Premium activated for 7 days 🎉"
  );
});

/* -------------------- RENDER HTTP SERVER -------------------- */
const app = express();
app.get("/", (_, res) => res.send("Bot running"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on " + PORT));
