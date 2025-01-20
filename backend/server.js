const express = require('express');
const cors = require('cors');
const axios = require('axios');
const brain = require('brain.js');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@clickhouse/client');

const clickhouse = createClient({
  url: 'http://db.wotstat.info',
  port: 80,
  username: 'public',
  password: '',
  database: 'WOT'
});

const app = express();

const port = process.env.PORT || 5000;

app.use(cors({
  origin: 'http://localhost:3000', // Разрешить запросы только с этого домена
  credentials: true
}));
app.use(express.json());

//====================================С Т А Т И С Т И К А ==================================//
// Запрос к ClickHouse с динамическим tankTag
app.get('/api/statistics', async (req, res) => {
  try {
      const tankTag = req.query.tankTag;
      console.log(`Запрос: tankTag = ${tankTag}`);
       const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const formattedDate = fourteenDaysAgo.toISOString().slice(0, 10);
      let query = `
        SELECT 
          personal.damageDealt + personal.damageAssistedRadio as totalDamage,
          dateTime
        FROM 
          Event_OnBattleResult
        WHERE 
          playerName = 'FoxSergio'
          AND dateTime >= '${formattedDate}'
      `;
      if (tankTag) {
          query += ` AND tankTag = '${tankTag}' ORDER BY dateTime`;
      }
      console.log("ClickHouse query:", query);
      const result = await clickhouse.query({ query, format: 'JSONEachRow' });
      const rows = await result.json();
      res.json(rows);
  } catch (error) {
       console.error('Ошибка при запросе к ClickHouse:', error);
      res.status(500).json({ error: 'Ошибка при запросе к ClickHouse', details: error.message });
  }
});


// Прокси для запросов к poliroid.me
app.get('/api/gunmarks-proxy', async (req, res) => {
  try {
       console.log('Making request to poliroid.me')
      const response = await axios.get('https://poliroid.me/gunmarks/');
      res.json(response.data);
  } catch (error) {
      console.error('Ошибка при запросе к poliroid.me:', error);
       res.status(500).json({ error: 'Ошибка при запросе к poliroid.me', details: error.message });
  }
});

let tanks_data_masters = [];
let tanks_data_marks = [];
let tanks_list = [];


// One-Hot Encoding для ролей
const roles = {
    "role_MT_support": 0,
    "role_MT_universal": 1,
    "role_HT_universal": 2,
    "role_HT_break": 3,
    "role_LT_wheeled": 4,
    "role_ATSPG_assault": 5,
    "role_HT_assault": 6,
    "role_MT_sniper": 7,
    "role_MT_assault": 8,
    "role_ATSPG_support": 9,
    "role_SPG": 10,
    "role_ATSPG_universal": 11,
    "role_ATSPG_sniper": 12,
    "role_HT_support": 13,
    "role_LT_universal": 14,
    "role_SPG_flame": 15,
    "role_SPG_assault": 16
};

const totalRoles = Object.keys(roles).length;

function oneHotEncode(role) {
    const vector = new Array(totalRoles).fill(0);
    vector[roles[role]] = 1;
    return vector;
}


// Функция для загрузки данных с сайта (используем асинхронную функцию) для мастеров
async function loadDataFromWebsiteMasters() {
    try {
      const response = await axios.get('https://protanki.tv/ru/stats/masters');
      const regex = /window\.statistics=\{.*?originalData:\s*(\[.*?\]),?/;
      const match = response.data.match(regex);

      if (match && match[1]) {
        const tanksData = JSON.parse(match[1]);

          if (tanksData && tanksData.length > 0) {
            return tanksData.map(tank => ({
              ru: tank.short_name?.ru,
              aceTanker: tank.aceTanker
            }));
          }
      }
      return [];

    } catch (error) {
      console.error('Ошибка при загрузке данных о мастерах:', error.message);
      return [];
    }
  }

// Функция для загрузки данных с сайта (используем асинхронную функцию) для отметок
async function loadDataFromWebsiteMarks() {
  try {
    const response = await axios.get('https://protanki.tv/ru/stats/marks');
    const regex = /window\.statistics=\{.*?originalData:\s*(\[.*?\]),?/;
    const match = response.data.match(regex);

    if (match && match[1]) {
      const tanksData = JSON.parse(match[1]);

      if (tanksData && tanksData.length > 0) {
        return tanksData.map(tank => ({
          ru: tank.short_name?.ru,
          mark65: tank.mark65,
          mark85: tank.mark85,
          mark95: tank.mark95
        }));
      }
    }
    return [];

  } catch (error) {
    console.error('Ошибка при загрузке данных об отметках:', error.message);
      return [];
  }
}
// Функция для загрузки данных с сайта (используем асинхронную функцию) для списка танков
async function loadDataFromWebsiteTanks() {
    try {
        const response = await axios.get('https://protanki.tv/ru/vehicles');
        const regex = /window\.vehicles=(.*?);/;
        const match = response.data.match(regex);

        if (match && match[1]) {
            const tanksData = JSON.parse(match[1]);

            if (tanksData && tanksData.length > 0) {
                return tanksData.map(tank => ({
                    ru: tank.short_name?.ru,
                    level: tank.level,
                    role: `role_${tank.type}_${tank.role}`
                }));
            }
        }
        return [];

    } catch (error) {
        console.error('Ошибка при загрузке списка танков:', error.message);
        return [];
    }
}
// Инициализация данных при запуске
async function initializeData() {
  tanks_data_masters = await loadDataFromWebsiteMasters();
  tanks_data_marks = await loadDataFromWebsiteMarks();
    tanks_list = await loadDataFromWebsiteTanks();

    if (tanks_data_marks && tanks_data_marks.length > 0) {
      console.log("Данные об отметках загружены");
    } else {
       console.log("Массив tanks_data_marks пуст или не инициализирован");
    }
  if (tanks_list && tanks_list.length > 0) {
    console.log("Данные о танках загружены");
    } else {
        console.log("Массив tanks_list пуст или не инициализирован");
    }

}

initializeData();

// Загрузка модели
function loadModel() {
    const modelPath = './model_128_64_32_16_new.json';
    try {
        const modelState = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
        const net = new brain.NeuralNetwork();
        net.fromJSON(modelState);
        return net;
    } catch (error) {
        console.error("Ошибка при загрузке модели:", error);
        return null;
    }
}

const net = loadModel()


// Эндпоинт /api/find-tank (мастер)
app.get('/api/find-tank', async (req, res) => {
    const tankName = req.query.tankName;
  const foundTank = tanks_data_masters.find(tank => tank.ru === tankName);
    if (foundTank) {
        res.json(foundTank);
    } else {
        res.status(404).json({ error: 'Танк не найден' });
    }
});


// Эндпоинт /api/find-tank-marks (отметки)
app.get('/api/find-tank-marks', async (req, res) => {
    const tankName = req.query.tankName;
  const foundTank = tanks_data_marks.find(tank => tank.ru === tankName);
    if (foundTank) {
        res.json(foundTank);
    } else {
        res.status(404).json({ error: 'Танк не найден' });
    }
});

// Эндпоинт для получения списка танков
app.get('/api/find-all-tanks', async (req, res) => {
     if (tanks_list && tanks_list.length > 0) {
         res.json(tanks_list);
     } else {
         res.status(404).json({ error: 'Список танков не найден' });
     }

});


app.post('/api/predict-xp', (req, res) => {
  console.log('Получен запрос:', req.body); // Логирование тела запроса

  if (!req.body) {
    return res.status(400).json({ error: 'Тело запроса отсутствует' });
  }

  const inputData = req.body;

  if (!inputData.visibleLevels) {
    return res.status(400).json({ error: 'Поле visibleLevels отсутствует' });
  }

  try {
    const normalizedInput = {
      visibleLevels: inputData.visibleLevels / 10,
      tankLevel: inputData.tankLevel / 10,
      spotted: inputData["personal.spotted"] / 15,
      damageBlocked: inputData["personal.damageBlockedByArmor"] / 15000,
      damageAssisted: inputData["personal.damageAssistedRadio"] / 20000,
      damageDealt: inputData["personal.damageDealt"] / 10000,
      damaged: inputData["personal.damaged"] / 10,
      kills: inputData["personal.kills"] / 15,
      isAlive: inputData["personal.isAlive"] ? 1 : 0,
      result: inputData.result === "win" ? 1 : 0,
      role: oneHotEncode(inputData.tankRole)
    };

    console.log('Нормализованные данные:', normalizedInput); // Логирование нормализованных данных

    if (!net) {
      return res.status(500).json({ error: 'Модель не загружена' });
    }

    const input = [
      normalizedInput.visibleLevels,
      normalizedInput.tankLevel,
      normalizedInput.spotted,
      normalizedInput.damageBlocked,
      normalizedInput.damageAssisted,
      normalizedInput.damageDealt,
      normalizedInput.damaged,
      normalizedInput.kills,
      normalizedInput.isAlive,
      normalizedInput.result,
      ...normalizedInput.role
    ];

    const predictedNormalizedXP = net.run(input);
    const predictedXP = predictedNormalizedXP[0] * 2500;
    res.json({ predictedXP });
  } catch (error) {
    console.error('Ошибка в обработчике /api/predict-xp:', error);
    res.status(500).send('Internal Server Error'); // Или более информативное сообщение
  }
});


// Обслуживание статических файлов
app.use(express.static(path.join(__dirname, '..', 'build')));

// Обработка всех остальных запросов и возврат index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
});

app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});