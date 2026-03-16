const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let greetings = {};

try {
  greetings = JSON.parse(fs.readFileSync('greetings.json'));
} catch {
  greetings = {};
}

const waitingGreeting = {};

bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (msg.text === 'create greeting') {
    waitingGreeting[chatId] = true;
    bot.sendMessage(chatId, "What greeting message do you want to set?");
    return;
  }

  if (waitingGreeting[chatId]) {
    greetings[chatId] = msg.text;
    fs.writeFileSync('greetings.json', JSON.stringify(greetings));
    waitingGreeting[chatId] = false;

    bot.sendMessage(chatId, "Greeting saved.");
  }
});

bot.on('new_chat_members', (msg) => {
  const chatId = msg.chat.id;

  if (!greetings[chatId]) return;

  msg.new_chat_members.forEach((user) => {
    const name = user.first_name;
    const text = greetings[chatId].replace("{name}", name);

    bot.sendMessage(chatId, text);
  });
});
