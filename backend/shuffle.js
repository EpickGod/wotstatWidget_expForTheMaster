const fs = require('fs');
const path = require('path');

// Функция для перемешивания массива
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Основная функция
function shuffleData() {
    const inputFilePath = path.join(__dirname, 'output_v2.json'); // Файл с исходными данными
    const outputFilePath = path.join(__dirname, 'output_shuffled_v2.json'); // Файл для сохранения перемешанных данных

    try {
        // Читаем данные из файла
        const fileContent = fs.readFileSync(inputFilePath, 'utf-8');

        // Разделяем содержимое файла на строки
        const lines = fileContent.trim().split('\n');

        // Парсим каждую строку как JSON, пропуская пустые строки и некорректные данные
        const data = lines
            .filter(line => line.trim() !== '') // Убираем пустые строки
            .map(line => {
                try {
                    return JSON.parse(line); // Пытаемся распарсить строку как JSON
                } catch (error) {
                    console.error('Ошибка при парсинге строки:', error.message);
                    return null; // Пропускаем некорректные строки
                }
            })
            .filter(item => item !== null); // Убираем null из результата

        // Перемешиваем данные
        const shuffledData = shuffleArray(data);

        // Преобразуем массив JSON-объектов в строку с запятыми и квадратными скобками
        const jsonArray = JSON.stringify(shuffledData, null, 2);

        // Сохраняем перемешанные данные в новый файл
        fs.writeFileSync(outputFilePath, jsonArray);

        console.log('Данные перемешаны и сохранены в output_shuffled_v2.json');
    } catch (error) {
        console.error('Ошибка при обработке файла:', error);
    }
}

// Запуск функции
shuffleData();