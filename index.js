const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const express = require("express");

bot.onText(/\/upgrade/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendInvoice(
    chatId,
    "English Practice Partner – Premium",
    "Unlimited practice, explanations & chat for 7 days",
    "premium_7_days",              // payload
    "",                             // provider_token EMPTY for Stars
    "XTR",                          // currency for Telegram Stars
    [
      { label: "Premium (7 days)", amount: 10 } // 10 Stars
    ]
  );
});

bot.on("pre_checkout_query", (query) => {
  bot.answerPreCheckoutQuery(query.id, true);
});

bot.on("successful_payment", (msg) => {
  const userId = msg.from.id;

  if (!users[userId]) {
    users[userId] = { freeCount: 0, premiumUntil: 0 };
  }

  users[userId].premiumUntil = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  users[userId].freeCount = 0;
  saveUsers();

  bot.sendMessage(
    msg.chat.id,
    "✅ Payment successful!\n⭐ Premium activated for 7 days 🎉"
  );
});


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
  users[id].premiumUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
  users[id].freeCount = 0;
  saveUsers();
}

/* -------------------- COMMANDS -------------------- */

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
/upgrade – Buy Premium ⭐`,
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
    let reply = `✅ Corrected:\n${corrected}`;

    if (isPremium(id)) {
      reply += `\n\n📘 Explanation:\nThe sentence has been corrected for proper grammar and tense.`;
    } else {
      users[id].freeCount += 1;
      saveUsers();
    }

    bot.sendMessage(id, reply);
  });
});

// CHAT
bot.onText(/\/chat/, (msg) => {
  const id = msg.from.id;
  if (!isPremium(id)) {
    return bot.sendMessage(id, "⭐ Chat mode is premium.\nUse /upgrade");
  }
  bot.sendMessage(id, "🗣️ Chat mode activated. Start chatting in English!");
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

/* -------------------- UPGRADE (STARS) -------------------- */

bot.onText(/\/upgrade/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`⭐ *Premium Plan*

• Unlimited practice
• Full grammar explanation
• Conversation mode

💰 Price: *10 Stars / 7 days*
⚠️ Stars are non-refundable.`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "⭐ Upgrade for 10 Stars", pay: true }]
        ]
      }
    }
  );
});

// REQUIRED FOR PAYMENT
bot.on("pre_checkout_query", (query) => {
  bot.answerPreCheckoutQuery(query.id, true);
});

// PAYMENT SUCCESS
bot.on("successful_payment", (msg) => {
  const id = msg.from.id;
  addPremium(id);

  bot.sendMessage(
    msg.chat.id,
    "✅ Payment successful!\n⭐ Premium activated for 7 days 🎉"
  );
});

/* -------------------- DUMMY HTTP SERVER (RENDER) -------------------- */

const app = express();

app.get("/", (req, res) => {
  res.send("English Practice Partner Bot is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("HTTP server running on port " + PORT);
});
