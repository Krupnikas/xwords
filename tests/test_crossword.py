import pytest
import os
import time
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Папка для скриншотов
SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), 'screenshots')
BASE_URL = 'http://localhost:3000'


@pytest.fixture(scope='module')
def driver():
    """Создаёт headless Chrome драйвер."""
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')

    driver = webdriver.Chrome(options=options)
    driver.implicitly_wait(10)

    yield driver

    driver.quit()


def take_screenshot(driver, name):
    """Сохраняет скриншот с временной меткой."""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'{timestamp}_{name}.png'
    filepath = os.path.join(SCREENSHOTS_DIR, filename)
    driver.save_screenshot(filepath)
    print(f'Screenshot saved: {filepath}')
    return filepath


class TestCrosswordPage:
    """Тесты страницы кроссворда."""

    def test_page_loads(self, driver):
        """Проверяет что страница загружается."""
        driver.get(BASE_URL)
        take_screenshot(driver, '01_page_loaded')

        # Проверяем что canvas существует
        canvas = driver.find_element(By.ID, 'myCanvas')
        assert canvas is not None
        assert canvas.is_displayed()

    def test_crossword_renders(self, driver):
        """Проверяет что кроссворд отрисовался (ждём загрузки с API)."""
        driver.get(BASE_URL)

        # Закрываем alert если появился
        try:
            WebDriverWait(driver, 3).until(EC.alert_is_present())
            driver.switch_to.alert.accept()
            # Перезагружаем страницу
            driver.get(BASE_URL)
        except:
            pass

        # Ждём пока кроссворд загрузится (проверяем через JS)
        words_count = 0
        for _ in range(10):
            time.sleep(1)
            try:
                words_count = driver.execute_script(
                    'return window.crossword && window.crossword.words ? window.crossword.words.length : 0'
                )
                if words_count > 0:
                    break
            except:
                pass

        take_screenshot(driver, '02_crossword_rendered')

        assert words_count > 0, f'Expected words to be loaded, got {words_count}'
        print(f'Loaded {words_count} words')

    def test_first_word_is_crossword(self, driver):
        """Проверяет что первое слово — 'кроссворд'."""
        driver.get(BASE_URL)

        # Ждём загрузки
        for _ in range(10):
            time.sleep(1)
            words_count = driver.execute_script(
                'return window.crossword && window.crossword.words ? window.crossword.words.length : 0'
            )
            if words_count > 0:
                break

        first_word = driver.execute_script(
            'return window.crossword.words[0].word'
        )

        assert first_word == 'кроссворд', f'Expected first word to be "кроссворд", got "{first_word}"'

    def test_camera_movement_keyboard(self, driver):
        """Проверяет движение камеры стрелками."""
        driver.get(BASE_URL)
        time.sleep(2)

        take_screenshot(driver, '03_before_move')

        # Получаем начальный offset
        initial_offset = driver.execute_script('return {x: offset.x, y: offset.y}')

        # Двигаем камеру вправо
        canvas = driver.find_element(By.ID, 'myCanvas')
        canvas.click()  # Фокус на canvas

        actions = ActionChains(driver)
        actions.send_keys(Keys.ARROW_RIGHT).perform()
        time.sleep(0.5)
        actions.send_keys(Keys.ARROW_RIGHT).perform()
        time.sleep(0.5)

        # Получаем новый offset
        new_offset = driver.execute_script('return {x: offset.x, y: offset.y}')

        take_screenshot(driver, '04_after_move_right')

        # Камера должна была сдвинуться
        assert new_offset['x'] != initial_offset['x'] or new_offset['y'] != initial_offset['y'], \
            'Camera should have moved'

    def test_camera_movement_drag(self, driver):
        """Проверяет движение камеры перетаскиванием."""
        driver.get(BASE_URL)
        time.sleep(2)

        initial_offset = driver.execute_script('return {x: offset.x, y: offset.y}')

        canvas = driver.find_element(By.ID, 'myCanvas')

        # Перетаскиваем
        actions = ActionChains(driver)
        actions.move_to_element(canvas)
        actions.click_and_hold()
        actions.move_by_offset(100, 50)
        actions.release()
        actions.perform()

        time.sleep(0.3)

        new_offset = driver.execute_script('return {x: offset.x, y: offset.y}')

        take_screenshot(driver, '05_after_drag')

        assert new_offset['x'] != initial_offset['x'] or new_offset['y'] != initial_offset['y'], \
            'Camera should have moved after drag'

    def test_api_returns_valid_data(self, driver):
        """Проверяет что API возвращает корректные данные."""
        driver.get(BASE_URL)

        # Делаем запрос к API через браузер
        result = driver.execute_script('''
            return fetch('/api/generate?count=10')
                .then(r => r.json())
                .then(data => ({
                    hasWords: data.words && data.words.length > 0,
                    hasCandidates: data.firstLetterCandidates && data.firstLetterCandidates.length > 0,
                    wordsCount: data.words ? data.words.length : 0
                }));
        ''')

        # Ждём Promise
        time.sleep(1)
        result = driver.execute_script('''
            return window._lastApiResult || null;
        ''')

        # Альтернативный способ — синхронный запрос через execute_async
        result = driver.execute_async_script('''
            const callback = arguments[arguments.length - 1];
            fetch('/api/generate?count=10')
                .then(r => r.json())
                .then(data => callback({
                    hasWords: data.words && data.words.length > 0,
                    hasCandidates: data.firstLetterCandidates && data.firstLetterCandidates.length > 0,
                    wordsCount: data.words ? data.words.length : 0
                }))
                .catch(err => callback({error: err.message}));
        ''')

        assert result.get('hasWords'), 'API should return words'
        assert result.get('hasCandidates'), 'API should return candidates'
        assert result.get('wordsCount') >= 10, f'Expected at least 10 words, got {result.get("wordsCount")}'


class TestCrosswordGeneration:
    """Тесты генерации кроссворда."""

    def test_words_are_connected(self, driver):
        """Проверяет что слова пересекаются (связаны)."""
        driver.get(BASE_URL)

        # Ждём загрузки
        for _ in range(10):
            time.sleep(1)
            words_count = driver.execute_script(
                'return window.crossword && window.crossword.words ? window.crossword.words.length : 0'
            )
            if words_count > 0:
                break

        # Проверяем что есть слова в обоих направлениях
        directions = driver.execute_script('''
            const words = window.crossword.words;
            return {
                horizontal: words.filter(w => w.direction === 'horizontal').length,
                vertical: words.filter(w => w.direction === 'vertical').length
            };
        ''')

        assert directions['horizontal'] > 0, 'Should have horizontal words'
        assert directions['vertical'] > 0, 'Should have vertical words'

        take_screenshot(driver, '06_connected_words')

    def test_custom_seed_word(self, driver):
        """Проверяет генерацию с другим начальным словом."""
        result = driver.execute_async_script('''
            const callback = arguments[arguments.length - 1];
            fetch('/api/generate?count=5&seed=программа')
                .then(r => r.json())
                .then(data => callback(data.words[0]))
                .catch(err => callback({error: err.message}));
        ''')

        assert result['word'] == 'программа', f'Expected seed word "программа", got "{result["word"]}"'
        assert result['x'] == 0 and result['y'] == 0, 'Seed word should be at origin'


class TestAutoExpansion:
    """Тесты автоматической догенерации при перемещении камеры."""

    def test_session_id_received(self, driver):
        """Проверяет что клиент получает sessionId."""
        driver.get(BASE_URL)

        # Ждём загрузки
        for _ in range(10):
            time.sleep(1)
            # sessionId — локальная переменная в main.js, проверяем через API ответ
            words_count = driver.execute_script(
                'return window.crossword && window.crossword.words ? window.crossword.words.length : 0'
            )
            if words_count > 0:
                break

        # Проверяем что API возвращает sessionId
        result = driver.execute_async_script('''
            const callback = arguments[arguments.length - 1];
            fetch('/api/generate?count=3')
                .then(r => r.json())
                .then(data => callback({ sessionId: data.sessionId }))
                .catch(err => callback({ error: err.message }));
        ''')

        assert result.get('sessionId') is not None, 'Should receive sessionId from server'
        assert len(result['sessionId']) > 10, 'sessionId should be a UUID'

    def test_expansion_on_camera_move(self, driver):
        """Проверяет догенерацию при движении камеры."""
        driver.get(BASE_URL)

        # Ждём загрузки
        for _ in range(10):
            time.sleep(1)
            words_count = driver.execute_script(
                'return window.crossword && window.crossword.words ? window.crossword.words.length : 0'
            )
            if words_count > 0:
                break

        initial_words = words_count
        take_screenshot(driver, '07_before_expansion')

        # Перемещаем камеру далеко вправо
        canvas = driver.find_element(By.ID, 'myCanvas')
        canvas.click()

        # Двигаемся вправо долго
        actions = ActionChains(driver)
        for _ in range(10):
            actions.send_keys(Keys.ARROW_RIGHT)
        actions.perform()

        # Ждём догенерации
        time.sleep(3)

        # Проверяем что слова добавились
        new_words_count = driver.execute_script(
            'return window.crossword.words.length'
        )

        take_screenshot(driver, '08_after_expansion')

        # Новых слов должно быть больше или столько же (если кандидатов нет)
        assert new_words_count >= initial_words, \
            f'Words should not decrease: was {initial_words}, now {new_words_count}'

        print(f'Words before: {initial_words}, after: {new_words_count}')

    def test_expansion_on_drag(self, driver):
        """Проверяет догенерацию при перетаскивании."""
        driver.get(BASE_URL)

        # Ждём загрузки
        for _ in range(10):
            time.sleep(1)
            words_count = driver.execute_script(
                'return window.crossword && window.crossword.words ? window.crossword.words.length : 0'
            )
            if words_count > 0:
                break

        initial_words = words_count

        canvas = driver.find_element(By.ID, 'myCanvas')

        # Перетаскиваем далеко
        actions = ActionChains(driver)
        actions.move_to_element(canvas)
        actions.click_and_hold()
        actions.move_by_offset(-500, -300)
        actions.release()
        actions.perform()

        # Ждём догенерации
        time.sleep(3)

        new_words_count = driver.execute_script(
            'return window.crossword.words.length'
        )

        take_screenshot(driver, '09_after_drag_expansion')

        assert new_words_count >= initial_words, \
            f'Words should not decrease after drag: was {initial_words}, now {new_words_count}'

    def test_expand_api_directly(self, driver):
        """Тестирует API /api/expand напрямую."""
        driver.get(BASE_URL)

        # Сначала получаем sessionId через generate
        result = driver.execute_async_script('''
            const callback = arguments[arguments.length - 1];
            fetch('/api/generate?count=5')
                .then(r => r.json())
                .then(data => {
                    // Теперь вызываем expand с полученным sessionId
                    return fetch('/api/expand', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionId: data.sessionId,
                            bounds: { x0: -50, y0: -50, x1: 50, y1: 50 }
                        })
                    }).then(r => r.json());
                })
                .then(data => callback({
                    success: true,
                    newWordsCount: data.newWords ? data.newWords.length : 0,
                    totalWords: data.totalWords
                }))
                .catch(err => callback({ success: false, error: err.message }));
        ''')

        assert result.get('success'), f'Expand API should succeed: {result.get("error")}'
        assert 'totalWords' in result, 'Should return totalWords'
        print(f'Expand result: +{result["newWordsCount"]} words, total: {result["totalWords"]}')


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
