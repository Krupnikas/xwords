const { wordsBank: initialWordsBank } = require('./wordsBank');
const { WordIndex } = require('./wordIndex');

const maxWordLength = 10;

class Crossword {
    constructor(firstWord, options = {}) {
        this.words = [];
        this.words.push(firstWord);
        this.firstLetterCandidates = [];
        this.blockedCells = new Set(); // O(1) lookup
        this.wordIndex = new WordIndex(initialWordsBank);
        this.allowRepeats = options.allowRepeats || false;

        // Удаляем первое слово из индекса (если не разрешены повторы)
        if (!this.allowRepeats) {
            this.wordIndex.removeWord(firstWord.word);
        }

        if (firstWord.direction === "horizontal") {
            for (let i = 0; i < firstWord.word.length; i++) {
                for (let j = 0; j < maxWordLength; j++) {
                    this.firstLetterCandidates.push({
                        x: firstWord.x + i,
                        y: firstWord.y - j,
                        direction: "vertical"
                    });
                }
            }
        }
        if (firstWord.direction === "vertical") {
            for (let i = 0; i < firstWord.word.length; i++) {
                for (let j = 0; j < maxWordLength; j++) {
                    this.firstLetterCandidates.push({
                        x: firstWord.x - j,
                        y: firstWord.y + i,
                        direction: "horizontal"
                    });
                }
            }
        }
    }

    _blockKey(x, y, direction) {
        return `${x},${y},${direction}`;
    }

    isBlocked(x, y, direction) {
        return this.blockedCells.has(this._blockKey(x, y, direction));
    }

    addWord(crosswordWord) {
        this.words.push(crosswordWord);
        if (!this.allowRepeats) {
            this.wordIndex.removeWord(crosswordWord.word);
        }

        // block surrounding cells
        if (crosswordWord.direction === "horizontal") {
            this.blockedCells.add(this._blockKey(crosswordWord.x - 1, crosswordWord.y, "horizontal"));
            this.blockedCells.add(this._blockKey(crosswordWord.x - 1, crosswordWord.y, "vertical"));
            this.blockedCells.add(this._blockKey(crosswordWord.x + crosswordWord.word.length, crosswordWord.y, "horizontal"));
            this.blockedCells.add(this._blockKey(crosswordWord.x + crosswordWord.word.length, crosswordWord.y, "vertical"));

            for (let i = 0; i < crosswordWord.word.length; i++) {
                this.blockedCells.add(this._blockKey(crosswordWord.x + i, crosswordWord.y - 1, "horizontal"));
                this.blockedCells.add(this._blockKey(crosswordWord.x + i, crosswordWord.y, "horizontal"));
                this.blockedCells.add(this._blockKey(crosswordWord.x + i, crosswordWord.y + 1, "horizontal"));
                this.blockedCells.add(this._blockKey(crosswordWord.x + i, crosswordWord.y + 1, "vertical"));
            }
        }
        if (crosswordWord.direction === "vertical") {
            this.blockedCells.add(this._blockKey(crosswordWord.x, crosswordWord.y - 1, "vertical"));
            this.blockedCells.add(this._blockKey(crosswordWord.x, crosswordWord.y - 1, "horizontal"));
            this.blockedCells.add(this._blockKey(crosswordWord.x, crosswordWord.y + crosswordWord.word.length, "vertical"));
            this.blockedCells.add(this._blockKey(crosswordWord.x, crosswordWord.y + crosswordWord.word.length, "horizontal"));

            for (let i = 0; i < crosswordWord.word.length; i++) {
                this.blockedCells.add(this._blockKey(crosswordWord.x - 1, crosswordWord.y + i, "vertical"));
                this.blockedCells.add(this._blockKey(crosswordWord.x, crosswordWord.y + i, "vertical"));
                this.blockedCells.add(this._blockKey(crosswordWord.x + 1, crosswordWord.y + i, "vertical"));
                this.blockedCells.add(this._blockKey(crosswordWord.x + 1, crosswordWord.y + i, "horizontal"));
            }
        }

        // remove invalid candidates
        this.firstLetterCandidates = this.firstLetterCandidates.filter(candidate => {
            if (this.isBlocked(candidate.x, candidate.y, candidate.direction)) {
                return false;
            }
            if (crosswordWord.direction === "horizontal" &&
                candidate.direction === "horizontal" &&
                candidate.x >= crosswordWord.x - 2 &&
                candidate.x <= crosswordWord.x + crosswordWord.word.length &&
                candidate.y === crosswordWord.y) {
                return false;
            }
            if (crosswordWord.direction === "vertical" &&
                candidate.direction === "vertical" &&
                candidate.y >= crosswordWord.y - 2 &&
                candidate.y <= crosswordWord.y + crosswordWord.word.length &&
                candidate.x === crosswordWord.x) {
                return false;
            }
            return true;
        });

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
            if (!existingKeys.has(key)) {
                existingKeys.add(key);
                this.firstLetterCandidates.push(candidate);
            }
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
     * Проверить можно ли разместить слово (нет blocked cells).
     */
    canPlaceWord(x, y, direction, wordLength) {
        for (let i = 0; i < wordLength; i++) {
            if (direction === "horizontal") {
                if (this.isBlocked(x + i, y, "horizontal")) return false;
            } else {
                if (this.isBlocked(x, y + i, "vertical")) return false;
            }
        }
        return true;
    }

    generate(wordsCount = 5) {
        for (let i = 0; i < wordsCount; i++) {
            this.generateWord();
        }
    }

    generateWord() {
        let maxScore = 0;
        let bestWord = null;

        for (const cell of this.firstLetterCandidates) {
            // Получаем ограничения (известные буквы)
            const constraints = this.getConstraintsForCandidate(cell.x, cell.y, cell.direction);

            // Слово должно пересекаться с существующим
            if (constraints === null) continue;

            // Получаем только подходящие слова из индекса — O(1) вместо O(n)
            const matchingWords = this.wordIndex.findByConstraints(constraints, 1, maxWordLength);

            for (const word of matchingWords) {
                if (!this.canPlaceWord(cell.x, cell.y, cell.direction, word.length)) {
                    continue;
                }

                // Считаем пересечения
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

                const score = word.length + intersections;
                if (score > maxScore) {
                    maxScore = score;
                    bestWord = {
                        word: word,
                        x: cell.x,
                        y: cell.y,
                        direction: cell.direction
                    };
                }
            }
        }

        if (bestWord === null) {
            return;
        }

        this.addWord(bestWord);
    }

    getNewFirstLetterCellCandidates(x, y, direction, word) {
        const newCandidates = [];
        if (direction === "horizontal") {
            for (let i = 0; i < word.length; i++) {
                for (let j = 0; j < maxWordLength; j++) {
                    const checking_x = x + i;
                    const checking_y = y - j;
                    if (!this.isBlocked(checking_x, checking_y, "vertical")) {
                        newCandidates.push({
                            x: checking_x,
                            y: checking_y,
                            direction: "vertical"
                        });
                    }
                }
            }
        } else if (direction === "vertical") {
            for (let i = 0; i < word.length; i++) {
                for (let j = 0; j < maxWordLength; j++) {
                    const checking_x = x - j;
                    const checking_y = y + i;
                    if (!this.isBlocked(checking_x, checking_y, "horizontal")) {
                        newCandidates.push({
                            x: checking_x,
                            y: checking_y,
                            direction: "horizontal"
                        });
                    }
                }
            }
        }
        return newCandidates;
    }

    toJSON() {
        return {
            words: this.words,
            firstLetterCandidates: this.firstLetterCandidates
        };
    }
}

module.exports = { Crossword };
