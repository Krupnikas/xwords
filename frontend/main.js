// API URL: локально или продакшен
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'http://mc.skrup.ru:3000';

let sessionId = null;
let isExpanding = false;
let lastExpandBounds = null;

async function loadCrossword(count = 30) {
    try {
        console.log('Loading crossword from API...');
        const response = await fetch(`${API_URL}/api/generate?count=${count}`);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        const data = await response.json();
        console.log('Received data:', data);

        sessionId = data.sessionId;
        window.crossword = Crossword.fromJSON(data);

        clearInterfaceCache();
        updateVisibleObjects();
        console.log(`Loaded crossword with ${window.crossword.words.length} words`);
    } catch (error) {
        console.error('Failed to load crossword:', error);
        alert('Не удалось загрузить кроссворд. Убедитесь что сервер запущен на http://localhost:3000');
    }
}

// Получить границы viewport в координатах сетки
function getViewportBounds() {
    const viewBounds = paper.view.bounds;
    const x0 = Math.floor((viewBounds.left + offset.x) / gridSize);
    const y0 = Math.floor((viewBounds.top + offset.y) / gridSize);
    const x1 = Math.ceil((viewBounds.right + offset.x) / gridSize);
    const y1 = Math.ceil((viewBounds.bottom + offset.y) / gridSize);

    // Расширяем на 1 ширину/высоту окна
    const width = x1 - x0;
    const height = y1 - y0;

    return {
        x0: x0 - width,
        y0: y0 - height,
        x1: x1 + width,
        y1: y1 + height
    };
}

// Проверить нужна ли догенерация
function needsExpansion(bounds) {
    if (!lastExpandBounds) return true;

    // Если вышли за пределы предыдущей области
    return bounds.x0 < lastExpandBounds.x0 ||
           bounds.y0 < lastExpandBounds.y0 ||
           bounds.x1 > lastExpandBounds.x1 ||
           bounds.y1 > lastExpandBounds.y1;
}

// Догенерация слов в области
async function expandCrossword() {
    if (!sessionId || isExpanding) return;

    const bounds = getViewportBounds();

    if (!needsExpansion(bounds)) return;

    isExpanding = true;

    try {
        const response = await fetch(`${API_URL}/api/expand`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, bounds })
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();

        if (data.newWords && data.newWords.length > 0) {
            // Добавляем новые слова
            for (const word of data.newWords) {
                window.crossword.words.push(word);
            }
            // Обновляем кандидатов
            window.crossword.firstLetterCandidates = data.firstLetterCandidates;

            // Перерисовываем
            clearInterfaceCache();
            updateVisibleObjects();

            console.log(`Expanded: +${data.newWords.length} words, total: ${data.totalWords}`);
        }

        lastExpandBounds = bounds;
    } catch (error) {
        console.error('Failed to expand crossword:', error);
    } finally {
        isExpanding = false;
    }
}

// Дебаунс для догенерации
let expandTimeout = null;
function scheduleExpansion() {
    if (expandTimeout) clearTimeout(expandTimeout);
    expandTimeout = setTimeout(expandCrossword, 300);
}

// Инициализация
window.crossword = new Crossword();

// Плавное движение камеры на каждом кадре
paper.view.onFrame = () => {
    if (isDragging) return;

    const speed = moveDirection.multiply(maxSpeed);
    targetOffset = offset.add(speed);
    offset = offset.add(targetOffset.subtract(offset).multiply(smoothFactor));

    updateVisibleObjects();

    // Проверяем нужна ли догенерация
    if (moveDirection.x !== 0 || moveDirection.y !== 0) {
        scheduleExpansion();
    }
};

// Догенерация после drag
const originalOnMouseUp = paper.view.onMouseUp;
paper.view.onMouseUp = (event) => {
    if (originalOnMouseUp) originalOnMouseUp(event);
    isDragging = false;
    scheduleExpansion();
};

// Загружаем кроссворд с сервера
loadCrossword(30);
