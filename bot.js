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
let waitingAction = {};

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

bot.onText(/\/start/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    `Бот работает.

Команды:
create greeting - создать приветствие
edit greeting - изменить приветствие
show greeting - показать приветствие
delete greeting - удалить приветствие`
  );
});

bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    if (!text) return;
    if (msg.new_chat_members || msg.left_chat_member) return;
    if (msg.chat.type === 'private') return;

    const lowerText = text.toLowerCase();

    const allowed = await canManageBot(chatId, userId);

    // CREATE GREETING
    if (lowerText === 'create greeting') {
      if (!allowed) {
        await bot.sendMessage(chatId, '❌ Только админы могут управлять ботом.');
        return;
      }

      if (greetings[String(chatId)]) {
        await bot.sendMessage(
          chatId,
          '❌ Приветствие уже существует. Используй команду: edit greeting'
        );
        return;
      }

      waitingAction[chatId] = {
        userId,
        action: 'create'
      };

      await bot.sendMessage(
        chatId,
        'Напиши текст нового приветствия.'
      );
      return;
    }

    // EDIT GREETING
    if (lowerText === 'edit greeting') {
      if (!allowed) {
        await bot.sendMessage(chatId, '❌ Только админы могут управлять ботом.');
        return;
      }

      if (!greetings[String(chatId)]) {
        await bot.sendMessage(
          chatId,
          '❌ Приветствия ещё нет. Сначала используй: create greeting'
        );
        return;
      }

      waitingAction[chatId] = {
        userId,
        action: 'edit'
      };

      await bot.sendMessage(
        chatId,
        'Напиши новый текст приветствия.'
      );
      return;
    }

    // SHOW GREETING
    if (lowerText === 'show greeting') {
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

    // DELETE GREETING
    if (lowerText === 'delete greeting') {
      if (!allowed) {
        await bot.sendMessage(chatId, '❌ Только админы могут управлять ботом.');
        return;
      }

      if (!greetings[String(chatId)]) {
        await bot.sendMessage(chatId, 'Приветствие уже удалено или не создано.');
        return;
      }

      delete greetings[String(chatId)];
      saveGreetings();

      await bot.sendMessage(chatId, '✅ Приветствие удалено.');
      return;
    }

    // СОХРАНЕНИЕ ТЕКСТА ПОСЛЕ create/edit
    const pending = waitingAction[chatId];

    if (pending && pending.userId === userId) {
      greetings[String(chatId)] = text;
      saveGreetings();

      const actionText = pending.action === 'create'
        ? '✅ Приветствие создано.'
        : '✅ Приветствие изменено.';

      delete waitingAction[chatId];

      await bot.sendMessage(chatId, actionText);
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

      const name = user.first_name || user.username || 'друг';
      const finalText = greetingText.replace(/\{name\}/g, name);

      await bot.sendMessage(chatId, finalText);
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
