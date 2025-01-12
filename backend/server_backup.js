const express = require('express');
const cors = require('cors');
const { createClient } = require('@clickhouse/client');
const debug = require('debug')('server');
const axios = require('axios');

const app = express();
const port = 5000;

app.use(cors());

const clickhouse = createClient({
    url: 'http://db.wotstat.info',
    port: 80,
    username: 'public',
    password: '',
    database: 'WOT'
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Переменная для хранения спарсенных данных
let tanks_data = [];


const extractTanksData = async () => {
    try {
        await delay(5000);
        const response = await axios.get('https://protanki.tv/ru/stats/masters');
        const html = response.data;
        // Регулярное выражение для извлечения JSON-подобной строки
        const regex = /window\.statistics=\{.*?originalData:\s*(\[.*?\]),?/;
        const match = html.match(regex);

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


app.get('/tanks', (req, res) => {
    res.json(tanks_data);
});

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


app.get('/data', async (req, res) => {
    try {
        const data = await clickhouse.query({
            query: `
        SELECT
            Event_OnBattleResult.playerName,
            Event_OnBattleResult.result,
            Event_OnBattleResult.credits,
            Event_OnBattleResult.personal.damageDealt,
            TankList.shortNameRU
        FROM
            Event_OnBattleResult join TankList on Event_OnBattleResult.tankTag=TankList.tag
        WHERE
            playerName = 'FoxSergio'
        ORDER BY
            dateTime
        DESC LIMIT 1
      `
        });
        res.json(await data.json());
    } catch (error) {
        console.error(error);
        debug('Ошибка при запросе к ClickHouse:', error);
        res.status(500).json({ error: 'Ошибка получения данных из ClickHouse', details: error.message });
    }
});


app.listen(port, () => {
    debug(`Сервер запущен на http://localhost:${port}`);
});