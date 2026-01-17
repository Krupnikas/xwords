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
    const { sessionId, bounds, depth = 1 } = req.body;

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

    // Расширенные границы: слева/сверху добавляем половину размера
    const width = x1 - x0;
    const height = y1 - y0;
    const extX0 = x0 - Math.floor(width / 2);
    const extY0 = y0 - Math.floor(height / 2);

    console.log(`[expand] bounds: x=${extX0}..${x1}, y=${extY0}..${y1}, candidates=${crossword.firstLetterCandidates.length}`);

    // Основной цикл: пробуем добавлять слова с пересечениями,
    // если не получается - добавляем пустое слово и пробуем снова
    let emptyWordsAdded = 0;

    while (wordsAdded < maxWordsToAdd && (Date.now() - startTime) < maxTimeMs) {
        // Пробуем добавить слово с пересечением
        const candidatesInBounds = crossword.firstLetterCandidates.filter(
            c => c.x >= extX0 && c.x <= x1 && c.y >= extY0 && c.y <= y1
        );

        let addedWithIntersection = false;

        if (candidatesInBounds.length > 0) {
            const allValidWords = [];
            for (const candidate of candidatesInBounds) {
                const validWords = crossword.getValidWordsForCandidate(candidate);
                allValidWords.push(...validWords);
            }

            if (allValidWords.length > 0) {
                allValidWords.sort((a, b) => b.baseScore - a.baseScore);
                const topCandidates = allValidWords.slice(0, 50);

                let bestWord = null;
                let maxScore = 0;

                for (const wordData of topCandidates) {
                    const score = crossword.scoreWord(wordData, depth - 1);
                    if (score > maxScore) {
                        maxScore = score;
                        bestWord = wordData;
                    }
                }

                if (bestWord) {
                    crossword.addWord(bestWord);
                    wordsAdded++;
                    addedWithIntersection = true;
                }
            }
        }

        // Если не удалось добавить с пересечением - пробуем пустое место
        // Границы для пустых слов: экран + 10 клеток с каждой стороны
        if (!addedWithIntersection) {
            const emptyWord = crossword.findWordInEmptySpace(x0 - 10, y0 - 10, x1 + 10, y1 + 10);
            if (emptyWord) {
                crossword.addWordToEmptySpace(emptyWord);
                wordsAdded++;
                emptyWordsAdded++;
            } else {
                // Нет места даже для пустого слова - выходим
                break;
            }
        }
    }

    if (emptyWordsAdded > 0) {
        console.log(`[expand] added ${emptyWordsAdded} words in empty spaces`);
    }

    console.log(`[expand] done: +${wordsAdded} words in ${Date.now() - startTime}ms`);

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
