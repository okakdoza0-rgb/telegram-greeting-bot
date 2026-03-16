const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

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

bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (!msg.text) return;

  // команда создать приветствие
  if (msg.text.toLowerCase() === 'create greeting') {
    waitingGreeting[chatId] = true;
    bot.sendMessage(chatId, "Напишите приветствие для новых участников.\n\nМожно использовать {name} для имени пользователя.");
    return;
  }

  // сохранение приветствия
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
