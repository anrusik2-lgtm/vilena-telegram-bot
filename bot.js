const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

const token = '8349077397:AAFaVcrelkwgrJf4mdvIBfi38gLWjIwcs9s';
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Бот запускается...');

// Временное хранилище ответов (в памяти)
let repliesDB = {};
let userSessions = {}; // Хранилище сессий

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
    console.log('📨 [API] Запрос ответов для:', userId);
    
    const replies = repliesDB[userId] || [];
    console.log('📊 [API] Найдено ответов:', replies.length);
    
    res.json(replies);
});

// Эндпоинт для сохранения ответа
app.post('/api/replies', (req, res) => {
    const { userId, message } = req.body;
    console.log('💾 [API] Сохраняем ответ для:', userId, 'Сообщение:', message);
    
    if (!repliesDB[userId]) {
        repliesDB[userId] = [];
    }
    
    const newReply = {
        id: 'reply_' + Date.now(),
        message: message,
        timestamp: new Date().toISOString()
    };
    
    repliesDB[userId].push(newReply);
    console.log('✅ [API] Ответ сохранен. Всего ответов:', repliesDB[userId].length);
    
    res.json({ status: 'ok', id: newReply.id });
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
        timestamp: new Date().toISOString(),
        sessions: userSessions
    });
});

// Обработчик команды /start
bot.onText(/\/start/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    console.log('🔗 [BOT] Получена команда /start:', text);
    console.log('👤 [BOT] От пользователя:', msg.from.username || msg.from.first_name);
    
    // Проверяем есть ли параметр после /start
    if (text.includes('reply_')) {
        const parts = text.split(' ');
        const payload = parts[1]; // часть после /start
        
        console.log('🎯 [BOT] Найден payload:', payload);
        
        if (payload && payload.includes('reply_')) {
            const userId = payload.replace('reply_', '').trim();
            
            console.log('👤 [BOT] Установлен режим ответа для пользователя:', userId);
            
            // Сохраняем userId для этого чата
            userSessions[chatId] = { 
                userId: userId, 
                waitingForReply: true,
                username: msg.from.username || msg.from.first_name
            };
            
            bot.sendMessage(chatId, 
                `💬 Режим ответа клиенту\n\n` +
                `ID клиента: ${userId}\n` +
                `Напишите сообщение для клиента:`
            );
            
            console.log('✅ [BOT] Сессия создана:', userSessions[chatId]);
        }
    } else {
        bot.sendMessage(chatId, 
            '🤖 Бот Vilenamebel\n\n' +
            'Этот бот предназначен для ответов на заявки с сайта.\n\n' +
            'Для ответа клиенту используйте специальную ссылку из заявки.'
        );
    }
});

// Обработчик ВСЕХ текстовых сообщений
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    console.log('📩 [BOT] Получено сообщение:', text);
    console.log('👤 [BOT] От:', msg.from.username || msg.from.first_name);
    console.log('💾 [BOT] Текущие сессии:', Object.keys(userSessions).length);
    
    // Пропускаем команды
    if (text.startsWith('/')) {
        console.log('⏩ [BOT] Пропускаем команду');
        return;
    }
    
    // Если это ответ менеджера клиенту
    if (userSessions[chatId] && userSessions[chatId].waitingForReply) {
        const userId = userSessions[chatId].userId;
        const managerName = userSessions[chatId].username;
        
        console.log(`💬 [BOT] Менеджер ${managerName} отвечает клиенту ${userId}:`, text);
        
        // Сохраняем ответ в наше хранилище
        if (!repliesDB[userId]) {
            repliesDB[userId] = [];
        }
        
        const newReply = {
            id: 'reply_' + Date.now(),
            message: text,
            timestamp: new Date().toISOString(),
            manager: managerName
        };
        
        repliesDB[userId].push(newReply);
        
        console.log('✅ [BOT] Ответ сохранен в базу. Всего ответов:', repliesDB[userId].length);
        
        bot.sendMessage(chatId, '✅ Ответ отправлен клиенту!');
        
        // Очищаем сессию
        userSessions[chatId].waitingForReply = false;
        console.log('🔄 [BOT] Сессия очищена для чата:', chatId);
    } else {
        console.log('❌ [BOT] Неизвестное сообщение, сессия не найдена');
        bot.sendMessage(chatId, 
            '❌ Неизвестная команда\n\n' +
            'Для ответа клиенту используйте ссылку из заявки.'
        );
    }
});

// Обработчик ошибок
bot.on('error', (error) => {
    console.error('❌ [BOT] Ошибка бота:', error);
});

// Запускаем сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 [SERVER] Сервер запущен на порту ${PORT}`);
    console.log(`🌐 [SERVER] Health: http://localhost:${PORT}/health`);
    console.log(`🔧 [SERVER] Debug: http://localhost:${PORT}/debug`);
});
