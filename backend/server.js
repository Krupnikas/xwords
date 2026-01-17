const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { Crossword } = require('./generation');

const app = express();
const PORT = 3000;

app.use(cors());
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
    const count = parseInt(req.query.count) || 30;
    const seed = req.query.seed || 'кроссворд';

    const firstWord = {
        word: seed,
        x: 0,
        y: 0,
        direction: 'horizontal'
    };

    const crossword = new Crossword(firstWord);
    crossword.generate(count);

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

    // Находим кандидатов в расширенной области
    const candidatesInArea = crossword.firstLetterCandidates.filter(c => {
        return c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1;
    });

    // Генерируем слова для кандидатов в области
    const wordsBefore = crossword.words.length;
    const maxNewWords = 20; // Лимит за один запрос
    let added = 0;

    for (const candidate of candidatesInArea) {
        if (added >= maxNewWords) break;

        const constraints = crossword.getConstraintsForCandidate(
            candidate.x, candidate.y, candidate.direction
        );
        if (!constraints) continue;

        const matchingWords = crossword.wordIndex.findByConstraints(constraints, 1, 10);

        let bestWord = null;
        let maxScore = 0;

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

        if (bestWord) {
            crossword.addWord(bestWord);
            added++;
        }
    }

    // Возвращаем только новые слова
    const newWords = crossword.words.slice(wordsBefore);

    res.json({
        newWords,
        totalWords: crossword.words.length,
        firstLetterCandidates: crossword.firstLetterCandidates
    });
});

app.listen(PORT, () => {
    console.log(`Crossword server running on http://localhost:${PORT}`);
});
