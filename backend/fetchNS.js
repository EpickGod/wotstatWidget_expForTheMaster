const { createClient } = require('@clickhouse/client');
const fs = require('fs');
const path = require('path');

// Подключение к ClickHouse
const clickhouse = createClient({
    url: 'http://db.wotstat.info',
    port: 80,
    username: 'public',
    password: '',
    database: 'WOT'
});

// Лимиты
const LIMITS = {
    PER_MINUTE: {
        REQUESTS: 240, // Максимум 240 запросов в минуту
        EXECUTION_TIME: 20 // Максимум 20 секунд выполнения в минуту
    },
    PER_HOUR: {
        REQUESTS: 2000, // Максимум 2000 запросов в час
        EXECUTION_TIME: 600 // Максимум 600 секунд выполнения в час
    },
    PER_DAY: {
        REQUESTS: 5000, // Максимум 5000 запросов в день
        EXECUTION_TIME: 2000 // Максимум 2000 секунд выполнения в день
    }
};

// Настройки
const QUERY_SETTINGS = {
    LIMIT: 2000 // Количество строк, возвращаемых в одном запросе (можно изменить)
};

// Счётчики
let counters = {
    minute: { requests: 0, executionTime: 0 },
    hour: { requests: 0, executionTime: 0 },
    day: { requests: 0, executionTime: 0 }
};

// Функция для выполнения запроса с учётом лимитов
async function executeQueryWithLimits(query, filePath, queryNumber, totalQueries) {
    const startTime = Date.now();

    try {
        // Выполняем запрос с указанием формата JSONEachRow
        const resultSet = await clickhouse.query({
            query: query,
            format: 'JSONEachRow' // Указываем формат ответа
        });

        // Получаем данные как текст
        const data = await resultSet.text();

        // Дописываем данные в файл
        fs.appendFileSync(filePath, data + '\n');

        const executionTime = (Date.now() - startTime) / 1000; // Время выполнения в секундах
        updateCounters(executionTime);

        // Подсчитываем количество строк
        const rowCount = data.split('\n').filter(line => line.trim() !== '').length;

        console.log(`Запрос ${queryNumber}/${totalQueries} выполнен. Скопировано строк: ${rowCount}`);
        return rowCount; // Возвращаем количество строк
    } catch (error) {
        console.error(`Ошибка при выполнении запроса ${queryNumber}/${totalQueries}:`, error);
        return 0; // В случае ошибки возвращаем 0
    }
}

// Функция для обновления счётчиков
function updateCounters(executionTime) {
    counters.minute.requests++;
    counters.minute.executionTime += executionTime;

    counters.hour.requests++;
    counters.hour.executionTime += executionTime;

    counters.day.requests++;
    counters.day.executionTime += executionTime;

    // Сброс счётчиков каждую минуту
    setTimeout(() => {
        counters.minute = { requests: 0, executionTime: 0 };
    }, 60000);

    // Сброс счётчиков каждый час
    setTimeout(() => {
        counters.hour = { requests: 0, executionTime: 0 };
    }, 3600000);

    // Сброс счётчиков каждый день
    setTimeout(() => {
        counters.day = { requests: 0, executionTime: 0 };
    }, 86400000);
}

// Функция для проверки лимитов
function checkLimits() {
    if (counters.minute.requests >= LIMITS.PER_MINUTE.REQUESTS ||
        counters.minute.executionTime >= LIMITS.PER_MINUTE.EXECUTION_TIME) {
        console.log('Лимит запросов или времени выполнения за минуту превышен. Ожидание...');
        return false;
    }

    if (counters.hour.requests >= LIMITS.PER_HOUR.REQUESTS ||
        counters.hour.executionTime >= LIMITS.PER_HOUR.EXECUTION_TIME) {
        console.log('Лимит запросов или времени выполнения за час превышен. Ожидание...');
        return false;
    }

    if (counters.day.requests >= LIMITS.PER_DAY.REQUESTS ||
        counters.day.executionTime >= LIMITS.PER_DAY.EXECUTION_TIME) {
        console.log('Лимит запросов или времени выполнения за день превышен. Ожидание...');
        return false;
    }

    return true;
}

// Основная функция
async function main() {
    const startTime = Date.now(); // Начальное время выполнения
    const filePath = path.join(__dirname, 'output_v2.json');
    const tankLevels = [10, 9, 8, 7, 6]; // Уровни танков
    const tankRoles = [
        'role_MT_support',
        'role_MT_universal',
        'role_HT_universal',
        'role_HT_break',
        'role_LT_wheeled',
        'role_ATSPG_assault',
        'role_HT_assault',
        'role_MT_sniper',
        'role_MT_assault',
        'role_ATSPG_support',
        'role_SPG',
        'role_ATSPG_universal',
        'role_ATSPG_sniper',
        'role_HT_support',
        'role_LT_universal',
        'role_SPG_flame',
        'role_SPG_assault'
    ]; // Роли танков (без 'NotDefined')

    // Очищаем файл перед началом записи
    fs.writeFileSync(filePath, '');

    let queryNumber = 1;
    let totalRows = 0; // Общее количество скопированных строк
    const totalQueries = tankLevels.length * tankRoles.length; // Общее количество запросов

    // Выполняем запросы для каждого уровня и каждой роли
    for (const level of tankLevels) {
        for (const role of tankRoles) {
            const query = `
                SELECT
                    visibleLevels[1] AS visibleLevels,
                    tankRole,
                    result,
                    tankLevel,
                    personal.spotted,
                    personal.damageBlockedByArmor,
                    personal.damageAssistedRadio,
                    personal.damageDealt,
                    personal.damaged,
                    personal.kills,
                    personal.isAlive,
                    personal.xp
                FROM
                    Event_OnBattleResult
                WHERE
                    battleMode = 'REGULAR'
                    AND tankRole = '${role}'
                    AND tankLevel = '${level}'
                    AND modVersion_minor >= 4
                    AND personal.damageDealt <= 10000
                    AND personal.damageAssistedRadio <= 20000
                    AND personal.damageBlockedByArmor <= 15000
                    AND personal.spotted <= 15
                    AND personal.kills <= 15
                    AND personal.xp <= 2500
                    AND result !='tie'
                ORDER BY
                    dateTime
                DESC LIMIT ${QUERY_SETTINGS.LIMIT}
            `;

            // Проверяем лимиты перед выполнением запроса
            while (!checkLimits()) {
                await new Promise(resolve => setTimeout(resolve, 10000)); // Ожидание 10 секунд
            }

            const rowsCopied = await executeQueryWithLimits(query, filePath, queryNumber, totalQueries);
            totalRows += rowsCopied; // Суммируем количество строк
            queryNumber++;
        }
    }

    const endTime = Date.now(); // Конечное время выполнения
    const executionTime = (endTime - startTime) / 1000; // Время выполнения в секундах

    console.log('Все запросы выполнены.');
    console.log(`Общее количество скопированных строк: ${totalRows}`);
    console.log(`Время выполнения: ${executionTime.toFixed(2)} секунд`);
}

// Запуск основной функции
main();