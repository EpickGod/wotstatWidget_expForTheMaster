import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot, Area } from 'recharts';
import { WidgetSDK } from 'wotstat-widgets-sdk';
import { WidgetMetaTags } from 'wotstat-widgets-sdk'
import styles from './StatisticsPage.module.css';
import MT from './assets/MT.png';
import HT from './assets/HT.png';
import LT from './assets/LT.png';
import atspg from './assets/atspg.png';
import spg from './assets/spg.png';
import star from './assets/star.png';
import zeroStars from './assets/0stars.png';
import oneStars from './assets/1stars.png';
import twoStars from './assets/2stars.png';
import threeStars from './assets/3stars.png';

import CustomProgressBar from './CustomProgressBar';

// убрать ограничение на размер виджета
WidgetMetaTags.setUnlimitedSize(true)
// сделать виджет доступным только в ангаре
WidgetMetaTags.setHangarOnly(true)

function StatisticsPage() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [tankName, setTankName] = useState('');
    const [bestBattleInfo, setBestBattleInfo] = useState({ damage: 0, battle: 0 });
    const [lastBattle, setLastBattle] = useState(0);
    const [dynamic, setDynamic] = useState(0);
    const [dynamic25, setDynamic25] = useState(0);
    const [lastFiveBattles, setLastFiveBattles] = useState([]);
    const [mark95Value, setMark95Value] = useState("N/A");
    const [mark85Value, setMark85Value] = useState("N/A");
    const [mark65Value, setMark65Value] = useState("N/A");
    const sdkRef = useRef(null);
    const dbRef = useRef(null);
    const [dossierData, setDossierData] = useState(null)

    const toRoman = (num) => {
        if (isNaN(num)) {
            return "N/A";
        }
        const romanValues = {
            1: 'I', 4: 'IV', 5: 'V', 9: 'IX', 10: 'X', 40: 'XL',
            50: 'L', 90: 'XC', 100: 'C', 400: 'XD', 500: 'D', 900: 'CM', 1000: 'M'
        };
        let result = '';
        const sortedKeys = Object.keys(romanValues).sort((a, b) => b - a);
        for (const key of sortedKeys) {
            while (num >= key) {
                result += romanValues[key];
                num -= key;
            }
        }
        return result;
    };

    const getStarsImage = (damageRating) => {
        if (damageRating < 65) {
            return zeroStars;
        } else if (damageRating >= 65 && damageRating < 85) {
            return oneStars;
        } else if (damageRating >= 85 && damageRating < 95) {
            return twoStars;
        } else if (damageRating >= 95) {
            return threeStars;
        } else {
            return null; // На случай, если damageRating не определен
        }
    };

    const getTankClassIcon = (tankClass) => {
        switch (tankClass) {
            case 'mediumTank':
                return MT;
            case 'heavyTank':
                return HT;
            case 'lightTank':
                return LT;
            case 'AT-SPG':
                return atspg;
            case 'SPG':
                return spg;
            default:
                return null;
        }
    };

    const openDatabase = useCallback(() => {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open('TankStatsDB', 1);

            request.onerror = (event) => {
                console.error("Database error:", event.target.error);
                reject(event.target.error);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const objectStore = db.createObjectStore('tankStats', { keyPath: 'tankTag' });
                console.log("Database upgraded");
            };
            request.onsuccess = (event) => {
                const db = event.target.result;
                dbRef.current = db;
                console.log("Database opened successfully");
                resolve(db);
            };
        });
    }, []);

    const updateTankStats = useCallback(async (tankTag, movingAvgDamage, damageRating, battlesCount, averageDamage) => {
        if (!dbRef.current) {
            console.error("Database not opened");
            return;
        }
        const db = dbRef.current;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['tankStats'], 'readwrite');
            const objectStore = transaction.objectStore('tankStats');
            const getRequest = objectStore.get(tankTag);

            getRequest.onsuccess = async (event) => {
                const existingData = event.target.result;
                const currentDate = new Date().toISOString();
                const newData = {
                    movingAvgDamage: movingAvgDamage,
                    damageRating: damageRating,
                    battlesCount: battlesCount,
                    lastUpdate: currentDate,
                    averageDamage: averageDamage
                };
                let updatedData;
                if (existingData) {
                    const lastHistoryItem = existingData.history && existingData.history[existingData.history.length - 1]
                    if (lastHistoryItem && lastHistoryItem.battlesCount === battlesCount) {
                        console.log("battlesCount is not changed");
                        resolve();
                        return;
                    }
                    updatedData = {
                        ...existingData,
                        history: [...(existingData.history || []), newData]
                    }
                } else {
                    updatedData = {
                        tankTag: tankTag,
                        history: [newData]
                    }
                }

                const updateRequest = objectStore.put(updatedData);
                updateRequest.onsuccess = () => {
                    console.log('Tank stats updated/added:', updatedData);
                    resolve();
                };
                updateRequest.onerror = (event) => {
                    console.error('Error updating/adding tank stats:', event.target.error);
                    reject(event.target.error);
                };
            };
            getRequest.onerror = (event) => {
                console.error("Error getting data", event.target.error)
                reject(event.target.error);
            };
        });
    }, []);

    const getTankStatsFromDB = useCallback(async (tankTag) => {
        if (!dbRef.current) {
            console.error("Database not opened");
            return;
        }
        return new Promise((resolve, reject) => {
            const db = dbRef.current;
            const transaction = db.transaction(['tankStats'], 'readonly');
            const objectStore = transaction.objectStore('tankStats');
            const getRequest = objectStore.get(tankTag);

            getRequest.onsuccess = (event) => {
                const tankData = event.target.result;
                resolve(tankData);
            };
            getRequest.onerror = (event) => {
                console.error("Error getting tank stats:", event.target.error);
                reject(event.target.error);
            };
        });
    }, []);

    const logDatabaseContent = useCallback(() => {
        if (!dbRef.current) {
            console.error("Database not opened");
            return;
        }
        const db = dbRef.current;
        const transaction = db.transaction(['tankStats'], 'readonly');
        const objectStore = transaction.objectStore('tankStats');
        const getAllRequest = objectStore.getAll();

        getAllRequest.onsuccess = (event) => {
            console.log("Database content:", event.target.result);
        };
        getAllRequest.onerror = (event) => {
            console.error("Error getting database content:", event.target.error);
        };
    }, []);

    const fetchData = useCallback(async (tankTag) => {
        console.log('Fetching data for tankTag:', tankTag);
        try {
            const response = await axios.get(`http://localhost:5000/api/statistics?tankTag=${tankTag}`);
            setData(response.data);
            setLoading(false);
            const transformedData = response.data.map((item, index) => ({
                battle: index + 1,
                damage: item["totalDamage"] || 0,
            }));
            setChartData(transformedData);
            if (response.data && response.data.length > 0) {
                setTankName(tankTag);
                const { maxDamage, maxBattle } = response.data.reduce((maxInfo, battle, index) => {
                    const currentDamage = (battle["totalDamage"] || 0)
                    if (currentDamage > maxInfo.maxDamage) {
                        return { maxDamage: currentDamage, maxBattle: index + 1 };
                    }
                    return maxInfo;
                }, { maxDamage: 0, maxBattle: 0 });
                setBestBattleInfo({ damage: maxDamage, battle: 0 });
                setLastBattle(response.data[response.data.length - 1]["totalDamage"] || 0);
                let sumLast10 = 0;
                let sumLast25 = 0;
                for (let i = Math.max(0, response.data.length - 10); i < response.data.length; i++) {
                    sumLast10 += response.data[i]["totalDamage"] || 0;
                }
                sumLast10 = sumLast10 / 10;
                for (let i = Math.max(0, response.data.length - 25); i < response.data.length; i++) {
                    sumLast25 += response.data[i]["totalDamage"] || 0;
                }
                sumLast25 = sumLast25 / 25;
                setDynamic(sumLast10);
                setDynamic25(sumLast25);
                const lastFive = response.data.slice(-5).map((battle, index) => ({
                    damage: battle["totalDamage"] || 0,
                    battlesCount: response.data.length - 5 + index + 1
                })).reverse();
                const currentDossier = sdkRef.current.data?.dossier?.current?.value;
                const tankData = await getTankStatsFromDB(tankTag);
                if (currentDossier && tankData && tankData.history) {
                    const lastFiveWithBattlesCount = lastFive.map(battle => ({
                        damage: battle.damage,
                        battlesCount: currentDossier.battlesCount - (response.data.length - battle.battlesCount)
                    }));
                     const lastFiveWithDamageRating = lastFiveWithBattlesCount.map((battle, index) => {
                           const currentHistoryItem = tankData.history.find(item => item.battlesCount === battle.battlesCount);
                           const prevHistoryItem = tankData.history.find(item => item.battlesCount === battle.battlesCount - 1);
                       
                            const currentDamageRating = currentHistoryItem ? currentHistoryItem.damageRating : null;
                            const prevDamageRating = prevHistoryItem ? prevHistoryItem.damageRating : null;
                          
                         const damageRatingChange = prevDamageRating !== null && currentDamageRating !== null ?  (currentDamageRating - prevDamageRating).toFixed(2) : '';
    
                       return {
                               ...battle,
                               damageRatingChange: damageRatingChange
                           }
                    });
                    setLastFiveBattles(lastFiveWithDamageRating);
                 } else {
                    setLastFiveBattles([])
                }
                const totalDamage = response.data.reduce((sum, item) => sum + (item.totalDamage || 0), 0);
                const averageDamage = response.data.length > 0 ? totalDamage / response.data.length : 0;
                const currentTankTag = sdkRef.current.data?.hangar?.vehicle?.info?.value?.tag;
                if (currentTankTag) {
                     const currentDossier = sdkRef.current.data?.dossier?.current?.value;
                     if(currentDossier){
                         await updateTankStats(currentTankTag, currentDossier.movingAvgDamage, currentDossier.damageRating, currentDossier.battlesCount, averageDamage);
                     }
                }
            } else {
                setTankName(tankTag);
                setBestBattleInfo({ damage: 0, battle: 0 });
               setLastBattle(0);
               setDynamic(0);
                setDynamic25(0);
               setLastFiveBattles([]);
            }
        } catch (error) {
            console.error('Ошибка при запросе данных:', error);
            setError(error);
            setLoading(false);
        }
    }, [updateTankStats, getTankStatsFromDB]);

    const fetchMarks = useCallback(async () => {
        try {
            const responseVehicles = await axios.get("https://poliroid.me/gunmarks/api/v2/vehicles/eu/en");
            const tankNameWithoutPrefix = tankName.split(":")[1]
           let tankId = null;
            if (responseVehicles.data?.data?.data?.vehicles) {
                const tankObject = responseVehicles.data?.data?.data?.vehicles.find(tank => tank[1]?.toLowerCase() === tankNameWithoutPrefix?.toLowerCase());
                if (tankObject) {
                    tankId = tankObject[0];
                } else {
                   setMark95Value("N/A");
                    return;
                }
            } else {
                setMark95Value("N/A")
                 return;
            }

            const responseMarks = await axios.get("https://poliroid.me/gunmarks/api/v2/data/eu/vehicles/20,30,40,50,55,60,65,70,75,80,85,90,95,100")
            const tankMarks = responseMarks.data?.data?.data?.find(mark => mark.id === tankId)
            if (tankMarks) {
                setMark65Value(tankMarks.marks["65"] || "N/A");
           } else {
               setMark65Value("N/A");
            }
            if (tankMarks) {
                setMark85Value(tankMarks.marks["85"] || "N/A");
           } else {
               setMark85Value("N/A");
            }
            if (tankMarks) {
                setMark95Value(tankMarks.marks["95"] || "N/A");
           } else {
               setMark95Value("N/A");
            }
       } catch (error) {
            console.error('Ошибка при запросе данных:', error);
            setError(error);
        }
   }, [tankName]);

    useEffect(() => {
        sdkRef.current = new WidgetSDK();
        console.log('SDK initialized');
       const initialTankTag = sdkRef.current.data?.hangar?.vehicle?.info?.value?.tag;
        if (initialTankTag) {
             setTankName(initialTankTag);
             fetchData(initialTankTag);
        }
        fetchMarks();
         openDatabase();
        logDatabaseContent();
        return () => { };
    }, [fetchData, fetchMarks, openDatabase, logDatabaseContent]);

    useEffect(() => {
        const sdk = sdkRef.current;
         if (!sdk) return;
         console.log("Subscribe to tank change events");
        const unsubscribeDossier = sdk.data.dossier.current.watch(async (newValue) => {
             if (!newValue) return;
            const currentTankTag = sdk.data?.hangar?.vehicle?.info?.value?.tag;
           if (!currentTankTag) return;
            setDossierData(newValue)
           try {
                 const totalDamage = data.reduce((sum, item) => sum + (item.totalDamage || 0), 0);
                await updateTankStats(currentTankTag, newValue.movingAvgDamage, newValue.damageRating, newValue.battlesCount, totalDamage / data.length);
            } catch (error) {
                console.error("Error updating tank stats:", error);
            }
        });
         const unsubscribe = sdk.data.hangar.vehicle.info.watch(async (newValue) => {
            let tankTag;
            if (newValue?.value?.tag) {
                tankTag = newValue?.value?.tag
            } else if (newValue?.tag) {
                tankTag = newValue.tag
           }
           if (tankTag) {
                setTankName(tankTag);
                await fetchData(tankTag);
                const tankData = await getTankStatsFromDB(tankTag);
                if (tankData) {
                   const currentBattlesCount = dossierData?.battlesCount
                    const filteredHistory = tankData.history.filter(item => {
                        return item.battlesCount >= currentBattlesCount - 10 && item.battlesCount <= currentBattlesCount
                    });
                     const chartData = filteredHistory.map(item => ({
                       battle: item.battlesCount,
                        damageRating: item.damageRating
                   }))
                   setChartData(chartData);
                } else {
                     setChartData([]);
                 }
           }
        });
        return () => {
            unsubscribe();
           unsubscribeDossier();
        };
    }, [fetchData, updateTankStats, getTankStatsFromDB, dossierData]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error.message}</div>;

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
           return (
                <div className={styles.customTooltip}>
                   <p className={styles.label}>{`Бой: ${label}`}</p>
                   <p className={styles.intro}>{`Отметка: ${payload[0].value ? payload[0].value.toFixed(2) : 'N/A'}`}</p>
               </div>
            );
        }
        return null;
   };
   const renderChange = (change) => {
    const roundedChange = typeof change === 'string' && change !== "" ? parseFloat(change) : change;
     if (typeof roundedChange === 'number' && roundedChange > 0) {
         return <span style={{ color: 'green' }}>⬆ {`+${roundedChange.toFixed(2)}%`}</span>;
     } else if (typeof roundedChange === 'number' && roundedChange < 0) {
        return <span style={{ color: 'red' }}>⬇ {`${roundedChange.toFixed(2)}%`}</span>;
    } else if(typeof roundedChange === 'number' && roundedChange === 0){
        return <span style={{ color: 'gray' }}>{roundedChange.toFixed(2)}%</span>;
   }else{
       return  '';
    }
};

   return (
    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '0px solid #444', backgroundColor: '#1a191edd', padding: '0px', paddingBottom: '10px' }}>
    <div className={styles.statisticsPage}>
        <div className={styles.headerContainer}>
            <div className={styles.tankInfo}>
                <div className={styles.tankInfoHeader}>
                <div>
    {/* Отображаем звезды */}
    <img 
        src={getStarsImage(dossierData?.damageRating)} 
        alt="Stars" 
        style={{ width: '70px', height: 'auto', paddingTop: '20px' }} // Настройте размер по необходимости
    />
</div>
                    <h1>
                    {sdkRef.current?.data?.hangar?.vehicle?.info?.value?.level
                        ? toRoman(sdkRef.current?.data?.hangar?.vehicle?.info?.value?.level)
                        : 'N/A'}
                    {sdkRef.current?.data?.hangar?.vehicle?.info?.value?.class && (
                        <img
                        src={getTankClassIcon(sdkRef.current?.data?.hangar?.vehicle?.info?.value?.class)}
                        alt={sdkRef.current?.data?.hangar?.vehicle?.info?.value?.class}
                        className={styles.tankClassIcon}
                        />
                    )}
                    {sdkRef.current?.data?.hangar?.vehicle?.info?.value?.localizedShortName || tankName}
                    </h1>
                    <div className={styles.markValue}>{`${dossierData?.damageRating?.toFixed(2)}%`}</div>
                </div>
                <CustomProgressBar progress={dossierData?.damageRating} />
            </div>
        </div>
        <div style={{ flex: 1, borderRadius: '10px', overflow: 'hidden', border: '0px solid #444', background: 'linear-gradient(to bottom, #00000088, transparent)', padding:'0px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding:'10px' }}>
            <div style={{ display: 'flex' , padding:'0px'}}>
                <div style={{ marginRight: '40px', textAlign: 'center' }}>
                    Последний: <b>{typeof lastBattle === 'number' ? lastBattle.toFixed(0) : 'N/A'}</b>
                </div>
                <div style={{ marginRight: '40px', textAlign: 'center' }}>
                    Лучший: <b>{typeof bestBattleInfo.damage === 'number' ? bestBattleInfo.damage.toFixed(0) : 'N/A'}</b>
                </div>
                <div style={{ marginRight: '40px', textAlign: 'center' }}>
                Σ 10 боев: <b>{dynamic.toFixed(0)}</b>
                </div>
                <div style={{ marginRight: '20px', textAlign: 'center' }}>
                Σ 25 боев: <b>{dynamic25.toFixed(0)}</b>
               </div>
           </div>
           
       </div>
       </div>
       
       <div style={{ display: 'flex', marginTop: '20px', gap: '20px', alignItems: 'stretch' }}>
       <div style={{ 
    flex: 1, 
    borderRadius: '10px', 
    overflow: 'hidden', 
    border: '0px solid #444', 
    background: 'linear-gradient(to bottom, #00000088, transparent)' 
}}>
    <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff' }}>
        <tbody>
            {/* Заголовок таблицы */}
            <tr style={{ textAlign: 'center' }}>
                <th style={{ padding: '10px', textAlign: 'center', verticalAlign: 'middle', color:'#555' }}>Бои</th>
                <th style={{ padding: '10px', textAlign: 'center', verticalAlign: 'middle', color:'#555'  }}>Σ Урон</th>
                <th style={{ padding: '10px', textAlign: 'center', verticalAlign: 'middle' , color:'#555' }}>Отметка</th>
            </tr>
            {/* Строки таблицы */}
            {lastFiveBattles.map((battle, index) => (
                <tr key={index}>
                    <td style={{ padding: '10px', textAlign: 'center', verticalAlign: 'middle' }}>{battle.battlesCount}:</td>
                    <td style={{ padding: '10px', textAlign: 'center', verticalAlign: 'middle' }}>{typeof battle.damage === 'number' ? battle.damage.toFixed(0) : 'N/A'}</td>
                    <td style={{ padding: '10px', textAlign: 'center', verticalAlign: 'middle', fontWeight:'bolder' }}>{battle.damageRatingChange !== '' ? renderChange(parseFloat(battle.damageRatingChange)) : ''}</td>
                </tr>
            ))}
        </tbody>
    </table>
</div>

    {/* График */}
    <div style={{ flex: 2, borderRadius: '10px', overflow: 'hidden', border: '0px solid #444', background: 'linear-gradient(to bottom, #00000088, transparent)', paddingTop: '20px' }}>
        <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="battle" stroke="#777" />
                <YAxis stroke="#777" domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(value) => value.toFixed(0)} />
                <Tooltip content={<CustomTooltip />} />
                <CartesianGrid stroke="#444" strokeDasharray="1 1" />

                <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00ff00" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#888" stopOpacity={0} />
                    </linearGradient>
                </defs>

                <Area
                    type="monotone"
                    dataKey="damage"
                    stroke="none"
                    fill="url(#areaGradient)"
                    fillOpacity={0.5}
                />

                <Line
                    type="monotone"
                    dataKey="damageRating"
                    stroke="#fff"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive={true}
                    animationDuration={1000}
                />
            </LineChart>
        </ResponsiveContainer>
    </div>
</div>
        </div>
           
        <div style={{ 
    display: 'flex', 
    justifyContent: 'space-between', // Распределяем пространство между элементами
    padding: '10px', 
    borderRadius: '10px', 
    overflow: 'hidden', 
    border: '0px solid #444', 
    background: 'linear-gradient(to bottom, #00000088, transparent)', 
    paddingTop: '10px', 
    margin: '10px' 
}}>
    {/* Первый div (слева) */}
    <div style={{ 
        display: 'flex', // Используем flexbox
        alignItems: 'center', // Выравниваем элементы по центру по вертикали
        justifyContent: 'flex-start', // Выравниваем содержимое слева
        textAlign: 'center', 
        flex: 1 // Занимает равное пространство
    }}>
        <img src={star} alt="Stars" style={{ width: '20px', height: 'auto', margin: '0px' }} />
        <div style={{ color: '#fff', marginLeft: '10px' }}>{mark65Value}</div> {/* Текст справа от звезды */}
    </div>

    {/* Второй div (по центру) */}
    <div style={{ 
        display: 'flex', // Используем flexbox
        alignItems: 'center', // Выравниваем элементы по центру по вертикали
        justifyContent: 'center', // Выравниваем содержимое по центру
        textAlign: 'center', 
        flex: 1 // Занимает равное пространство
    }}>
        <img src={star} alt="Stars" style={{ width: '20px', height: 'auto', margin: '0px' }} />
        <img src={star} alt="Stars" style={{ width: '20px', height: 'auto', margin: '0px' }} />
        <div style={{ color: '#fff', marginLeft: '10px' }}>{mark85Value}</div> {/* Текст справа от звезд */}
    </div>

    {/* Третий div (справа) */}
    <div style={{ 
        display: 'flex', // Используем flexbox
        alignItems: 'center', // Выравниваем элементы по центру по вертикали
        justifyContent: 'flex-end', // Выравниваем содержимое справа
        textAlign: 'center', 
        flex: 1 // Занимает равное пространство
    }}>
        <img src={star} alt="Stars" style={{ width: '20px', height: 'auto', margin: '0px' }} />
        <img src={star} alt="Stars" style={{ width: '20px', height: 'auto', margin: '0px' }} />
        <img src={star} alt="Stars" style={{ width: '20px', height: 'auto', margin: '0px' }} />
        <div style={{ color: '#fff', marginLeft: '10px' }}>{mark95Value}</div> {/* Текст справа от звезд */}
    </div>
</div>
</div>

    
);
}

export default StatisticsPage;