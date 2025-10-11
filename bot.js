const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

const token = '8349077397:AAFaVcrelkwgrJf4mdvIBfi38gLWjIwcs9s';
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Бот запускается...');

// Временное хранилище
let repliesDB = {};
let pendingReplies = {}; // Ожидающие ответы: { chatId: userId }

// Middleware
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// API эндпоинты
app.get('/api/replies/:userId', (req, res) => {
    const userId = req.params.userId;
    console.log('📨 [API] Запрос ответов для:', userId);
    const replies = repliesDB[userId] || [];
    res.json(replies);
});

app.post('/api/replies', (req, res) => {
    const { userId, message } = req.body;
    console.log('💾 [API] Сохраняем ответ для:', userId);
    
    if (!repliesDB[userId]) repliesDB[userId] = [];
    
    const newReply = {
        id: 'reply_' + Date.now(),
        message: message,
        timestamp: new Date().toISOString()
    };
    
    repliesDB[userId].push(newReply);
    console.log('✅ [API] Ответ сохранен. Всего ответов:', repliesDB[userId].length);
    res.json({ status: 'ok', id: newReply.id });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        users: Object.keys(repliesDB).length,
        totalReplies: Object.values(repliesDB).reduce((sum, replies) => sum + replies.length, 0)
    });
});

app.get('/debug', (req, res) => {
    res.json({
        users: Object.keys(repliesDB),
        totalReplies: Object.values(repliesDB).reduce((sum, replies) => sum + replies.length, 0),
        timestamp: new Date().toISOString(),
        pendingReplies: pendingReplies
    });
});

// 🔧 ПРОСТАЯ ЛОГИКА: Принимаем любой текст как ответ клиенту
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const managerName = msg.from.username || msg.from.first_name;
    
    console.log('📩 [BOT] Получено сообщение:', text);
    console.log('👤 [BOT] От:', managerName);
    
    // Если это команда /start - просим прислать userId
    if (text === '/start') {
        console.log('🔗 [BOT] Получена команда /start');
        
        bot.sendMessage(chatId, 
            `🤖 Бот Vilenamebel\n\n` +
            `Для ответа клиенту:\n` +
            `1. Откройте заявку на сайте\n` +
            `2. Нажмите кнопку "Ответить"\n` +
            `3. Используйте полученную ссылку\n\n` +
            `⚠️ Не пишите /start вручную! Используйте ссылку из заявки.`
        );
        return;
    }
    
    // Если у нас есть ожидающий ответ для этого чата
    if (pendingReplies[chatId]) {
        const userId = pendingReplies[chatId];
        
        console.log(`💬 [BOT] Менеджер ${managerName} отвечает клиенту ${userId}:`, text);
        
        // Сохраняем ответ
        if (!repliesDB[userId]) repliesDB[userId] = [];
        
        const newReply = {
            id: 'reply_' + Date.now(),
            message: text,
            timestamp: new Date().toISOString(),
            manager: managerName
        };
        
        repliesDB[userId].push(newReply);
        
        console.log('✅ [BOT] Ответ сохранен в базу. Всего ответов:', repliesDB[userId].length);
        
        // Подтверждаем
        bot.sendMessage(chatId, 
            '✅ Ответ отправлен клиенту!\n\n' +
            '💬 Клиент увидит ваше сообщение в чате на сайте.\n\n' +
            '🔄 Для нового ответа используйте ссылку из следующей заявки.'
        );
        
        // Очищаем ожидание
        delete pendingReplies[chatId];
        
    } else {
        // Если нет ожидающего ответа, но сообщение похоже на userId
        if (text.startsWith('reply_') || text.startsWith('user_')) {
            const userId = text.trim();
            
            console.log('🎯 [BOT] Обнаружен userId:', userId);
            
            // Сохраняем ожидание ответа
            pendingReplies[chatId] = userId;
            
            bot.sendMessage(chatId, 
                `💬 РЕЖИМ ОТВЕТА КЛИЕНТУ\n\n` +
                `👤 ID клиента: ${userId}\n\n` +
                `✍️ Напишите сообщение для клиента...`
            );
            
        } else {
            // Неизвестное сообщение
            bot.sendMessage(chatId, 
                '❌ Неизвестная команда\n\n' +
                'Для ответа клиенту используйте ссылку из заявки на сайте vilenamebel.ru\n\n' +
                'Ссылка выглядит так:\n' +
                'https://t.me/Vilena_bot?start=reply_USER_ID'
            );
        }
    }
});

// Обработчик для прямых ссылок с параметром
bot.onText(/\/start (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = match[1].trim();
    const managerName = msg.from.username || msg.from.first_name;
    
    console.log('🔗 [BOT] Получена команда /start с параметром:', userId);
    
    if (userId.startsWith('reply_')) {
        // Сохраняем ожидание ответа
        pendingReplies[chatId] = userId;
        
        bot.sendMessage(chatId, 
            `💬 РЕЖИМ ОТВЕТА КЛИЕНТУ\n\n` +
            `👤 ID клиента: ${userId}\n\n` +
            `✍️ Напишите сообщение для клиента...`
        );
        
        console.log('✅ [BOT] Ожидание ответа установлено для:', userId);
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
