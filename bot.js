const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

const token = '8349077397:AAFaVcrelkwgrJf4mdvIBfi38gLWjIwcs9s';
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Бот запускается...');

// Временное хранилище
let repliesDB = {};
let userSessions = {};
let lastUserIds = {}; // Храним последние userId для каждого менеджера

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
        sessions: userSessions,
        lastUserIds: lastUserIds
    });
});

// 🔧 УПРОЩЕННАЯ ЛОГИКА БОТА
bot.onText(/\/start(.+)?/, (msg, match) => {
    const chatId = msg.chat.id;
    const fullText = msg.text;
    const managerId = msg.from.id;
    
    console.log('🔗 [BOT] Получена команда /start:', fullText);
    console.log('👤 [BOT] Менеджер:', msg.from.username || msg.from.first_name);
    
    // Извлекаем параметр после /start
    const startPayload = match[1] ? match[1].trim() : null;
    
    if (startPayload && startPayload.startsWith('reply_')) {
        const userId = startPayload;
        
        console.log('🎯 [BOT] Найден userId из ссылки:', userId);
        
        // Сохраняем userId для этого менеджера
        lastUserIds[managerId] = userId;
        userSessions[chatId] = { 
            userId: userId, 
            waitingForReply: true,
            username: msg.from.username || msg.from.first_name
        };
        
        bot.sendMessage(chatId, 
            `💬 РЕЖИМ ОТВЕТА КЛИЕНТУ\n\n` +
            `👤 ID клиента: ${userId}\n\n` +
            `✍️ Напишите сообщение для клиента...`
        );
        
    } else {
        // Проверяем есть ли последний userId для этого менеджера
        const lastUserId = lastUserIds[managerId];
        
        if (lastUserId) {
            // Предлагаем ответить последнему клиенту
            userSessions[chatId] = { 
                userId: lastUserId, 
                waitingForReply: true,
                username: msg.from.username || msg.from.first_name
            };
            
            bot.sendMessage(chatId, 
                `💬 ОТВЕТ КЛИЕНТУ\n\n` +
                `👤 ID клиента: ${lastUserId}\n\n` +
                `✍️ Напишите сообщение для клиента...\n\n` +
                `ℹ️ Для ответа другому клиенту используйте ссылку из заявки`
            );
            
        } else {
            // Первое использование - просим использовать ссылку
            bot.sendMessage(chatId, 
                `🤖 Бот Vilenamebel\n\n` +
                `Этот бот предназначен для ответов на заявки с сайта.\n\n` +
                `📲 Как использовать:\n` +
                `1. Откройте заявку на сайте vilenamebel.ru\n` +
                `2. Нажмите кнопку "Ответить" в чате\n` +
                `3. Используйте полученную ссылку\n\n` +
                `🔗 Ссылка выглядит так:\n` +
                `https://t.me/Vilena_bot?start=reply_USER_ID`
            );
        }
    }
});

// Обработчик всех сообщений
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const managerId = msg.from.id;
    
    // Пропускаем команды
    if (text.startsWith('/')) return;
    
    console.log('📩 [BOT] Получено сообщение:', text);
    console.log('👤 [BOT] От:', msg.from.username || msg.from.first_name);
    
    // Если есть активная сессия - сохраняем ответ
    if (userSessions[chatId] && userSessions[chatId].waitingForReply) {
        const session = userSessions[chatId];
        const userId = session.userId;
        const managerName = session.username;
        
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
            '🔄 Для нового ответа используйте ссылку из заявки.'
        );
        
        // Очищаем сессию
        delete userSessions[chatId];
        
    } else {
        // Если нет сессии, но есть последний userId - предлагаем ответить
        const lastUserId = lastUserIds[managerId];
        
        if (lastUserId) {
            userSessions[chatId] = { 
                userId: lastUserId, 
                waitingForReply: true,
                username: msg.from.username || msg.from.first_name
            };
            
            bot.sendMessage(chatId, 
                `💬 ОТВЕТ КЛИЕНТУ\n\n` +
                `👤 ID клиента: ${lastUserId}\n\n` +
                `✍️ Напишите сообщение для клиента...`
            );
            
        } else {
            bot.sendMessage(chatId, 
                '❌ Неизвестная команда\n\n' +
                'Для ответа клиенту используйте ссылку из заявки на сайте.'
            );
        }
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
