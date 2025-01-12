import React, { useState, useEffect, useRef } from 'react';
import { WidgetSDK } from 'wotstat-widgets-sdk';
import styles from './PlayerStatsWidget.module.css';
import axios from 'axios';

function PlayerStatsWidget() {
    const [tankName, setTankName] = useState('');
    const [doissierMy, doissierMyF] = useState('');
    const [effDamage, efD] = useState('');
    const [playerData, setPlayerData] = useState(null);
    const [tankData, setTankData] = useState(null);
    const previousTankName = useRef(''); // Для сравнения текущего имени с предыдущим


    useEffect(() => {
        const sdk = new WidgetSDK();

        const initialTank = sdk.data?.hangar?.vehicle?.info?.value;
         if (initialTank && initialTank.localizedShortName) {
              setTankName(initialTank.localizedShortName)
            previousTankName.current = initialTank.localizedShortName
             fetchTankData(initialTank.localizedShortName);

        }

        sdk.data?.hangar?.vehicle?.info?.watch(async (newValue) => {
            if (newValue && newValue.localizedShortName) {
                const newTankName = newValue.localizedShortName;
                if(newTankName !== previousTankName.current){ // Сравниваем старое и новое имя
                    setTankName(newTankName);
                    previousTankName.current = newTankName;  // Обновляем старое имя
                     fetchTankData(newTankName)
                }
            }
        });

        const d = sdk.data?.hangar?.vehicle?.xp?.value;
        doissierMyF(d);

        sdk.data?.hangar?.vehicle?.xp?.watch((cr) => {
            doissierMyF(cr);
        });

        const e = sdk.data?.battle?.efficiency?.damage?.value;
        efD(e);

        sdk.data?.battle?.efficiency?.damage?.watch((ed) => {
            efD(ed);
        });


        const fetchData = async () => {
            try {
                const response = await axios.get('http://localhost:5000/data');
                if (response.data ) {
                    setPlayerData(JSON.parse(JSON.stringify(response.data.data[0])));
                }
            } catch (error) {
                console.error('Ошибка при запросе к API:', error);
            }
        };

        fetchData();

    }, []);


    const fetchTankData = async (newTankName) => {
        try{
            const response = await axios.get(`http://localhost:5000/api/find-tank?tankName=${newTankName}`);
            setTankData(response.data);
            console.log(`Информация о танке ${newTankName}: `, response.data);
        } catch (error) {
            console.error(`Ошибка при запросе к API для танка ${newTankName}:`, error);
            setTankData(null)
        }
    }


    return (
        <div className={`widgets-sdk-styles ${styles.autoscale}`}>
            <div className={styles.card}>
                <div className={styles.main}>
                    {/* <span className={`${styles.value} ${styles.number} ${styles.accent}`}>{doissierMy}</span><hr/>
                    <span className={`${styles.value} ${styles.number} ${styles.accent}`}>{effDamage} </span><hr/> */}
                    <span className={`${styles.value} ${styles.number} ${styles.accent}`}>{tankName} </span><hr/>
                      {tankData ? (
                        <>
                           {/* <p>Танк: {tankData?.ru}</p> */}
                           <p>Мастер: {tankData?.aceTanker}</p>
                         </>
                        ) : (
                           <p>Загрузка...</p>
                         )}
                     {/* {playerData ? (
                        <>
                        <p>Результат: {playerData?.result}</p>
                        <p>Кредитов: {playerData?.credits}</p>
                        <p>Танк: {playerData?.shortNameRU}</p>
                        <p>Урон: {playerData?.['personal.damageDealt']}</p>
                        </>
                        ) : (
                            <p>Загрузка...</p>
                        )} */}

                </div>
            </div>
        </div>
    );
}

export default PlayerStatsWidget;