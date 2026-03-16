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

const bot = new TelegramBot(token, {
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

const app = express();

let greetings = {};
let waitingAction = {};

// ---------- utils ----------

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

function saveGreetings() {
  try {
    fs.writeFileSync(GREETINGS_FILE, JSON.stringify(greetings, null, 2));
  } catch (error) {
    console.error('Ошибка сохранения greetings.json:', error.message);
  }
}

async function canManageBot(chatId, userId) {
  if (userId === OWNER_ID) return true;

  try {
    const admins = await bot.getChatAdministrators(chatId);
    return admins.some((admin) => admin.user.id === userId);
  } catch (error) {
    console.error('Ошибка проверки админа:', error.message);
    return false;
  }
}

function getGreeting(chatId) {
  return greetings[String(chatId)];
}

function setGreeting(chatId, text) {
  greetings[String(chatId)] = text;
  saveGreetings();
}

function removeGreeting(chatId) {
  delete greetings[String(chatId)];
  saveGreetings();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendGreetingWithRetry(chatId, text, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await bot.sendMessage(chatId, text);
      return true;
    } catch (error) {
      console.error(`Ошибка отправки приветствия, попытка ${attempt}:`, error.message);

      if (attempt < retries) {
        await sleep(1500 * attempt);
      }
    }
  }

  return false;
}

loadGreetings();

// ---------- start ----------

bot.onText(/\/start/, async (msg) => {
  try {
    await bot.sendMessage(
      msg.chat.id,
      `Бот работает.

Команды:
create greeting
create greeting <текст>

edit greeting
edit greeting <новый текст>

show greeting
delete greeting

Пример:
create greeting Привет {name}! Перед общением прочитайте правила.`
    );
  } catch (error) {
    console.error('Ошибка /start:', error.message);
  }
});

// ---------- messages ----------

bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text?.trim();

    if (!text) return;
    if (msg.chat.type === 'private') return;
    if (msg.new_chat_members || msg.left_chat_member) return;

    const allowed = await canManageBot(chatId, userId);
    const lower = text.toLowerCase();

    // если ждём следующий текст для create/edit
    const pending = waitingAction[String(chatId)];
    if (pending && pending.userId === userId) {
      setGreeting(chatId, text);
      delete waitingAction[String(chatId)];

      const doneText =
        pending.action === 'create'
          ? '✅ Приветствие создано.'
          : '✅ Приветствие изменено.';

      await bot.sendMessage(chatId, doneText);
      return;
    }

    // CREATE GREETING
    if (lower === 'create greeting' || lower.startsWith('create greeting ')) {
      if (!allowed) {
        await bot.sendMessage(chatId, '❌ Только админы могут управлять ботом.');
        return;
      }

      if (getGreeting(chatId)) {
        await bot.sendMessage(chatId, '❌ Приветствие уже есть. Используй: edit greeting');
        return;
      }

      const instantText = text.slice('create greeting'.length).trim();

      if (instantText) {
        setGreeting(chatId, instantText);
        await bot.sendMessage(chatId, '✅ Приветствие создано.');
        return;
      }

      waitingAction[String(chatId)] = {
        userId,
        action: 'create'
      };

      await bot.sendMessage(chatId, 'Напиши текст нового приветствия.');
      return;
    }

    // EDIT GREETING
    if (lower === 'edit greeting' || lower.startsWith('edit greeting ')) {
      if (!allowed) {
        await bot.sendMessage(chatId, '❌ Только админы могут управлять ботом.');
        return;
      }

      if (!getGreeting(chatId)) {
        await bot.sendMessage(chatId, '❌ Приветствия ещё нет. Сначала используй: create greeting');
        return;
      }

      const instantText = text.slice('edit greeting'.length).trim();

      if (instantText) {
        setGreeting(chatId, instantText);
        await bot.sendMessage(chatId, '✅ Приветствие изменено.');
        return;
      }

      waitingAction[String(chatId)] = {
        userId,
        action: 'edit'
      };

      await bot.sendMessage(chatId, 'Напиши новый текст приветствия.');
      return;
    }

    // SHOW GREETING
    if (lower === 'show greeting') {
      if (!allowed) {
        await bot.sendMessage(chatId, '❌ Только админы могут управлять ботом.');
        return;
      }

      const greeting = getGreeting(chatId);

      if (!greeting) {
        await bot.sendMessage(chatId, '❌ Приветствие ещё не создано.');
        return;
      }

      await bot.sendMessage(chatId, `📌 Текущее приветствие:\n\n${greeting}`);
      return;
    }

    // DELETE GREETING
    if (lower === 'delete greeting') {
      if (!allowed) {
        await bot.sendMessage(chatId, '❌ Только админы могут управлять ботом.');
        return;
      }

      if (!getGreeting(chatId)) {
        await bot.sendMessage(chatId, '❌ Приветствие уже удалено или не создано.');
        return;
      }

      removeGreeting(chatId);
      delete waitingAction[String(chatId)];

      await bot.sendMessage(chatId, '✅ Приветствие удалено.');
      return;
    }
  } catch (error) {
    console.error('Ошибка обработки сообщения:', error.message);
  }
});

// ---------- new members ----------

bot.on('new_chat_members', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const greetingText = getGreeting(chatId);

    if (!greetingText) return;
    if (!Array.isArray(msg.new_chat_members) || msg.new_chat_members.length === 0) return;

    for (const user of msg.new_chat_members) {
      if (user.is_bot) continue;

      const name = user.first_name || user.username || 'друг';
      const finalText = greetingText.replace(/\{name\}/g, name);

      // небольшая задержка для надёжности
      await sleep(1200);

      const sent = await sendGreetingWithRetry(chatId, finalText, 3);

      if (!sent) {
        console.error(`Не удалось отправить приветствие пользователю ${name} в чате ${chatId}`);
      }
    }
  } catch (error) {
    console.error('Ошибка приветствия нового участника:', error.message);
  }
});

// ---------- server ----------

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

// ---------- errors ----------

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});

bot.on('error', (error) => {
  console.error('Bot error:', error.message);
});
