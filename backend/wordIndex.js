/**
 * Индекс слов для быстрого поиска по маске букв.
 *
 * Структура: letterIndex[position][letter] = Set<word>
 * Позволяет за O(1) получить все слова с буквой X на позиции Y.
 */
class WordIndex {
    constructor(words) {
        // letterIndex[position][letter] = Set of words
        this.letterIndex = {};
        // wordsByLength[length] = Set of words
        this.wordsByLength = {};
        // все слова
        this.allWords = new Set(words);

        this.buildIndex(words);
    }

    buildIndex(words) {
        for (const word of words) {
            // Индекс по длине
            if (!this.wordsByLength[word.length]) {
                this.wordsByLength[word.length] = new Set();
            }
            this.wordsByLength[word.length].add(word);

            // Индекс по буквам на позициях
            for (let i = 0; i < word.length; i++) {
                const letter = word[i];
                if (!this.letterIndex[i]) {
                    this.letterIndex[i] = {};
                }
                if (!this.letterIndex[i][letter]) {
                    this.letterIndex[i][letter] = new Set();
                }
                this.letterIndex[i][letter].add(word);
            }
        }
    }

    /**
     * Найти слова подходящие под маску.
     * @param {Object} constraints - { position: letter, ... }
     * @param {number} minLength - минимальная длина слова (опционально)
     * @param {number} maxLength - максимальная длина слова (опционально)
     * @returns {Set<string>} - множество подходящих слов
     */
    findByConstraints(constraints, minLength = 1, maxLength = Infinity) {
        const positions = Object.keys(constraints).map(Number);

        if (positions.length === 0) {
            // Нет ограничений — возвращаем все слова нужной длины
            let result = new Set();
            for (let len = minLength; len <= maxLength; len++) {
                if (this.wordsByLength[len]) {
                    for (const word of this.wordsByLength[len]) {
                        if (this.allWords.has(word)) {
                            result.add(word);
                        }
                    }
                }
            }
            return result;
        }

        // Начинаем с позиции с минимальным количеством кандидатов
        let smallestSet = null;
        let smallestPos = -1;

        for (const pos of positions) {
            const letter = constraints[pos];
            const candidates = this.letterIndex[pos]?.[letter];

            if (!candidates || candidates.size === 0) {
                return new Set(); // Нет слов с такой буквой на этой позиции
            }

            if (smallestSet === null || candidates.size < smallestSet.size) {
                smallestSet = candidates;
                smallestPos = pos;
            }
        }

        // Фильтруем по остальным ограничениям
        const result = new Set();
        for (const word of smallestSet) {
            // Проверяем что слово ещё в банке
            if (!this.allWords.has(word)) continue;

            // Проверяем длину
            if (word.length < minLength || word.length > maxLength) continue;

            // Проверяем все ограничения
            let valid = true;
            for (const pos of positions) {
                if (pos >= word.length || word[pos] !== constraints[pos]) {
                    valid = false;
                    break;
                }
            }

            if (valid) {
                result.add(word);
            }
        }

        return result;
    }

    /**
     * Удалить слово из индекса
     */
    removeWord(word) {
        this.allWords.delete(word);
        // Не удаляем из letterIndex/wordsByLength для производительности
        // Проверка allWords.has() в findByConstraints отфильтрует удалённые
    }

    /**
     * Проверить есть ли слово в банке
     */
    hasWord(word) {
        return this.allWords.has(word);
    }
}

module.exports = { WordIndex };
