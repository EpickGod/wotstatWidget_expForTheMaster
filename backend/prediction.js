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
  if (!roles.hasOwnProperty(role)) {
    throw new Error(`Unknown role: ${role}`);
  }
  const vector = new Array(totalRoles).fill(0); // Создаем вектор из нулей
  vector[roles[role]] = 1; // Устанавливаем 1 на нужной позиции
  return vector;
}

// Логарифмическая нормализация
function logNormalize(value) {
  return Math.log(value + 1); // Добавляем 1, чтобы избежать log(0)
}

// Логарифмическая денормализация
function logDenormalize(normalizedValue) {
  return Math.exp(normalizedValue) - 1;
}

// Загрузка модели и предсказание
function loadModelAndPredict(modelPath, inputData) {
  const modelState = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
  const net = new brain.NeuralNetwork();
  net.fromJSON(modelState);

  // Нормализация входных данных
  const normalizedInput = {
    tankLevel: inputData.tankLevel / 10, // Уровень танка нормализуем делением на 10
    spotted: inputData["personal.spotted"] / 15, // Обнаружение нормализуем делением на 15
    damageBlocked: logNormalize(inputData["personal.damageBlockedByArmor"]), // Логарифмическая нормализация
    damageAssisted: logNormalize(inputData["personal.damageAssistedRadio"]), // Логарифмическая нормализация
    damageDealt: logNormalize(inputData["personal.damageDealt"]), // Логарифмическая нормализация
    damaged: inputData["personal.damaged"] / 10, // Полученный урон нормализуем делением на 10
    kills: inputData["personal.kills"] / 15, // Убийства нормализуем делением на 15
    isAlive: inputData["personal.isAlive"] ? 1 : 0, // Булевый признак
    result: inputData.result === "win" ? 1 : 0, // Победа или поражение
    role: oneHotEncode(inputData.tankRole) // One-Hot Encoding для роли
  };

  // Подготовка входных данных для модели
  const input = [
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

  // Предсказание
  const predictedNormalizedXP = net.run(input);
  const predictedXP = logDenormalize(predictedNormalizedXP[0]); // Денормализация
  console.log("Предсказанное XP:", predictedXP);
}

// Основная функция
function main() {
  const modelPath = './model.json'; // Путь к сохраненной модели

  // Пример новых данных для предсказания
  const newData = {
    tankLevel: 8,
    "personal.spotted": 0,
    "personal.damageBlockedByArmor": 0,
    "personal.damageAssistedRadio": 1540,
    "personal.damageDealt": 10000,
    "personal.damaged": 15,
    "personal.kills": 10,
    "personal.isAlive": false,
    result: "win", // Победа или поражение
    tankRole: "role_LT_universal"
  };

  try {
    // Загрузка модели и предсказание
    loadModelAndPredict(modelPath, newData);
  } catch (error) {
    console.error("Произошла ошибка:", error);
  }
}

// Запуск
main();