// Импорт библиотек
import React, { useState, useEffect, useRef } from 'react';
import { WidgetSDK } from 'wotstat-widgets-sdk';
import styles from './PlayerStatsWidget.module.css';
import axios from 'axios';
import aceImage from './assets/ace.png';

// Компонент PlayerStatsWidget
function PlayerStatsWidget() {
    // Состояние
    const [tankData, setTankData] = useState(null);
    const previousTankName = useRef('');

    // useEffect - при монтировании компонента
    useEffect(() => {
        // Создание экземпляра WidgetSDK
        const sdk = new WidgetSDK();

        // Получение начальных данных о танке
        const initialTank = sdk.data?.hangar?.vehicle?.info?.value;
         if (initialTank && initialTank.localizedShortName) {
            const tankName = initialTank.localizedShortName;
            previousTankName.current = tankName;
            fetchTankData(tankName);
        }

       // Подписка на изменения танка
        sdk.data?.hangar?.vehicle?.info?.watch(async (newValue) => {
            if (newValue && newValue.localizedShortName) {
                const newTankName = newValue.localizedShortName;
                 if (newTankName !== previousTankName.current) {
                    previousTankName.current = newTankName;
                     fetchTankData(newTankName);
                }
           }
        });
    }, []);

    // Функция для получения данных о танке с сервера
    const fetchTankData = async (newTankName) => {
        try {
           const response = await axios.get(
                `http://localhost:5000/api/find-tank?tankName=${newTankName}`
            );

         } catch (error) {
           console.error('Ошибка при запросе к API:', error);
           setTankData(null);
        }
    };

    // Возврат JSX
    return (
        <div className={styles.main}>
            {tankData ? (
                <div className={styles.container}>
                    <img src={aceImage} alt="Знак мастера" className={styles.masterImage} />
                    <div className={styles.experience}>{tankData.aceTanker}</div>
                </div>
            ) : (
                <p className={styles.experience}>Загрузка...</p>
            )}
        </div>
    );
}

export default PlayerStatsWidget;