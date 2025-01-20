const brain = require('brain.js');
const fs = require('fs');

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

const totalRoles = Object.keys(roles).length; // Общее количество ролей (17)

function oneHotEncode(role) {
  const vector = new Array(totalRoles).fill(0); // Создаем вектор из нулей
  vector[roles[role]] = 1; // Устанавливаем 1 на нужной позиции
  return vector;
}

// Загрузка данных из файла
function loadData(filePath) {
  const rawData = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(rawData);
}

// Нормализация данных
function normalizeData(data) {
  return data.map(item => ({
    visibleLevels: item.visibleLevels / 10, // Берем первое значение и нормализуем
    tankLevel: item.tankLevel / 10, // Нормализуем уровень танка (максимум 10)  
    spotted: item["personal.spotted"] / 15, // Нормализуем количество обнаруженных врагов
    damageBlocked: item["personal.damageBlockedByArmor"] / 15000, // Нормализуем заблокированный урон (максимум 15000)
    damageAssisted: item["personal.damageAssistedRadio"] / 20000, // Нормализуем урон с помощью радио (максимум 20000)
    damageDealt: item["personal.damageDealt"] / 10000, // Нормализуем нанесенный урон (максимум 10000)
    damaged: item["personal.damaged"] / 10, // Нормализуем количество полученного урона
    kills: item["personal.kills"] / 15, // Нормализуем количество убийств
    isAlive: item["personal.isAlive"] ? 1 : 0, // Преобразуем булевый признак в числовой
    result: item.result === "win" ? 1 : 0, // Преобразуем результат боя в числовой формат
    role: oneHotEncode(item.tankRole), // One-Hot Encoding для роли
    xp: item["personal.xp"] / 2500 // Нормализуем целевой признак (XP)
  }));
}

// Разделение данных на обучающую и тестовую выборки
function splitData(data, trainRatio = 0.8) {
  const numTrain = Math.floor(data.length * trainRatio); // 80% данных
  const shuffled = data.sort(() => Math.random() - 0.5); // Перемешиваем данные
  return {
    train: shuffled.slice(0, numTrain), // Обучающая выборка
    test: shuffled.slice(numTrain) // Тестовая выборка
  };
}

// Создание и обучение модели
function trainAndSaveModel(data, savePath) {
  const { train, test } = splitData(data); // Разделяем данные

  const normalizedTrain = normalizeData(train);
  const normalizedTest = normalizeData(test);

  // Подготовка данных для обучения
  const trainingData = normalizedTrain.map(item => ({
    input: [
      item.visibleLevels, // Добавляем нормализованное значение visibleLevels
      item.tankLevel,
      item.spotted,
      item.damageBlocked,
      item.damageAssisted,
      item.damageDealt,
      item.damaged,
      item.kills,
      item.isAlive,
      item.result, // Добавляем результат боя
      ...item.role
    ],
    output: [item.xp]
  }));

  // Создаем модель
  const net = new brain.NeuralNetwork({
    hiddenLayers: [128, 64, 32, 16] // Архитектура сети: 3 скрытых слоя
  });

  console.log("Начало обучения...");

  // Обучение модели
  net.train(trainingData, {
    iterations: 500, // Количество итераций
    errorThresh: 0.00001, // Порог ошибки
    log: true, // Вывод логов
    logPeriod: 1, // Логирование каждую итерацию
    callback: (info) => {
      console.time('iterationTime'); // Начинаем отсчет времени для итерации
      console.log(`Итерация ${info.iterations}, Ошибка: ${info.error}`);
      console.timeEnd('iterationTime'); // Завершаем отсчет времени для итерации

      // Сохраняем модель каждые 20 итераций
      if (info.iterations % 20 === 0) {
        const modelState = net.toJSON();
        const savePathIteration = `./model_iteration_${info.iterations}.json`;
        fs.writeFileSync(savePathIteration, JSON.stringify(modelState));
        console.log(`Модель сохранена на итерации ${info.iterations} в ${savePathIteration}`);
      }
    }
  });

  console.log("Обучение завершено!");

  // Оценка модели на тестовой выборке
  const testResults = normalizedTest.map(item => {
    const output = net.run([
      item.visibleLevels, // Добавляем нормализованное значение visibleLevels
      item.tankLevel,
      item.spotted,
      item.damageBlocked,
      item.damageAssisted,
      item.damageDealt,
      item.damaged,
      item.kills,
      item.isAlive,
      item.result, // Добавляем результат боя
      ...item.role
    ]);
    return {
      predicted: output[0] * 2500, // Денормализация
      actual: item.xp * 2500
    };
  });

  console.log("Результаты на тестовой выборке:", testResults);

  // Сохраняем модель
  const modelState = net.toJSON();
  fs.writeFileSync(savePath, JSON.stringify(modelState));
  console.log(`Модель сохранена в ${savePath}`);
}

// Загрузка модели и предсказание
function loadModelAndPredict(modelPath, inputData) {
  const modelState = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
  const net = new brain.NeuralNetwork();
  net.fromJSON(modelState);

  // Нормализация входных данных
  const normalizedInput = {
    visibleLevels: inputData.visibleLevels / 10, // Берем первое значение и нормализуем
    tankLevel: inputData.tankLevel / 10,
    spotted: inputData["personal.spotted"] / 15,
    damageBlocked: inputData["personal.damageBlockedByArmor"] / 15000, // Нормализуем заблокированный урон
    damageAssisted: inputData["personal.damageAssistedRadio"] / 20000, // Нормализуем урон с помощью радио
    damageDealt: inputData["personal.damageDealt"] / 10000, // Нормализуем нанесенный урон
    damaged: inputData["personal.damaged"] / 10,
    kills: inputData["personal.kills"] / 15,
    isAlive: inputData["personal.isAlive"] ? 1 : 0,
    result: inputData.result === "win" ? 1 : 0, // Преобразуем результат боя
    role: oneHotEncode(inputData.tankRole)
  };

  // Подготовка входных данных для модели
  const input = [
    normalizedInput.visibleLevels, // Добавляем нормализованное значение visibleLevels
    normalizedInput.tankLevel, 
    normalizedInput.spotted,
    normalizedInput.damageBlocked,
    normalizedInput.damageAssisted,
    normalizedInput.damageDealt,
    normalizedInput.damaged,
    normalizedInput.kills,
    normalizedInput.isAlive,
    normalizedInput.result, // Добавляем результат боя
    ...normalizedInput.role
  ];

  // Предсказание
  const predictedNormalizedXP = net.run(input);
  const predictedXP = predictedNormalizedXP[0] * 2500; // Денормализация
  console.log("Предсказанное XP:", predictedXP);
}

// Основная функция
function main() {
  const dataFilePath = './output_shuffled_v2.json'; // Путь к файлу с данными
  const modelSavePath = './model_128_64_32_16_new.json'; // Путь для сохранения модели

  try {
    // Загрузка данных
    const data = loadData(dataFilePath);
    console.log("Данные успешно загружены.");

    // Обучение и сохранение модели
    trainAndSaveModel(data, modelSavePath);

    // Пример предсказания на новых данных
    const newData = {
      visibleLevels: 10, // Пример входных данных для visibleLevels
      tankLevel: 9,
      "personal.spotted": 2,
      "personal.damageBlockedByArmor": 1880,
      "personal.damageAssistedRadio": 0,
      "personal.damageDealt": 2044,
      "personal.damaged": 2,
      "personal.kills": 1,
      "personal.isAlive": false,
      result: "lose", // Пример результата боя
      tankRole: "role_HT_break"
    };

    // Загрузка модели и предсказание
    loadModelAndPredict(modelSavePath, newData);
  } catch (error) {
    console.error("Произошла ошибка:", error);
  }
}

// Запуск
main();