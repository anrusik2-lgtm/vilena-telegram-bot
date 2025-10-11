const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const app = express();

const token = '8349077397:AAFaVcrelkwgrJf4mdvIBfi38gLWjIwcs9s';
const bot = new TelegramBot(token, { polling: true });

// URL вашего API (тот же сервер)
const API_URL = process.env.API_URL || 'https://vilena-bot.onrender.com';

// Обработчик команды /start
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
    
    // Если это ответ менеджера клиенту
    if (userSessions[chatId] && userSessions[chatId].waitingForReply) {
        const userId = userSessions[chatId].userId;
        
        console.log(`💬 Менеджер отвечает клиенту ${userId}:`, text);
        
        // Сохраняем ответ через API
        fetch(API_URL + '/api/replies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                message: text
            })
        })
        .then(response => response.json())
        .then(result => {
            bot.sendMessage(chatId, '✅ Ответ отправлен клиенту!');
            userSessions[chatId].waitingForReply = false;
        })
        .catch(error => {
            console.error('❌ Ошибка сохранения ответа:', error);
            bot.sendMessage(chatId, '❌ Ошибка отправки ответа');
        });
    }
});
