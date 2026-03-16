const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require('express');
const https = require('https');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let greetings = {};

// загрузка приветствий
try {
  greetings = JSON.parse(fs.readFileSync('greetings.json'));
} catch {
  greetings = {};
}

const waitingGreeting = {};

// команда создать приветствие
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (!msg.text) return;

  if (msg.text.toLowerCase() === 'create greeting') {
    waitingGreeting[chatId] = true;
    bot.sendMessage(chatId, "Напишите приветствие для новых участников.\nМожно использовать {name}");
    return;
  }

  if (waitingGreeting[chatId]) {
    greetings[chatId] = msg.text;

    fs.writeFileSync(
      'greetings.json',
      JSON.stringify(greetings, null, 2)
    );

    waitingGreeting[chatId] = false;

    bot.sendMessage(chatId, "✅ Приветствие сохранено.");
  }
});

// приветствие новых участников
bot.on('new_chat_members', (msg) => {
  const chatId = msg.chat.id;

  if (!greetings[chatId]) return;

  msg.new_chat_members.forEach((user) => {
    const name = user.first_name || "друг";

    let text = greetings[chatId];

    if (text.includes("{name}")) {
      text = text.replace("{name}", name);
    }

    bot.sendMessage(chatId, text);
  });
});

/* ---------------------------
   SERVER ДЛЯ RENDER
--------------------------- */

const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server started");
});

/* ---------------------------
   СКРИПТ ЧТОБЫ БОТ НЕ СПАЛ
--------------------------- */

const url = process.env.RENDER_EXTERNAL_URL;

setInterval(() => {
  if (url) {
    https.get(url);
  }
}, 300000); // каждые 5 минут
