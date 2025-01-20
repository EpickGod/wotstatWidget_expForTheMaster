import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WidgetSDK } from 'wotstat-widgets-sdk';
import styles from './PlayerStatsWidget.module.css';
import axios from 'axios';
import aceImage from './assets/ace.png';



function PlayerStatsWidget() {
    const [tankData, setTankData] = useState(null);
    const [tankMarksData, setTankMarksData] = useState(null);
    const previousTankName = useRef('');
    const [damage, setCurrentDamage] = useState(0);
    const [assist, setCurrentAssist] = useState(0);
    const [blocked, setCurrentBlocked] = useState(0);
    const [tankLvl, setCurrentTankLevel] = useState(0);
    const [tankRole, setCurrentTankRole] = useState('');
    const [isPlayerAlive, isAliveF] = useState(true);
    const [frags, setCurrentFrags] = useState(0);
    const [spotted, setCurrentSpotted] = useState(0);
    const [damaged, setDamaged] = useState(0);
    const [maxLevel, setMaxLevel] = useState(0);
    const [predictedXPWin, setPredictedXPWin] = useState(0);
    const [predictedXPLose, setPredictedXPLose] = useState(0);

     // Таймер для дебаунсинга
     const debounceTimer = useRef(null);

    // Функция для отправки данных на сервер с дебаунсингом
    const predictXP = useCallback(async () => {
         // Очищаем предыдущий таймер
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

     // Устанавливаем новый таймер
      debounceTimer.current = setTimeout(async () => {
        // ПРОВЕРКА НА НАЛИЧИЕ ДАННЫХ
        if (spotted === 0 && damage === 0 && assist === 0 && damaged ===0 && blocked === 0 && frags === 0) {
            console.log("Данные о бою отсутствуют. Запрос не отправляется.");
              return; // Выходим, если данные отсутствуют
          }
        const inputDataWin = {
            visibleLevels: maxLevel,
            tankLevel: tankLvl,
            "personal.spotted": spotted,
            "personal.damageBlockedByArmor": blocked,
            "personal.damageAssistedRadio": assist,
            "personal.damageDealt": damage,
            "personal.damaged": damaged,
            "personal.kills": frags,
            "personal.isAlive": isPlayerAlive,
            result: "win",
            tankRole: tankRole
        };
        const inputDataLose = {
            visibleLevels: maxLevel,
            tankLevel: tankLvl,
            "personal.spotted": spotted,
            "personal.damageBlockedByArmor": blocked,
            "personal.damageAssistedRadio": assist,
            "personal.damageDealt": damage,
            "personal.damaged": damaged,
            "personal.kills": frags,
             "personal.isAlive": isPlayerAlive,
            result: "lose",
            tankRole: tankRole
        };
          console.log(`Отправка данных на сервер (результат: win):`, JSON.stringify(inputDataWin, null, 2));
           console.log(`Отправка данных на сервер (результат: lose):`, JSON.stringify(inputDataLose, null, 2));
    try {
      const responseWin = await axios.post('http://localhost:5000/api/predict-xp', inputDataWin);
      const roundedXPWin = Math.round(responseWin.data.predictedXP);
      setPredictedXPWin(roundedXPWin);
        console.log("Результат предсказания для победы:", roundedXPWin);

        const responseLose = await axios.post('http://localhost:5000/api/predict-xp', inputDataLose);
      const roundedXPLose = Math.round(responseLose.data.predictedXP);
      setPredictedXPLose(roundedXPLose);
       console.log("Результат предсказания для поражения:", roundedXPLose);
    } catch (error) {
        console.error("Ошибка при запросе предсказания:", error);
    }
      }, 200); // Задержка в 1 секунду
}, [tankLvl, spotted, blocked, assist, damage, damaged, frags, isPlayerAlive, tankRole]);


     // Логирование состояния
     useEffect(() => {
        console.log("frags:", frags, "spotted:", spotted, "damaged:", damaged);
    }, [frags, spotted, damaged]);

    useEffect(() => {
        const sdk = new WidgetSDK();

        sdk.data.battle.onPlayerFeedback.watch(async (e) => {
            console.log(e);
            const newLevel = e.data.vehicle.level;
        
            // Обновляем состояние только если новое значение больше текущего
            setMaxLevel((prevMaxLevel) => {
                if (newLevel > prevMaxLevel) {
                    return newLevel; // Обновляем на новое значение
                }
                return prevMaxLevel; // Оставляем текущее значение
            });
        });

        sdk.data.battle.efficiency.damage.watch(async (newValue) => {
            const curDmg = sdk.data.battle.efficiency.damage.value;
            setCurrentDamage(curDmg);
            predictXP();
        })
          sdk.data.battle.efficiency.assist.watch(async (newValue) => {
            const curAssist = sdk.data.battle.efficiency.assist.value;
            setCurrentAssist(curAssist);
             predictXP();
        })
        sdk.data.battle.efficiency.blocked.watch(async (newValue) => {
            const curBlocked = sdk.data.battle.efficiency.blocked.value;
            setCurrentBlocked(curBlocked);
           predictXP();
        })
         sdk.data.battle.health.watch(async (newValue) => {
            const curHealth = sdk.data.battle.health.value;
            let isA = 'true';
            if (curHealth <= 0) {
                isA = 'false';
            }else{
                isA = 'true';
            }
            isAliveF(isA);
        })
       
        // Подписка на события
    const unsubscribe = sdk.data.battle.onPlayerFeedback.watch(e => {
        //console.log("Получено событие:", e); // Логируем событие
        
        if (e.type === "kill") {
            console.log("Убийство зафиксировано!"); // Логируем убийство
            setCurrentFrags(prevFrags => {
                const newFrags = prevFrags + 1;
                predictXP();
                return newFrags;
            });
        } else if (e.type === "spotted") {
            setCurrentSpotted(prevSpotted => {
                const newSpotted = prevSpotted + 1;
                predictXP();
                return newSpotted;
            });
        } else if (e.type === "receivedDamage") {
            setDamaged(prevDamaged => {
                 const newDamaged = prevDamaged + 1;
                predictXP();
                return newDamaged;
            });
        } else if (e.type === "damage"){
            console.log(e);
        }
    });

        // подписка на получение результата боя
        sdk.data.battle.onBattleResult.watch(result => {
             //console.log('Battle result:', result)
              setCurrentDamage(0);
              setCurrentAssist(0);
              setCurrentBlocked(0);
              setCurrentFrags(0);
              setCurrentSpotted(0);
              setDamaged(0);
              setMaxLevel(0);
                setPredictedXPWin(0);
                setPredictedXPLose(0);
        })

        // подписка на изменение танка
        sdk.data.hangar.vehicle.info.watch((newValue, oldValue) => {
            setCurrentTankRole(newValue.role)
            setCurrentTankLevel(newValue.level)
        })


        // Инициализация начальных данных
        const initialTank = sdk.data?.hangar?.vehicle?.info?.value;
        if (initialTank && initialTank.localizedShortName) {
            const tankName = initialTank.localizedShortName;
            previousTankName.current = tankName;
             fetchTankData(tankName);
            fetchTankMarksData(tankName);
        }

        // Подписка на изменение танка
        sdk.data?.hangar?.vehicle?.info?.watch(async (newValue) => {
           if (newValue && newValue.localizedShortName) {
                const newTankName = newValue.localizedShortName;
               if (newTankName !== previousTankName.current) {
                   previousTankName.current = newTankName;
                     fetchTankData(newTankName);
                     fetchTankMarksData(newTankName);
                }
            }
        });
        // Очистка подписки при размонтировании компонента
    return () => {
        unsubscribe(); // Отписываемся от событий
    };
    }, [predictXP]);

    // Функция для получения данных о мастере
    const fetchTankData = async (newTankName) => {
        try {
            const response = await axios.get(
                `http://localhost:5000/api/find-tank?tankName=${newTankName}`
            );
          setTankData(response.data);
         } catch (error) {
           console.error('Ошибка при запросе данных о мастере:', error);
            setTankData(null);
        }
    };


  // Функция для получения данных об отметках
    const fetchTankMarksData = async (newTankName) => {
      try {
          const response = await axios.get(
              `http://localhost:5000/api/find-tank-marks?tankName=${newTankName}`
          );
        setTankMarksData(response.data);
      } catch (error) {
          console.error('Ошибка при запросе данных об отметках:', error);
          setTankMarksData(null);
      }
  };



    return (
        <div className={styles.main}>
            {tankData && (
              <div className={styles.container}>
                
                <div className={styles.experience}> W: {predictedXPWin} - L: {predictedXPLose} / <img src={aceImage} alt="Знак мастера" className={styles.masterImage} />{tankData.aceTanker}</div>
            </div>
            )}

            {tankMarksData && (
                <div className={styles.marksExperience}>
                    {tankMarksData.mark65} / {tankMarksData.mark85} / {tankMarksData.mark95}
               </div>
            )}
             {(!tankData && !tankMarksData) && (
                  <p className={styles.experience}>Загрузка...</p>
              )}
        </div>
    );
}

export default PlayerStatsWidget;