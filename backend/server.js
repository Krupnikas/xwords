const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { Crossword } = require('./generation');

const app = express();
const PORT = 3000;

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:8080', 'https://krupnikas.github.io'],
    credentials: true
}));
app.use(express.json());

// Раздача фронтенда
app.use(express.static(path.join(__dirname, '../frontend')));

// Хранилище сессий кроссвордов
const sessions = new Map();

// Очистка старых сессий (старше 1 часа)
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.lastAccess > 60 * 60 * 1000) {
            sessions.delete(id);
        }
    }
}, 5 * 60 * 1000);

app.get('/api/generate', (req, res) => {
    const seed = req.query.seed || 'кроссворд';
    const allowRepeats = req.query.allowRepeats === 'true';

    const firstWord = {
        word: seed,
        x: 0,
        y: 0,
        direction: 'horizontal'
    };

    // Создаём кроссворд только с первым словом
    const crossword = new Crossword(firstWord, { allowRepeats });

    // Создаём сессию
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, {
        crossword,
        lastAccess: Date.now()
    });

    res.json({
        sessionId,
        ...crossword.toJSON()
    });
});

// Догенерация в области viewport
app.post('/api/expand', (req, res) => {
    const { sessionId, bounds, depth = 2 } = req.body;

    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(400).json({ error: 'Invalid session' });
    }

    const session = sessions.get(sessionId);
    session.lastAccess = Date.now();
    const crossword = session.crossword;

    const { x0, y0, x1, y1 } = bounds;
    const wordsBefore = crossword.words.length;
    const maxWordsToAdd = 30; // Лимит слов за один запрос
    const maxTimeMs = 5000; // Максимум 5 секунд на запрос
    const startTime = Date.now();
    let wordsAdded = 0;

    // Генерируем пока есть кандидаты с пересечениями в области
    while (wordsAdded < maxWordsToAdd && (Date.now() - startTime) < maxTimeMs) {
        // Находим всех кандидатов в области
        const candidatesInBounds = crossword.firstLetterCandidates.filter(
            c => c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1
        );

        if (candidatesInBounds.length === 0) break;

        // Ищем лучшее слово с учётом глубины просчёта
        let bestWord = null;
        let maxScore = 0;

        for (const candidate of candidatesInBounds) {
            const validWords = crossword.getValidWordsForCandidate(candidate);

            for (const wordData of validWords) {
                const score = crossword.scoreWord(wordData, depth - 1);
                if (score > maxScore) {
                    maxScore = score;
                    bestWord = wordData;
                }
            }
        }

        if (bestWord) {
            crossword.addWord(bestWord);
            wordsAdded++;
        } else {
            // Нет подходящих слов для всех кандидатов с пересечениями
            break;
        }
    }

    // Возвращаем только новые слова
    const newWords = crossword.words.slice(wordsBefore);

    res.json({
        newWords,
        totalWords: crossword.words.length,
        ...crossword.toJSON()
    });
});

app.listen(PORT, () => {
    console.log(`Crossword server running on http://localhost:${PORT}`);
});
