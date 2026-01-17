const { wordsBank: initialWordsBank } = require('./wordsBank');
const { WordIndex } = require('./wordIndex');

const maxWordLength = 10;

class Crossword {
    constructor(firstWord = null, options = {}) {
        this.words = [];
        this.firstLetterCandidates = [];
        this.blockedCells = new Set(); // O(1) lookup
        this.wordIndex = new WordIndex(initialWordsBank);
        this.allowRepeats = options.allowRepeats || false;
        this.debug = options.debug || false;

        // Если первое слово не передано - создаём пустой кроссворд
        if (!firstWord) {
            return;
        }

        // Удаляем первое слово из индекса (если не разрешены повторы)
        if (!this.allowRepeats) {
            this.wordIndex.removeWord(firstWord.word);
        }

        // Добавляем первое слово и его блокировки
        this.words.push(firstWord);
        this._addBlockedCells(firstWord);

        // Создаём начальных кандидатов
        if (firstWord.direction === "horizontal") {
            for (let i = 0; i < firstWord.word.length; i++) {
                for (let j = 0; j < maxWordLength; j++) {
                    const cx = firstWord.x + i;
                    const cy = firstWord.y - j;
                    if (!this.isBlocked(cx, cy, "vertical")) {
                        this.firstLetterCandidates.push({
                            x: cx,
                            y: cy,
                            direction: "vertical"
                        });
                    }
                }
            }
        }
        if (firstWord.direction === "vertical") {
            for (let i = 0; i < firstWord.word.length; i++) {
                for (let j = 0; j < maxWordLength; j++) {
                    const cx = firstWord.x - j;
                    const cy = firstWord.y + i;
                    if (!this.isBlocked(cx, cy, "horizontal")) {
                        this.firstLetterCandidates.push({
                            x: cx,
                            y: cy,
                            direction: "horizontal"
                        });
                    }
                }
            }
        }
    }

    _addBlockedCells(crosswordWord) {
        if (crosswordWord.direction === "horizontal") {
            this._addBlockedCell(crosswordWord.x - 1, crosswordWord.y, "horizontal");
            this._addBlockedCell(crosswordWord.x - 1, crosswordWord.y, "vertical");
            this._addBlockedCell(crosswordWord.x + crosswordWord.word.length, crosswordWord.y, "horizontal");
            this._addBlockedCell(crosswordWord.x + crosswordWord.word.length, crosswordWord.y, "vertical");

            for (let i = 0; i < crosswordWord.word.length; i++) {
                this._addBlockedCell(crosswordWord.x + i, crosswordWord.y - 1, "horizontal");
                this._addBlockedCell(crosswordWord.x + i, crosswordWord.y, "horizontal");
                this._addBlockedCell(crosswordWord.x + i, crosswordWord.y + 1, "horizontal");
            }
        }
        if (crosswordWord.direction === "vertical") {
            this._addBlockedCell(crosswordWord.x, crosswordWord.y - 1, "vertical");
            this._addBlockedCell(crosswordWord.x, crosswordWord.y - 1, "horizontal");
            this._addBlockedCell(crosswordWord.x, crosswordWord.y + crosswordWord.word.length, "vertical");
            this._addBlockedCell(crosswordWord.x, crosswordWord.y + crosswordWord.word.length, "horizontal");

            for (let i = 0; i < crosswordWord.word.length; i++) {
                this._addBlockedCell(crosswordWord.x - 1, crosswordWord.y + i, "vertical");
                this._addBlockedCell(crosswordWord.x, crosswordWord.y + i, "vertical");
                this._addBlockedCell(crosswordWord.x + 1, crosswordWord.y + i, "vertical");
            }
        }
    }

    _blockKey(x, y, direction) {
        return `${x},${y},${direction}`;
    }

    isBlocked(x, y, direction) {
        return this.blockedCells.has(this._blockKey(x, y, direction));
    }

    _addBlockedCell(x, y, direction) {
        this.blockedCells.add(this._blockKey(x, y, direction));

        // Удаляем кандидатов, которые направлены на эту клетку без пересечения
        // Для горизонтальной блокировки - удаляем горизонтальных кандидатов слева (c.x <= x)
        // Для вертикальной блокировки - удаляем вертикальных кандидатов сверху (c.y <= y)
        this.firstLetterCandidates = this.firstLetterCandidates.filter(c => {
            if (c.direction !== direction) return true;

            if (direction === "horizontal") {
                // Кандидат горизонтальный, блокировка горизонтальная
                // Кандидат слева от блокировки: c.x <= x, и блокировка в диапазоне слова
                if (c.y !== y) return true;
                if (c.x > x) return true; // кандидат справа от блокировки - не затрагивает
                if (x >= c.x + maxWordLength) return true; // блокировка слишком далеко справа
                // Клетка (x, y) попадает в диапазон - проверяем есть ли там пересечение
                const letter = this.getCellLetter(x, y);
                if (letter !== null) return true; // есть пересечение - кандидат валиден
                return false; // нет пересечения - удаляем кандидата
            } else {
                // Кандидат вертикальный, блокировка вертикальная
                // Кандидат сверху от блокировки: c.y <= y, и блокировка в диапазоне слова
                if (c.x !== x) return true;
                if (c.y > y) return true; // кандидат ниже блокировки - не затрагивает
                if (y >= c.y + maxWordLength) return true; // блокировка слишком далеко снизу
                // Клетка (x, y) попадает в диапазон - проверяем есть ли там пересечение
                const letter = this.getCellLetter(x, y);
                if (letter !== null) return true; // есть пересечение - кандидат валиден
                return false; // нет пересечения - удаляем кандидата
            }
        });
    }

    addWord(crosswordWord) {
        this.words.push(crosswordWord);
        if (!this.allowRepeats) {
            this.wordIndex.removeWord(crosswordWord.word);
        }

        // block surrounding cells (это также удалит невалидных кандидатов)
        this._addBlockedCells(crosswordWord);

        // add new candidates
        const newCandidates = this.getNewFirstLetterCellCandidates(
            crosswordWord.x,
            crosswordWord.y,
            crosswordWord.direction,
            crosswordWord.word
        );

        const existingKeys = new Set(
            this.firstLetterCandidates.map(c => `${c.x},${c.y},${c.direction}`)
        );

        for (const candidate of newCandidates) {
            const key = `${candidate.x},${candidate.y},${candidate.direction}`;
            if (existingKeys.has(key)) continue;
            if (this.isBlocked(candidate.x, candidate.y, candidate.direction)) continue;

            // Проверка на слипание
            if (candidate.direction === "horizontal") {
                if (this.getCellLetter(candidate.x, candidate.y - 1) !== null) continue;
                if (this.getCellLetter(candidate.x, candidate.y + 1) !== null) continue;
            } else {
                if (this.getCellLetter(candidate.x - 1, candidate.y) !== null) continue;
                if (this.getCellLetter(candidate.x + 1, candidate.y) !== null) continue;
            }

            existingKeys.add(key);
            this.firstLetterCandidates.push(candidate);
        }
    }

    getCellLetter(x, y) {
        for (const word of this.words) {
            if (word.direction === "horizontal") {
                if (word.x <= x && x < word.x + word.word.length && word.y === y) {
                    return word.word[x - word.x];
                }
            } else if (word.direction === "vertical") {
                if (word.x === x && word.y <= y && y < word.y + word.word.length) {
                    return word.word[y - word.y];
                }
            }
        }
        return null;
    }

    /**
     * Получить ограничения (известные буквы) для позиции кандидата.
     */
    getConstraintsForCandidate(x, y, direction) {
        const constraints = {};
        let hasConstraint = false;

        for (let i = 0; i < maxWordLength; i++) {
            const letter = direction === "horizontal"
                ? this.getCellLetter(x + i, y)
                : this.getCellLetter(x, y + i);

            if (letter !== null) {
                constraints[i] = letter;
                hasConstraint = true;
            }
        }

        return hasConstraint ? constraints : null;
    }

    /**
     * Создать снимок состояния для отката
     */
    snapshot() {
        return {
            words: [...this.words],
            firstLetterCandidates: [...this.firstLetterCandidates],
            blockedCells: new Set(this.blockedCells),
            removedWords: this.wordIndex.snapshot()
        };
    }

    /**
     * Восстановить состояние из снимка
     */
    restore(snapshot) {
        this.words = snapshot.words;
        this.firstLetterCandidates = snapshot.firstLetterCandidates;
        this.blockedCells = snapshot.blockedCells;
        this.wordIndex.restore(snapshot.removedWords);
    }

    /**
     * Проверить можно ли разместить слово (нет blocked cells).
     * Если в позиции есть буква (пересечение), блокировка игнорируется.
     */
    canPlaceWord(x, y, direction, wordLength) {
        for (let i = 0; i < wordLength; i++) {
            const px = direction === "horizontal" ? x + i : x;
            const py = direction === "horizontal" ? y : y + i;

            // Если есть буква — это пересечение, блокировка не применяется
            if (this.getCellLetter(px, py) !== null) continue;

            if (direction === "horizontal") {
                if (this.isBlocked(px, py, "horizontal")) return false;
                // Проверяем что сверху/снизу нет букв (слипание)
                if (this.getCellLetter(px, py - 1) !== null) return false;
                if (this.getCellLetter(px, py + 1) !== null) return false;
            } else {
                if (this.isBlocked(px, py, "vertical")) return false;
                // Проверяем что слева/справа нет букв (слипание)
                if (this.getCellLetter(px - 1, py) !== null) return false;
                if (this.getCellLetter(px + 1, py) !== null) return false;
            }
        }
        return true;
    }

    generate(wordsCount = 5, depth = 2) {
        for (let i = 0; i < wordsCount; i++) {
            this.generateWord(depth);
        }
    }

    /**
     * Получить все валидные слова для кандидата с их базовым скором
     */
    getValidWordsForCandidate(cell) {
        const constraints = this.getConstraintsForCandidate(cell.x, cell.y, cell.direction);
        if (constraints === null) return [];

        const matchingWords = this.wordIndex.findByConstraints(constraints, 1, maxWordLength);
        const validWords = [];

        for (const word of matchingWords) {
            if (!this.canPlaceWord(cell.x, cell.y, cell.direction, word.length)) {
                continue;
            }

            let valid = true;
            let intersections = 0;

            for (let i = 0; i < word.length; i++) {
                const existingLetter = cell.direction === "horizontal"
                    ? this.getCellLetter(cell.x + i, cell.y)
                    : this.getCellLetter(cell.x, cell.y + i);

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

            validWords.push({
                word: word,
                x: cell.x,
                y: cell.y,
                direction: cell.direction,
                baseScore: word.length * intersections
            });
        }

        return validWords;
    }

    /**
     * Рекурсивно вычислить скор слова с учётом будущих ходов
     * Для оптимизации проверяем только топ-N кандидатов по базовому скору
     */
    scoreWord(wordData, depth, maxCandidates = 10) {
        if (depth <= 0) {
            return wordData.baseScore;
        }

        // Сохраняем состояние
        const snap = this.snapshot();

        // Добавляем слово
        this.addWord(wordData);

        // Собираем все валидные слова со скорами
        const allNextWords = [];
        for (const cell of this.firstLetterCandidates) {
            const validWords = this.getValidWordsForCandidate(cell);
            allNextWords.push(...validWords);
        }

        // Сортируем по базовому скору и берём топ-N
        allNextWords.sort((a, b) => b.baseScore - a.baseScore);
        const topCandidates = allNextWords.slice(0, maxCandidates);

        // Находим лучший следующий ход
        let bestFutureScore = 0;
        for (const nextWord of topCandidates) {
            const futureScore = this.scoreWord(nextWord, depth - 1, maxCandidates);
            if (futureScore > bestFutureScore) {
                bestFutureScore = futureScore;
            }
        }

        // Восстанавливаем состояние
        this.restore(snap);

        return wordData.baseScore + bestFutureScore;
    }

    generateWord(depth = 2) {
        let maxScore = 0;
        let bestWord = null;

        for (const cell of this.firstLetterCandidates) {
            const validWords = this.getValidWordsForCandidate(cell);

            for (const wordData of validWords) {
                const score = this.scoreWord(wordData, depth - 1);
                if (score > maxScore) {
                    maxScore = score;
                    bestWord = wordData;
                }
            }
        }

        if (bestWord === null) {
            if (this.debug) {
                console.log('[generate] No word found');
            }
            return;
        }

        if (this.debug) {
            console.log(`[generate] Adding: ${bestWord.word} at (${bestWord.x}, ${bestWord.y}) ${bestWord.direction}, score: ${maxScore}`);
        }
        this.addWord(bestWord);
    }

    getNewFirstLetterCellCandidates(x, y, direction, word) {
        const newCandidates = [];
        if (direction === "horizontal") {
            for (let i = 0; i < word.length; i++) {
                for (let j = 0; j < maxWordLength; j++) {
                    const cx = x + i;
                    const cy = y - j;
                    if (this.isBlocked(cx, cy, "vertical")) continue;
                    // Проверка на слипание: слева/справа не должно быть букв
                    if (this.getCellLetter(cx - 1, cy) !== null) continue;
                    if (this.getCellLetter(cx + 1, cy) !== null) continue;
                    newCandidates.push({ x: cx, y: cy, direction: "vertical" });
                }
            }
        } else if (direction === "vertical") {
            for (let i = 0; i < word.length; i++) {
                for (let j = 0; j < maxWordLength; j++) {
                    const cx = x - j;
                    const cy = y + i;
                    if (this.isBlocked(cx, cy, "horizontal")) continue;
                    // Проверка на слипание: сверху/снизу не должно быть букв
                    if (this.getCellLetter(cx, cy - 1) !== null) continue;
                    if (this.getCellLetter(cx, cy + 1) !== null) continue;
                    newCandidates.push({ x: cx, y: cy, direction: "horizontal" });
                }
            }
        }
        return newCandidates;
    }

    /**
     * Найти место для слова в пустой области экрана
     */
    findWordInEmptySpace(x0, y0, x1, y1) {
        // Берём случайное слово из банка
        const words = Array.from(this.wordIndex.allWords).slice(0, 100);
        if (words.length === 0) return null;

        // Центр области
        const centerX = Math.floor((x0 + x1) / 2);
        const centerY = Math.floor((y0 + y1) / 2);
        const maxRadius = Math.max(x1 - centerX, y1 - centerY, centerX - x0, centerY - y0);

        // Пробуем найти место для каждого слова, начиная от центра
        for (const word of words) {
            // Спиральный поиск от центра
            for (let r = 0; r <= maxRadius; r++) {
                // Проходим по квадрату на расстоянии r от центра
                for (let dy = -r; dy <= r; dy++) {
                    for (let dx = -r; dx <= r; dx++) {
                        // Только границы квадрата (не внутренность, она уже проверена)
                        if (r > 0 && Math.abs(dx) < r && Math.abs(dy) < r) continue;

                        const x = centerX + dx;
                        const y = centerY + dy;

                        if (x < x0 || x > x1 || y < y0 || y > y1) continue;

                        // Пробуем горизонтально
                        if (x + word.length <= x1 + 1) {
                            if (this._canPlaceWordInEmpty(x, y, "horizontal", word)) {
                                return { word, x, y, direction: "horizontal" };
                            }
                        }
                        // Пробуем вертикально
                        if (y + word.length <= y1 + 1) {
                            if (this._canPlaceWordInEmpty(x, y, "vertical", word)) {
                                return { word, x, y, direction: "vertical" };
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    /**
     * Проверить можно ли разместить слово в пустом месте (без пересечений)
     */
    _canPlaceWordInEmpty(x, y, direction, word) {
        // Проверяем все клетки слова + окружение
        for (let i = -1; i <= word.length; i++) {
            const px = direction === "horizontal" ? x + i : x;
            const py = direction === "horizontal" ? y : y + i;

            // Проверяем саму клетку
            if (i >= 0 && i < word.length) {
                if (this.getCellLetter(px, py) !== null) return false;
                if (this.isBlocked(px, py, direction)) return false;
            }

            // Проверяем соседние клетки (слипание)
            if (direction === "horizontal") {
                if (this.getCellLetter(px, py - 1) !== null) return false;
                if (this.getCellLetter(px, py + 1) !== null) return false;
            } else {
                if (this.getCellLetter(px - 1, py) !== null) return false;
                if (this.getCellLetter(px + 1, py) !== null) return false;
            }
        }

        // Проверяем клетки до и после слова
        if (direction === "horizontal") {
            if (this.getCellLetter(x - 1, y) !== null) return false;
            if (this.getCellLetter(x + word.length, y) !== null) return false;
        } else {
            if (this.getCellLetter(x, y - 1) !== null) return false;
            if (this.getCellLetter(x, y + word.length) !== null) return false;
        }

        return true;
    }

    /**
     * Добавить слово в пустое место (создаёт новый "остров")
     */
    addWordToEmptySpace(wordData) {
        this.words.push(wordData);
        if (!this.allowRepeats) {
            this.wordIndex.removeWord(wordData.word);
        }

        // Добавляем блокировки
        this._addBlockedCells(wordData);

        // Добавляем кандидатов для нового слова
        const newCandidates = this.getNewFirstLetterCellCandidates(
            wordData.x,
            wordData.y,
            wordData.direction,
            wordData.word
        );

        const existingKeys = new Set(
            this.firstLetterCandidates.map(c => `${c.x},${c.y},${c.direction}`)
        );

        for (const candidate of newCandidates) {
            const key = `${candidate.x},${candidate.y},${candidate.direction}`;
            if (existingKeys.has(key)) continue;
            if (this.isBlocked(candidate.x, candidate.y, candidate.direction)) continue;

            existingKeys.add(key);
            this.firstLetterCandidates.push(candidate);
        }
    }

    toJSON() {
        // Преобразуем blockedCells в массив объектов для фронтенда
        const blockedCellsArray = [];
        for (const key of this.blockedCells) {
            const [x, y, direction] = key.split(',');
            blockedCellsArray.push({
                x: parseInt(x),
                y: parseInt(y),
                direction: direction
            });
        }

        return {
            words: this.words,
            firstLetterCandidates: this.firstLetterCandidates,
            blockedCells: blockedCellsArray
        };
    }
}

module.exports = { Crossword };
