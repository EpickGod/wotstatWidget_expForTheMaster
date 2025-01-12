const express = require('express');
const cors = require('cors');
const { ClickHouse } = require('clickhouse');

const app = express();
const port = 5000;

app.use(cors());

const clickhouse = new ClickHouse({
    url: 'http://db.wotstat.info',
    port: 80,
    basicAuth: {
        username: 'public',
        password: '',
    },
    database: 'default',
});

app.get('/data', async (req, res) => {
    try {
        const data = await clickhouse.query(`
            SELECT
                    AVG(xp) AS avg_xp,
                    AVG(damage) AS avg_damage
                FROM
                    battle.efficiency
            LIMIT 1;
        `).toPromise();

        res.json(data);
    } catch (error) {
        console.error('Ошибка при запросе к ClickHouse:', error);
        res.status(500).json({ error: 'Ошибка получения данных из ClickHouse' });
    }
});

app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});