const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Разрешаем CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// Хранилище ответов (временное - в памяти)
let repliesDB = {};

// Эндпоинт для получения ответов
app.get('/api/replies/:userId', (req, res) => {
    const userId = req.params.userId;
    console.log('📨 Запрос ответов для пользователя:', userId);
    
    const replies = repliesDB[userId] || [];
    console.log('📊 Найдено ответов:', replies.length);
    
    res.json(replies);
});

// Эндпоинт для сохранения ответа (вызывается Telegram ботом)
app.post('/api/replies', (req, res) => {
    const { userId, message } = req.body;
    console.log('💾 Сохраняем ответ для пользователя:', userId);
    console.log('📝 Сообщение:', message);
    
    if (!userId || !message) {
        return res.status(400).json({ error: 'Missing userId or message' });
    }
    
    if (!repliesDB[userId]) {
        repliesDB[userId] = [];
    }
    
    const newReply = {
        id: 'reply_' + Date.now(),
        message: message,
        timestamp: new Date().toISOString(),
        displayed: false
    };
    
    repliesDB[userId].push(newReply);
    console.log('✅ Ответ сохранен. Всего ответов для пользователя:', repliesDB[userId].length);
    
    res.json({ status: 'ok', id: newReply.id });
});

// Эндпоинт для отметки прочтения
app.post('/api/replies/:replyId/read', (req, res) => {
    const replyId = req.params.replyId;
    console.log('📭 Отмечаем как прочитанное:', replyId);
    
    // Ищем reply во всех пользователях и помечаем как displayed
    for (let userId in repliesDB) {
        const userReplies = repliesDB[userId];
        const replyIndex = userReplies.findIndex(reply => reply.id === replyId);
        
        if (replyIndex !== -1) {
            userReplies[replyIndex].displayed = true;
            console.log('✅ Ответ помечен как прочитанный');
            break;
        }
    }
    
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

// Эндпоинт для отладки - посмотреть все данные
app.get('/debug', (req, res) => {
    res.json({
        users: Object.keys(repliesDB),
        repliesDB: repliesDB,
        timestamp: new Date().toISOString()
    });
});

// Эндпоинт для тестирования - добавить тестовый ответ
app.post('/test-reply/:userId', (req, res) => {
    const userId = req.params.userId;
    const message = req.body.message || 'Тестовый ответ от сервера';
    
    if (!repliesDB[userId]) {
        repliesDB[userId] = [];
    }
    
    const testReply = {
        id: 'test_' + Date.now(),
        message: message,
        timestamp: new Date().toISOString(),
        displayed: false
    };
    
    repliesDB[userId].push(testReply);
    
    res.json({ 
        status: 'ok', 
        message: 'Тестовый ответ добавлен',
        reply: testReply 
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 Debug: http://localhost:${PORT}/debug`);
});
