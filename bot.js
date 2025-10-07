const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

// Используем память для хранения данных
let data = {
  managerSessions: {},
  replies: {}
};

// Токен бота
const token = '8349077397:AAFaVcrelkwgrJf4mdvIBfi38gLWjIwcs9s';
const bot = new TelegramBot(token, {polling: true});

console.log('🤖 Бот Vilenamebel запускается...');

// Разрешаем CORS для сайта
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// Главная страница - статус бота
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Vilenamebel Bot</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 0; 
          padding: 20px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .container { 
          max-width: 900px; 
          margin: 0 auto; 
          background: white; 
          padding: 30px; 
          border-radius: 15px; 
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .status {
          display: inline-block;
          padding: 10px 20px;
          background: #4CAF50;
          color: white;
          border-radius: 20px;
          font-weight: bold;
        }
        .reply { 
          border-left: 4px solid #4CAF50; 
          padding: 15px; 
          margin: 15px 0; 
          background: #f9f9f9; 
          border-radius: 0 8px 8px 0;
        }
        .user-id { 
          color: #4CAF50; 
          font-weight: bold; 
          font-size: 18px;
        }
        .status-info { 
          font-size: 14px; 
          color: #666; 
          margin-top: 5px;
        }
        .section {
          margin: 30px 0;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🤖 Vilenamebel Telegram Bot</h1>
          <div class="status">✅ Статус: Бот работает</div>
        </div>
        
        <div class="section">
          <h2>📊 Статистика:</h2>
          <p>👥 Всего клиентов: ${Object.keys(data.replies).length}</p>
          <p>💬 Всего ответов: ${Object.values(data.replies).reduce((acc, replies) => acc + replies.length, 0)}</p>
          <p>👨‍💼 Активных сессий: ${Object.keys(data.managerSessions).length}</p>
        </div>
        
        <div class="section">
          <h2>📨 Последние ответы менеджеров:</h2>
          ${Object.entries(data.replies).length > 0 ? 
            Object.entries(data.replies).slice(-5).map(([userId, replies]) => `
              <div>
                <h3>👤 Клиент: <span class="user-id">${userId}</span></h3>
                ${replies.slice(-3).map(reply => `
                  <div class="reply">
                    <div><strong>💬 Сообщение:</strong> ${reply.message}</div>
                    <div class="status-info">
                      ⏰ ${new Date(reply.timestamp).toLocaleString('ru-RU')} | 
                      👨‍💼 Менеджер: ${reply.managerChatId} |
                      ${reply.displayed ? '✅ Доставлено клиенту' : '🕐 Ожидает доставки'}
                    </div>
                  </div>
                `).join('')}
              </div>
            `).join('') : 
            '<p>Пока нет ответов</p>'
          }
        </div>
        
        <div class="section">
          <h2>👨‍💼 Активные сессии менеджеров:</h2>
          ${Object.keys(data.managerSessions).length > 0 ? 
            Object.entries(data.managerSessions).map(([chatId, session]) => `
              <div style="padding: 10px; margin: 5px 0; background: #e3f2fd; border-radius: 5px;">
                👨‍💼 Чат ID: <strong>${chatId}</strong> → 👤 Клиент: <strong>${session.userId}</strong>
              </div>
            `).join('') : 
            '<p>Нет активных сессий</p>'
          }
        </div>
        
        <div class="section">
          <h3>🔧 Техническая информация:</h3>
          <p>API для проверки ответов: <code>GET /api/replies/:userId</code></p>
          <p>Пример: <code>https://your-app.onrender.com/api/replies/user_123456</code></p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// API для получения ответов (для сайта)
app.get('/api/replies/:userId', (req, res) => {
  const userId = req.params.userId;
  const userReplies = data.replies[userId] || [];
  
  // Возвращаем только непрочитанные сообщения
  const newReplies = userReplies.filter(reply => !reply.displayed);
  
  // Помечаем как прочитанные
  newReplies.forEach(reply => {
    reply.displayed = true;
  });
  
  res.json(newReplies);
});

// API для тестирования
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'success', 
    message: 'Vilenamebel Bot is working!',
    timestamp: new Date().toISOString()
  });
});

// Запускаем веб-сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Веб-сервер запущен на порту ${PORT}`);
  console.log(`📊 Статусная страница: http://localhost:${PORT}`);
});

// Обработчик команды /start
bot.onText(/\/start reply_(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = match[1];
  
  console.log(`👨‍💼 Менеджер ${chatId} отвечает клиенту ${userId}`);
  
  // Сохраняем сессию менеджера
  data.managerSessions[chatId] = {
    userId: userId,
    timestamp: Date.now(),
    managerName: msg.from.first_name + ' ' + (msg.from.last_name || '')
  };
  
  bot.sendMessage(chatId, 
    `💬 Вы отвечаете клиенту Vilenamebel\n` +
    `🆔 ID клиента: ${userId}\n` +
    `📞 Телефон: будет показан в заявке\n` +
    `📝 Напишите ваш ответ:\n\n` +
    `_Клиент увидит ваш ответ прямо на сайте vilenamebel.ru_`
  );
});

// Обработчик текстовых сообщений
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;
  
  // Пропускаем команды
  if (messageText.startsWith('/')) return;
  
  console.log(`📨 Сообщение от ${chatId}: ${messageText}`);
  
  // Проверяем, есть ли активная сессия
  const session = data.managerSessions[chatId];
  
  if (session && session.userId) {
    // Это ответ менеджера - сохраняем
    const userId = session.userId;
    
    if (!data.replies[userId]) {
      data.replies[userId] = [];
    }
    
    data.replies[userId].push({
      message: messageText,
      timestamp: Date.now(),
      managerChatId: chatId,
      managerName: msg.from.first_name + ' ' + (msg.from.last_name || ''),
      displayed: false
    });
    
    // Удаляем сессию
    delete data.managerSessions[chatId];
    
    bot.sendMessage(chatId, 
      '✅ Ответ отправлен клиенту!\n\n' +
      'Клиент увидит ваше сообщение прямо на сайте vilenamebel.ru'
    );
    
    console.log(`✅ Ответ для ${userId} сохранен: "${messageText}"`);
    
  } else {
    // Обычное сообщение - пересылаем в группу
    const managerInfo = `👨‍💼 ${msg.from.first_name} ${msg.from.last_name || ''} (@${msg.from.username || 'без username'})`;
    
    bot.sendMessage('-1002622933423',
      `📨 Сообщение от менеджера:\n\n` +
      `${messageText}\n\n` +
      `${managerInfo}\n` +
      `💬 Chat ID: ${chatId}`
    ).then(() => {
      bot.sendMessage(chatId, '📤 Ваше сообщение переслано в основную группу');
    }).catch(error => {
      console.log('❌ Ошибка отправки в группу:', error);
      bot.sendMessage(chatId, '❌ Не удалось отправить сообщение в группу');
    });
  }
});

// Обработчик ошибок
bot.on('error', (error) => {
  console.log('❌ Ошибка бота:', error);
});

console.log('✅ Бот Vilenamebel успешно запущен!');
