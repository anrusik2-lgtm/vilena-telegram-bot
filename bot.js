const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

const token = '8349077397:AAFaVcrelkwgrJf4mdvIBfi38gLWjIwcs9s';
const bot = new TelegramBot(token, { polling: true });

// Временное хранилище ответов (в памяти)
let repliesDB = {};

// Middleware для API
app.use(express.json());

// Разрешаем CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// Эндпоинт для получения ответов
app.get('/api/replies/:userId', (req, res) => {
    const userId = req.params.userId;
    console.log('📨 Запрос ответов для:', userId);
    
    const replies = repliesDB[userId] || [];
    console.log('📊 Найдено ответов:', replies.length);
    
    res.json(replies);
});

// Эндпоинт для сохранения ответа
app.post('/api/replies', (req, res) => {
    const { userId, message } = req.body;
    console.log('💾 Сохраняем ответ для:', userId);
    
    if (!repliesDB[userId]) {
        repliesDB[userId] = [];
    }
    
    const newReply = {
        id: 'reply_' + Date.now(),
        message: message,
        timestamp: new Date().toISOString()
    };
    
    repliesDB[userId].push(newReply);
    console.log('✅ Ответ сохранен');
    
    res.json({ status: 'ok', id: newReply.id });
});

// Эндпоинт для отметки прочтения
app.post('/api/replies/:replyId/read', (req, res) => {
    const replyId = req.params.replyId;
    console.log('📭 Отмечаем как прочитанное:', replyId);
    res.json({ status: 'ok' });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        users: Object.keys(repliesDB).length,
        totalReplies: Object.values(repliesDB).reduce((sum, replies) => sum + replies.length, 0)
    });
});

// Debug endpoint
app.get('/debug', (req, res) => {
    res.json({
        users: Object.keys(repliesDB),
        totalReplies: Object.values(repliesDB).reduce((sum, replies) => sum + replies.length, 0),
        timestamp: new Date().toISOString()
    });
});

// Обработчик команды /start с reply_
bot.onText(/\/start(.+)?/, (msg, match) => {
    const chatId = msg.chat.id;
    const startPayload = match[1]; // то что после /start
    
    if (startPayload && startPayload.includes('reply_')) {
        const userId = startPayload.replace('reply_', '').trim();
        
        // Сохраняем userId для этого чата
        userSessions[chatId] = { userId: userId, waitingForReply: true };
        
        bot.sendMessage(chatId, 
            `💬 Режим ответа клиенту\n\n` +
            `ID клиента: ${userId}\n` +
            `Напишите сообщение для клиента:`
        );
    } else {
        bot.sendMessage(chatId, 
            '🤖 Бот Vilenamebel\n\n' +
            'Этот бот предназначен для ответов на заявки с сайта.\n\n' +
            'Для ответа клиенту используйте специальную ссылку из заявки.'
        );
    }
});

// Хранилище сессий
const userSessions = {};

// Обработчик текстовых сообщений
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Пропускаем команды
    if (text.startsWith('/')) return;
    
    // Если это ответ менеджера клиенту
    if (userSessions[chatId] && userSessions[chatId].waitingForReply) {
        const userId = userSessions[chatId].userId;
        
        console.log(`💬 Менеджер отвечает клиенту ${userId}:`, text);
        
        // Сохраняем ответ в наше хранилище
        if (!repliesDB[userId]) {
            repliesDB[userId] = [];
        }
        
        const newReply = {
            id: 'reply_' + Date.now(),
            message: text,
            timestamp: new Date().toISOString()
        };
        
        repliesDB[userId].push(newReply);
        
        bot.sendMessage(chatId, '✅ Ответ отправлен клиенту!');
        userSessions[chatId].waitingForReply = false;
    }
});

// Запускаем сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
