paper.setup(document.getElementById('myCanvas'));

const gridSize = 50;
const cacheSize = 1;  // Расширение видимой области для кэширования
let objects = new Map();  // Хранилище видимых объектов

let moveDirection = new paper.Point(0, 0);  // Направление движения камеры
let targetOffset = new paper.Point(0, 0);   // Целевая позиция камеры
const smoothFactor = 0.05;                   // Коэффициент сглаживания
const maxSpeed = 100;                       // Максимальная скорость камеры

// Устанавливаем начальный масштаб
paper.view.zoom = 1;
paper.view.center = new paper.Point(0, 0);
offset = new paper.Point(4 * gridSize, -4 * gridSize);
paper.view.bounds = new paper.Rectangle(-paper.view.size.width / 2, -paper.view.size.height / 2, paper.view.size.width, paper.view.size.height);


// Устанавливаем центр в ноль
paper.view.center = new paper.Point(0, 0);

getColor = (x, y) => {
    // Генерация цвета на основе координат
    const r = Math.abs(10*x) % 256;
    const g = Math.abs(10*y) % 256;
    const b = (r + g) / 2 % 256;
    return new paper.Color(r / 255, g / 255, b / 255);
}

// Создание ячейки с координатами
function createCell(x, y, color, label) {
    const position = new paper.Point(x * gridSize, y * gridSize).subtract(offset);
    const rect = new paper.Path.Rectangle({
        point: position,
        size: [gridSize, gridSize],
        fillColor: color,
        strokeColor: 'gray'
    });
    content = label || `(${x}, ${y})`;
    const text = new paper.PointText({
        point: position.add([gridSize / 2, gridSize / 2]),
        content: content,
        justification: 'center',
        fillColor: 'black',
        fontSize: 12
    });
    const group = new paper.Group([rect, text]);
    group.data.coords = [x, y];
    return group;
}

// Кэширование ячейки
function addCellToInterfaceCache(x, y, color, label) {
    // console.log(`Adding cell at (${x}, ${y})`);
    const key = `${x},${y}`;
    if (!objects.has(key)) {
        // color based on coordinates
        color = color || "#f0f0f0";
        const cell = createCell(x, y, color, label);
        objects.set(key, cell);
    }
}

// Удаление ячейки из кэша
function removeCellFromCache(key) {
    // console.log(`Removing cell at (${key})`);
    if (objects.has(key)) {
        objects.get(key).remove();
        objects.delete(key);
    }
}

function clearInterfaceCache() {
    console.log("Clearing cache");
    for (const key of objects.keys()) {
        removeCellFromCache(key);
    }
}

// Обновление видимых объектов
function updateVisibleObjects(crossword, activeCell, firstLetterCandidates) {
    const viewBounds = paper.view.bounds;

    // Определяем видимые координаты относительно центра (0,0)
    const startX = Math.floor((viewBounds.left + offset.x) / gridSize) - cacheSize;
    const endX = Math.ceil((viewBounds.right + offset.x) / gridSize) + cacheSize;
    const startY = Math.floor((viewBounds.top + offset.y) / gridSize) - cacheSize;
    const endY = Math.ceil((viewBounds.bottom + offset.y) / gridSize) + cacheSize;

    // Добавляем видимые ячейки
    for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
            // if candidateList has (x, y) then light green color
            // if activeCell is (x, y) then light blue color
            // if crossword has (x, y) then use white color and letter from crossword
            // else use default color

            const key = `${x},${y}`;
            if (objects.has(key)) {
                continue; // already exists
            }

            crossword = crossword || window.crossword;
            activeCell = activeCell || crossword.activeCell;
            firstLetterCandidates = firstLetterCandidates || crossword.firstLetterCandidates;
            const blockedCells = crossword && crossword.blockedCells;

            // Проверяем кандидатов для этой клетки
            let hasHorizontal = false;
            let hasVertical = false;
            if (firstLetterCandidates) {
                for (const candidate of firstLetterCandidates) {
                    if (candidate.x === x && candidate.y === y) {
                        if (candidate.direction === "horizontal") hasHorizontal = true;
                        if (candidate.direction === "vertical") hasVertical = true;
                    }
                }
            }

            // Проверяем заблокированные клетки
            let blockedHorizontal = false;
            let blockedVertical = false;
            if (blockedCells) {
                for (const blocked of blockedCells) {
                    if (blocked.x === x && blocked.y === y) {
                        if (blocked.direction === "horizontal") blockedHorizontal = true;
                        if (blocked.direction === "vertical") blockedVertical = true;
                    }
                }
            }

            const letter = crossword && crossword.getCellLetter(x, y);
            const green = new paper.Color(0.6, 0.9, 0.6);  // vertical candidate
            const blue = new paper.Color(0.6, 0.6, 0.9);   // horizontal candidate
            const purple = new paper.Color(0.7, 0.6, 0.9); // both candidates
            const red = new paper.Color(0.95, 0.7, 0.7);   // blocked
            const orange = new paper.Color(0.95, 0.85, 0.7); // blocked both

            if (letter) {
                // Клетка с буквой - показываем фон кандидата если есть
                let bgColor = new paper.Color(1, 1, 1); // белый по умолчанию
                if (hasHorizontal && hasVertical) {
                    bgColor = purple;
                } else if (hasHorizontal) {
                    bgColor = blue;
                } else if (hasVertical) {
                    bgColor = green;
                }
                addCellToInterfaceCache(x, y, bgColor, letter);
                continue;
            }
            else if (activeCell && activeCell.x === x && activeCell.y === y) {
                addCellToInterfaceCache(x, y, new paper.Color(1, 0.6, 0.6));
                continue;
            }
            // Кандидаты (зелёный/синий/фиолетовый)
            else if (hasHorizontal && hasVertical) {
                addCellToInterfaceCache(x, y, purple, "↘");
                continue;
            }
            else if (hasHorizontal) {
                addCellToInterfaceCache(x, y, blue, "→");
                continue;
            }
            else if (hasVertical) {
                addCellToInterfaceCache(x, y, green, "↓");
                continue;
            }
            // Заблокированные (красный/оранжевый)
            else if (blockedHorizontal && blockedVertical) {
                addCellToInterfaceCache(x, y, orange, "✕");
                continue;
            }
            else if (blockedHorizontal) {
                addCellToInterfaceCache(x, y, red, "—");
                continue;
            }
            else if (blockedVertical) {
                addCellToInterfaceCache(x, y, red, "|");
                continue;
            }
            // Пустая клетка со светлыми координатами
            addCellToInterfaceCache(x, y, new paper.Color(0.97, 0.97, 0.97), `${x},${y}`);
        }
    }

    // Удаляем невидимые ячейки
    for (const [key, obj] of objects) {
        const [x, y] = obj.data.coords;
        const cellX = x * gridSize - offset.x;
        const cellY = y * gridSize - offset.y;

        if (cellX < viewBounds.left   - gridSize * (cacheSize + 1) ||
            cellX > viewBounds.right  + gridSize * (cacheSize + 1) ||
            cellY < viewBounds.top    - gridSize * (cacheSize + 1) ||
            cellY > viewBounds.bottom + gridSize * (cacheSize + 1)) {
            removeCellFromCache(key);
        }
    }

    // move cells to the correct position
    for (const obj of objects.values()) {
        const [x, y] = obj.data.coords;
        const position = new paper.Point(x * gridSize, y * gridSize).subtract(offset);
        obj.position = position;
    }
}

// Перемещение "камеры" через смещение
function moveCamera(dx, dy) {
    offset = offset.add(new paper.Point(dx, dy));
    updateVisibleObjects();
}

// Управление камерой с клавиатуры (обновленный код)
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp': moveDirection.y = -1; break;
        case 'ArrowDown': moveDirection.y = 1; break;
        case 'ArrowLeft': moveDirection.x = -1; break;
        case 'ArrowRight': moveDirection.x = 1; break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
            moveDirection.y = 0;
            break;
        case 'ArrowLeft':
        case 'ArrowRight':
            moveDirection.x = 0;
            break;
    }
});

// Перемещение "камеры" при перетаскивании мыши
let isDragging = false;
paper.view.onMouseDown = (event) => {
    isDragging = true;
    paper.view.lastPosition = event.point;
};
paper.view.onMouseDrag = (event) => {
    if (isDragging) {
        const dx = event.point.x - paper.view.lastPosition.x;
        const dy = event.point.y - paper.view.lastPosition.y;
        moveCamera(-dx, -dy);
        paper.view.lastPosition = event.point;
    }
};
paper.view.onMouseUp = () => {
    isDragging = false;
};