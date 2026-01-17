const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { Crossword } = require('./generation');

const app = express();
const PORT = 3000;

app.use(cors({
    origin: ['http://localhost:3000', 'https://krupnikas.github.io'],
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
    const { sessionId, bounds } = req.body;

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
        // Находим всех кандидатов в области с пересечениями
        const candidatesWithConstraints = [];
        for (const c of crossword.firstLetterCandidates) {
            if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;

            const constraints = crossword.getConstraintsForCandidate(c.x, c.y, c.direction);
            if (constraints) {
                candidatesWithConstraints.push({ candidate: c, constraints });
            }
        }

        if (candidatesWithConstraints.length === 0) break;

        // Ищем лучшее слово среди всех кандидатов
        let bestWord = null;
        let maxScore = 0;

        for (const { candidate, constraints } of candidatesWithConstraints) {
            const matchingWords = crossword.wordIndex.findByConstraints(constraints, 1, 10);

            for (const word of matchingWords) {
                if (!crossword.canPlaceWord(candidate.x, candidate.y, candidate.direction, word.length)) {
                    continue;
                }

                let valid = true;
                let intersections = 0;

                for (let i = 0; i < word.length; i++) {
                    const existingLetter = candidate.direction === "horizontal"
                        ? crossword.getCellLetter(candidate.x + i, candidate.y)
                        : crossword.getCellLetter(candidate.x, candidate.y + i);

                    if (existingLetter !== null) {
                        if (existingLetter === word[i]) {
                            intersections++;
                        } else {
                            valid = false;
                            break;
                        }
                    }
                }

                if (!valid || intersections === 0) continue;

                const score = word.length + intersections;
                if (score > maxScore) {
                    maxScore = score;
                    bestWord = {
                        word: word,
                        x: candidate.x,
                        y: candidate.y,
                        direction: candidate.direction
                    };
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
