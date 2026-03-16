const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require('express');

const token = process.env.BOT_TOKEN;
const OWNER_ID = 7837011810;
const GREETINGS_FILE = 'greetings.json';

if (!token) {
  console.error('ERROR: BOT_TOKEN not found');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const app = express();

let greetings = {};

// загрузка приветствий
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

// сохранение приветствий
function saveGreetings() {
  try {
    fs.writeFileSync(GREETINGS_FILE, JSON.stringify(greetings, null, 2));
  } catch (error) {
    console.error('Ошибка сохранения greetings.json:', error.message);
  }
}

// проверка прав
async function canManageBot(chatId, userId) {
  // ты можешь всегда
  if (userId === OWNER_ID) return true;

  try {
    const admins = await bot.getChatAdministrators(chatId);
    return admins.some((admin) => admin.user.id === userId);
  } catch (error) {
    console.error('Ошибка проверки админа:', error.message);
    return false;
  }
}

loadGreetings();

bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    if (!text) return;
    if (msg.chat.type === 'private') return;

    // create greeting
    if (text.toLowerCase() === 'create greeting') {
      const allowed = await canManageBot(chatId, userId);

      if (!allowed) {
        await bot.sendMessage(chatId, '❌ Только админы могут управлять ботом.');
        return;
      }

      greetings[String(chatId)] = 'Перед общением, обязательно прочитайте правила.';
      saveGreetings();

      await bot.sendMessage(chatId, '✅ Приветствие установлено.');
      return;
    }

    // delete greeting
    if (text.toLowerCase() === 'delete greeting') {
      const allowed = await canManageBot(chatId, userId);

      if (!allowed) {
        await bot.sendMessage(chatId, '❌ Только админы могут управлять ботом.');
        return;
      }

      delete greetings[String(chatId)];
      saveGreetings();

      await bot.sendMessage(chatId, '✅ Приветствие удалено.');
      return;
    }

    // show greeting
    if (text.toLowerCase() === 'show greeting') {
      const allowed = await canManageBot(chatId, userId);

      if (!allowed) {
        await bot.sendMessage(chatId, '❌ Только админы могут управлять ботом.');
        return;
      }

      const greeting = greetings[String(chatId)];

      if (!greeting) {
        await bot.sendMessage(chatId, 'Приветствие ещё не установлено.');
        return;
      }

      await bot.sendMessage(chatId, `Текущее приветствие:\n\n${greeting}`);
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
      if (user.is_bot) continue;

      await bot.sendMessage(chatId, greetingText);
    }
  } catch (error) {
    console.error('Ошибка приветствия:', error.message);
  }
});

// сервер для Render
app.get('/', (req, res) => {
  res.status(200).send('Bot is running');
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log('BOT STARTED');
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});
