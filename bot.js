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

// ПРАВИЛЬНЫЕ CORS настройки
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
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

// Эндпоинт для отметки прочтения
app.post('/api/replies/:replyId/read', (req, res) => {
    const replyId = req.params.replyId;
    console.log('📭 [API] Отмечаем как прочитанное:', replyId);
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
        timestamp: new Date().toISOString(),
        sessions: userSessions
    });
});

// 🔧 ИСПРАВЛЕННЫЙ ОБРАБОТЧИК КОМАНДЫ /start
bot.onText(/\/start(.+)?/, (msg, match) => {
    const chatId = msg.chat.id;
    const fullText = msg.text;
    
    console.log('🔗 [BOT] Получена команда /start:', fullText);
    console.log('👤 [BOT] От пользователя:', msg.from.username || msg.from.first_name);
    
    // Извлекаем параметр после /start
    const startPayload = match[1] ? match[1].trim() : null;
    
    console.log('🎯 [BOT] Start payload:', startPayload);
    
    if (startPayload && startPayload.startsWith('reply_')) {
        const userId = startPayload;
        
        console.log('👤 [BOT] Установлен режим ответа для пользователя:', userId);
        
        // Сохраняем сессию
        userSessions[chatId] = { 
            userId: userId, 
            waitingForReply: true,
            username: msg.from.username || msg.from.first_name,
            startedAt: new Date().toISOString()
        };
        
        console.log('💾 [BOT] Сессия создана:', userSessions[chatId]);
        
        // Отправляем инструкцию менеджеру
        bot.sendMessage(chatId, 
            `💬 РЕЖИМ ОТВЕТА КЛИЕНТУ\n\n` +
            `👤 ID клиента: ${userId}\n` +
            `⏰ Начало: ${new Date().toLocaleString('ru-RU')}\n\n` +
            `✍️ Напишите сообщение для клиента...`
        ).then(() => {
            console.log('✅ [BOT] Инструкция отправлена менеджеру');
        });
        
    } else {
        // Стандартное приветствие
        bot.sendMessage(chatId, 
            '🤖 Бот Vilenamebel\n\n' +
            'Этот бот предназначен для ответов на заявки с сайта.\n\n' +
            'Для ответа клиенту используйте специальную ссылку из заявки.'
        );
    }
});

// 🔧 ИСПРАВЛЕННЫЙ ОБРАБОТЧИК ТЕКСТОВЫХ СООБЩЕНИЙ
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const messageId = msg.message_id;
    
    // Пропускаем команды и служебные сообщения
    if (text.startsWith('/') || !text.trim()) {
        return;
    }
    
    console.log('📩 [BOT] Получено сообщение:', text);
    console.log('👤 [BOT] От:', msg.from.username || msg.from.first_name);
    console.log('💾 [BOT] Активные сессии:', Object.keys(userSessions));
    
    // Проверяем есть ли активная сессия для этого чата
    if (userSessions[chatId] && userSessions[chatId].waitingForReply) {
        const session = userSessions[chatId];
        const userId = session.userId;
        const managerName = session.username;
        
        console.log(`💬 [BOT] Менеджер ${managerName} отвечает клиенту ${userId}:`, text);
        
        // Сохраняем ответ в базу
        if (!repliesDB[userId]) {
            repliesDB[userId] = [];
        }
        
        const newReply = {
            id: 'reply_' + Date.now(),
            message: text,
            timestamp: new Date().toISOString(),
            manager: managerName,
            managerId: msg.from.id
        };
        
        repliesDB[userId].push(newReply);
        
        console.log('✅ [BOT] Ответ сохранен в базу. Всего ответов:', repliesDB[userId].length);
        
        // Подтверждаем менеджеру
        bot.sendMessage(chatId, 
            '✅ Ответ отправлен клиенту!\n\n' +
            '💬 Клиент увидит ваше сообщение в чате на сайте.\n\n' +
            '🔄 Для нового ответа используйте ссылку из заявки.'
        ).then(() => {
            console.log('✅ [BOT] Подтверждение отправлено менеджеру');
        });
        
        // Очищаем сессию
        delete userSessions[chatId];
        console.log('🔄 [BOT] Сессия очищена для чата:', chatId);
        
    } else {
        console.log('❌ [BOT] Сообщение не обработано - нет активной сессии');
        
        // Если нет активной сессии, напоминаем про ссылку
        bot.sendMessage(chatId, 
            '❌ Неизвестная команда\n\n' +
            'Для ответа клиенту используйте ссылку из заявки:\n' +
            'https://t.me/Vilena_bot?start=reply_USER_ID\n\n' +
            'Замените USER_ID на ID клиента из заявки.'
        );
    }
});

// Обработчик ошибок
bot.on('error', (error) => {
    console.error('❌ [BOT] Ошибка бота:', error);
});

bot.on('polling_error', (error) => {
    console.error('❌ [BOT] Ошибка polling:', error);
});

// Запускаем сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 [SERVER] Сервер запущен на порту ${PORT}`);
    console.log(`🌐 [SERVER] Health: https://vilena-bot.onrender.com/health`);
    console.log(`🔧 [SERVER] Debug: https://vilena-bot.onrender.com/debug`);
    console.log(`📊 [SERVER] Активные сессии: ${Object.keys(userSessions).length}`);
});
