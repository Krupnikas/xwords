const { wordsBank: initialWordsBank } = require('./wordsBank');

const maxWordLength = 10;

class Crossword {
    constructor(firstWord) {
        this.words = [];
        this.words.push(firstWord);
        this.firstLetterCandidates = [];
        this.blockedCells = [];
        this.wordsBank = [...initialWordsBank]; // копия банка слов

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

    addWord(crosswordWord) {
        this.words.push(crosswordWord);

        const wordIndex = this.wordsBank.indexOf(crosswordWord.word);
        if (wordIndex > -1) {
            this.wordsBank.splice(wordIndex, 1);
        }

        // block surrounding cells
        if (crosswordWord.direction === "horizontal") {
            this.blockedCells.push({
                x: crosswordWord.x - 1,
                y: crosswordWord.y,
                direction: "horizontal"
            });
            this.blockedCells.push({
                x: crosswordWord.x - 1,
                y: crosswordWord.y,
                direction: "vertical"
            });
            this.blockedCells.push({
                x: crosswordWord.x + crosswordWord.word.length + 1,
                y: crosswordWord.y,
                direction: "horizontal"
            });
            this.blockedCells.push({
                x: crosswordWord.x + crosswordWord.word.length + 1,
                y: crosswordWord.y,
                direction: "vertical"
            });
            for (let i = 0; i < crosswordWord.word.length; i++) {
                this.blockedCells.push({
                    x: crosswordWord.x + i,
                    y: crosswordWord.y - 1,
                    direction: "horizontal"
                });
                this.blockedCells.push({
                    x: crosswordWord.x + i,
                    y: crosswordWord.y,
                    direction: "horizontal"
                });
                this.blockedCells.push({
                    x: crosswordWord.x + i,
                    y: crosswordWord.y + 1,
                    direction: "horizontal"
                });
                this.blockedCells.push({
                    x: crosswordWord.x + i,
                    y: crosswordWord.y + 1,
                    direction: "vertical"
                });
            }
        }
        if (crosswordWord.direction === "vertical") {
            this.blockedCells.push({
                x: crosswordWord.x,
                y: crosswordWord.y - 1,
                direction: "vertical"
            });
            this.blockedCells.push({
                x: crosswordWord.x,
                y: crosswordWord.y - 1,
                direction: "horizontal"
            });
            this.blockedCells.push({
                x: crosswordWord.x,
                y: crosswordWord.y + crosswordWord.word.length + 1,
                direction: "vertical"
            });
            this.blockedCells.push({
                x: crosswordWord.x,
                y: crosswordWord.y + crosswordWord.word.length + 1,
                direction: "horizontal"
            });
            for (let i = 0; i < crosswordWord.word.length; i++) {
                this.blockedCells.push({
                    x: crosswordWord.x - 1,
                    y: crosswordWord.y + i,
                    direction: "vertical"
                });
                this.blockedCells.push({
                    x: crosswordWord.x,
                    y: crosswordWord.y + i,
                    direction: "vertical"
                });
                this.blockedCells.push({
                    x: crosswordWord.x + 1,
                    y: crosswordWord.y + i,
                    direction: "vertical"
                });
                this.blockedCells.push({
                    x: crosswordWord.x + 1,
                    y: crosswordWord.y + i,
                    direction: "horizontal"
                });
            }
        }

        // remove invalid candidates
        for (let i = 0; i < this.firstLetterCandidates.length; i++) {
            const candidate = this.firstLetterCandidates[i];
            if (this.blockedCells.find(blockedCell =>
                blockedCell.x === candidate.x &&
                blockedCell.y === candidate.y &&
                blockedCell.direction === candidate.direction)) {
                this.firstLetterCandidates.splice(i, 1);
                i--;
                continue;
            }
            if (crosswordWord.direction === "horizontal" &&
                candidate.direction === "horizontal" &&
                candidate.x >= crosswordWord.x - 2 &&
                candidate.x <= crosswordWord.x + crosswordWord.word.length &&
                candidate.y === crosswordWord.y) {
                this.firstLetterCandidates.splice(i, 1);
                i--;
                continue;
            }
            if (crosswordWord.direction === "vertical" &&
                candidate.direction === "vertical" &&
                candidate.y >= crosswordWord.y - 2 &&
                candidate.y <= crosswordWord.y + crosswordWord.word.length &&
                candidate.x === crosswordWord.x) {
                this.firstLetterCandidates.splice(i, 1);
                i--;
                continue;
            }
        }

        // add new candidates
        const newCandidates = this.getNewFirstLetterCellCandidates(
            crosswordWord.x,
            crosswordWord.y,
            crosswordWord.direction,
            crosswordWord.word
        );

        for (let i = 0; i < newCandidates.length; i++) {
            const candidate = newCandidates[i];
            if (!this.firstLetterCandidates.find(c =>
                c.x === candidate.x &&
                c.y === candidate.y &&
                c.direction === candidate.direction)) {
                this.firstLetterCandidates.push(candidate);
            }
        }

        // remove duplicates
        this.firstLetterCandidates = this.firstLetterCandidates.filter((candidate, index, self) =>
            index === self.findIndex((c) => (
                c.x === candidate.x && c.y === candidate.y && c.direction === candidate.direction
            ))
        );
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

    generate(wordsCount = 5) {
        for (let i = 0; i < wordsCount; i++) {
            this.generateWord();
        }
    }

    generateWord() {
        let maxScore = 0;
        let bestWord = null;

        for (let cell of this.firstLetterCandidates) {
            for (let word of this.wordsBank) {
                let score = this.scoreWord(cell.x, cell.y, cell.direction, word);
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
        let newCandidates = [];
        if (direction === "horizontal") {
            for (let i = 0; i < word.length; i++) {
                for (let j = 0; j < maxWordLength; j++) {
                    const checking_x = x + i;
                    const checking_y = y - j;
                    if (this.blockedCells.find(cell =>
                        cell.x === checking_x &&
                        cell.y === checking_y &&
                        cell.direction === "vertical")) {
                        continue;
                    }
                    newCandidates.push({
                        x: checking_x,
                        y: checking_y,
                        direction: "vertical"
                    });
                }
            }
        } else if (direction === "vertical") {
            for (let i = 0; i < word.length; i++) {
                for (let j = 0; j < maxWordLength; j++) {
                    const checking_x = x - j;
                    const checking_y = y + i;
                    if (this.blockedCells.find(cell =>
                        cell.x === checking_x &&
                        cell.y === checking_y &&
                        cell.direction === "horizontal")) {
                        continue;
                    }
                    newCandidates.push({
                        x: checking_x,
                        y: checking_y,
                        direction: "horizontal"
                    });
                }
            }
        }
        return newCandidates;
    }

    scoreWord(x, y, direction, word) {
        let score = word.length;
        if (direction === "horizontal") {
            for (let i = 0; i < word.length; i++) {
                if (this.blockedCells.find(cell =>
                    cell.x === x + i &&
                    cell.y === y &&
                    cell.direction === "horizontal")) {
                    return -1;
                }

                let letter = this.getCellLetter(x + i, y);
                if (letter !== null) {
                    if (letter === word[i]) {
                        score++;
                    } else {
                        return -1;
                    }
                }
            }
        } else if (direction === "vertical") {
            for (let i = 0; i < word.length; i++) {
                if (this.blockedCells.find(cell =>
                    cell.x === x &&
                    cell.y === y + i &&
                    cell.direction === "vertical")) {
                    return -1;
                }
                let letter = this.getCellLetter(x, y + i);
                if (letter !== null) {
                    if (letter === word[i]) {
                        score++;
                    } else {
                        return -1;
                    }
                }
            }
        }
        if (score === word.length) {
            return -1;
        }

        return score;
    }

    toJSON() {
        return {
            words: this.words,
            firstLetterCandidates: this.firstLetterCandidates
        };
    }
}

module.exports = { Crossword };
