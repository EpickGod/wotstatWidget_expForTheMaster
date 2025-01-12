// Импорт модулей
const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Создание приложения
const app = express();
const port = 5000;

// Подключение CORS
app.use(cors());

// Переменная для хранения данных
let tanks_data = [];

// Функция парсинга данных с сайта
const extractTanksData = async () => {
    try {
        const response = await axios.get('https://protanki.tv/ru/stats/masters');
        // Регулярное выражение для извлечения JSON-подобной строки
        const regex = /window\.statistics=\{.*?originalData:\s*(\[.*?\]),?/;
        const match = response.data.match(regex);

        if (match && match[1]) {
            const jsonString = match[1];
            try {
                const tanksData = JSON.parse(jsonString);
                if (tanksData && tanksData.length > 0) {
                    const extractedData = tanksData.map(tank => ({
                        ru: tank.short_name?.ru,
                        aceTanker: tank.aceTanker
                    }));
                    console.log(`Запарсено ${extractedData.length} элементов`);
                    return extractedData;
                } else {
                    console.log("Массив tanksData пустой.");
                    return [];
                }
            } catch (error) {
                console.error("Ошибка парсинга JSON:", error);
                console.log("JSON string:", jsonString);
                return [];
            }
        } else {
            console.log("Не удалось извлечь строку с данными.");
            return [];
        }
    } catch (error) {
          if (axios.isAxiosError(error)) {
           console.error('Ошибка при получении страницы:', error.message);
        }
         else {
            console.error('Неизвестная ошибка:', error);
       }
        return [];
    }
};

// Инициализация (вызов парсинга при запуске)
async function initialize() {
    tanks_data = await extractTanksData();
}

initialize();

// Эндпоинт /api/find-tank
app.get('/api/find-tank', (req, res) => {
    const tankName = req.query.tankName;
    const foundTank = tanks_data.find(tank => tank.ru === tankName);
    if (foundTank) {
         console.log(`Найдена информация для танка ${tankName}: `, foundTank);
        res.json(foundTank)
    } else {
      console.log(`Танк ${tankName} не найден.`);
      res.status(404).json({ error: `Танк ${tankName} не найден.` });
    }
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});