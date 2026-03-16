const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require('express');

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error('ERROR: BOT_TOKEN not found in environment variables');
  process.exit(1);
}

const bot = new TelegramBot(token, {
  polling: true,
});

const app = express();
const PORT = process.env.PORT || 3000;

// файл для сохранения приветствий
const GREETINGS_FILE = 'greetings.json';

// хранилище приветствий
let greetings = {};
const waitingGreeting = {};

// загрузка приветствий из файла
function loadGreetings() {
  try {
    if (fs.existsSync(GREETINGS_FILE)) {
      const data = fs.readFileSync(GREETINGS_FILE, 'utf8');
      greetings = data ? JSON.parse(data) : {};
    } else {
      greetings = {};
      fs.writeFileSync(GREETINGS_FILE, JSON.stringify({}, null, 2));
    }
  } catch (error) {
    console.error('Ошибка загрузки greetings.json:', error.message);
    greetings = {};
  }
}

// сохранение приветствий в файл
function saveGreetings() {
  try {
    fs.writeFileSync(GREETINGS_FILE, JSON.stringify(greetings, null, 2));
  } catch (error) {
    console.error('Ошибка сохранения greetings.json:', error.message);
  }
}

// проверка, админ ли пользователь
async function isUserAdmin(chatId, userId) {
  try {
    const admins = await bot.getChatAdministrators(chatId);
    return admins.some((admin) => admin.user.id === userId);
  } catch (error) {
    console.error('Ошибка проверки админа:', error.message);
    return false;
  }
}

loadGreetings();

// команда /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(
    chatId,
    'Бот работает.\n\nКоманда для установки приветствия:\ncreate greeting\n\nПотом просто отправь текст приветствия.\nМожно использовать {name}.'
  );
});

// обработка всех сообщений
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    if (!text) return;

    // чтобы не реагировал на системные сообщения
    if (msg.new_chat_members || msg.left_chat_member) return;

    // создать приветствие
    if (text.toLowerCase() === 'create greeting') {
      // только для групп
      if (msg.chat.type === 'private') {
        await bot.sendMessage(chatId, 'Эта команда работает только в группе.');
        return;
      }

      const admin = await isUserAdmin(chatId, userId);

      if (!admin) {
        await bot.sendMessage(chatId, 'Только админ может создавать приветствие.');
        return;
      }

      waitingGreeting[chatId] = userId;

      await bot.sendMessage(
        chatId,
        'Напишите приветствие для новых участников.\n\nМожно использовать {name}.\n\nПример:\nПривет {name}! Добро пожаловать в группу.'
      );
      return;
    }

    // сохранение приветствия
    if (waitingGreeting[chatId] && waitingGreeting[chatId] === userId) {
      greetings[String(chatId)] = text;
      saveGreetings();

      delete waitingGreeting[chatId];

      await bot.sendMessage(chatId, '✅ Приветствие сохранено.');
      return;
    }
  } catch (error) {
    console.error('Ошибка обработки сообщения:', error.message);
  }
});

// приветствие новых участников
bot.on('new_chat_members', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const greetingText = greetings[String(chatId)];

    if (!greetingText) return;

    for (const user of msg.new_chat_members) {
      // чтобы бот сам себя не приветствовал
      if (user.is_bot) continue;

      const name =
        user.first_name ||
        user.username ||
        'друг';

      const finalText = greetingText.replace(/\{name\}/g, name);

      await bot.sendMessage(chatId, finalText);
    }
  } catch (error) {
    console.error('Ошибка приветствия нового участника:', error.message);
  }
});

// главная страница для Render / UptimeRobot
app.get('/', (req, res) => {
  res.status(200).send('Bot is running');
});

// health route
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});

bot.on('webhook_error', (error) => {
  console.error('Webhook error:', error.message);
});
