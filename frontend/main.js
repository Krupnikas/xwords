const API_URL = 'http://localhost:3000';

async function loadCrossword(count = 30) {
    try {
        console.log('Loading crossword from API...');
        const response = await fetch(`${API_URL}/api/generate?count=${count}`);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        const data = await response.json();
        console.log('Received data:', data);

        window.crossword = Crossword.fromJSON(data);

        // Очищаем кэш и перерисовываем
        clearInterfaceCache();
        updateVisibleObjects();
        console.log(`Loaded crossword with ${window.crossword.words.length} words`);
    } catch (error) {
        console.error('Failed to load crossword:', error);
        alert('Не удалось загрузить кроссворд. Убедитесь что сервер запущен на http://localhost:3000');
    }
}

// Инициализация - создаем пустой кроссворд пока грузится
window.crossword = new Crossword();

// Плавное движение камеры на каждом кадре
paper.view.onFrame = () => {
    if (isDragging) return;

    const speed = moveDirection.multiply(maxSpeed);
    targetOffset = offset.add(speed);
    offset = offset.add(targetOffset.subtract(offset).multiply(smoothFactor));

    updateVisibleObjects();
};

// Загружаем кроссворд с сервера
loadCrossword(30);
