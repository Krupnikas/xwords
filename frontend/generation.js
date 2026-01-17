class Crossword {
    constructor() {
        this.words = [];
        this.firstLetterCandidates = [];
    }

    static fromJSON(data) {
        const crossword = new Crossword();
        crossword.words = data.words || [];
        crossword.firstLetterCandidates = data.firstLetterCandidates || [];
        return crossword;
    }

    getWords() {
        return this.words;
    }

    getWordsInCoords(x0, y0, x1, y1) {
        let wordsInCoords = [];
        for (const word of this.words) {
            const x = word.x;
            const y = word.y;
            if (word.direction === "horizontal") {
                if (y0 <= y && y <= y1 && x0 <= x && x + word.word.length <= x1) {
                    wordsInCoords.push(word);
                }
            } else if (word.direction === "vertical") {
                if (x0 <= x && x <= x1 && y0 <= y && y + word.word.length <= y1) {
                    wordsInCoords.push(word);
                }
            }
        }
        return wordsInCoords;
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
}
