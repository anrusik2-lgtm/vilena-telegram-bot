const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

const token = '8349077397:AAFaVcrelkwgrJf4mdvIBfi38gLWjIwcs9s';
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Бот запускается...');

// Временное хранилище
let repliesDB = {};

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
        timestamp: new Date().toISOString()
    });
});

// 🔧 СУПЕР-ПРОСТАЯ ЛОГИКА: Каждое сообщение менеджера - это ответ клиенту
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const managerName = msg.from.username || msg.from.first_name;
    
    console.log('📩 [BOT] Получено сообщение от менеджера:', text);
    console.log('👤 [BOT] Менеджер:', managerName);
    
    // Пропускаем команды
    if (text.startsWith('/')) {
        if (text === '/start') {
            bot.sendMessage(chatId, 
                `🤖 Бот Vilenamebel\n\n` +
                `✍️ Напишите сообщение для клиента.\n\n` +
                `📝 Формат:\n` +
                `user_1234567890: Ваше сообщение\n\n` +
                `ℹ️ user_id можно взять из заявки на сайте`
            );
        }
        return;
    }
    
    // Ищем user_id в сообщении
    const userIdMatch = text.match(/(user_\w+)/);
    
    if (userIdMatch) {
        const userId = userIdMatch[1];
        const message = text.replace(userId + ':', '').replace(userId, '').trim();
        
        if (message) {
            console.log(`💬 [BOT] Менеджер ${managerName} отвечает клиенту ${userId}:`, message);
            
            // Сохраняем ответ
            if (!repliesDB[userId]) repliesDB[userId] = [];
            
            const newReply = {
                id: 'reply_' + Date.now(),
                message: message,
                timestamp: new Date().toISOString(),
                manager: managerName
            };
            
            repliesDB[userId].push(newReply);
            
            console.log('✅ [BOT] Ответ сохранен в базу. Всего ответов:', repliesDB[userId].length);
            
            bot.sendMessage(chatId, 
                '✅ Ответ отправлен клиенту!\n\n' +
                `👤 Клиент: ${userId}\n` +
                `💬 Сообщение: ${message}\n\n` +
                '🔄 Клиент увидит ответ в чате на сайте.'
            );
            
        } else {
            bot.sendMessage(chatId, '❌ Напишите сообщение после user_id');
        }
    } else {
        bot.sendMessage(chatId, 
            '❌ Не найден user_id клиента\n\n' +
            '📝 Формат сообщения:\n' +
            'user_1234567890: Ваше сообщение для клиента\n\n' +
            'ℹ️ user_id можно взять из заявки на сайте'
        );
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
