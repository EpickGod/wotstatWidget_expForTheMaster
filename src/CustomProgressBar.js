import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const CustomProgressBar = ({ progress }) => {
  const data = [{ name: 'Progress', value: progress }];
  const fullData = [{ name: 'FullProgress', value: 100 }]; // Данные для второго прогресс-бара
  const thirdData = [{ name: 'ThirdProgress', value: progress }]; // Данные для третьего прогресс-бара

  return (
    <div style={{ width: '100%', height: '100px', position: 'relative', margin: '0px', marginTop: '30px' }}>
      {/* Второй прогресс-бар (100%) */}
      <div style={{ width: '100%', height: '5px', position: 'absolute', top: '-12px', zIndex: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            key={`full-${progress}`} // Ключ, зависящий от progress
            data={fullData}
            layout="vertical"
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <YAxis dataKey="name" type="category" hide />
            <XAxis type="number" domain={[0, 100]} hide />
            <Tooltip />
            <Bar dataKey="value" fill="#888" fillOpacity={0.3} radius={[0, 5, 5, 0]} /> {/* Полупрозрачный */}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Основной прогресс-бар (зелёный) */}
      <div style={{ width: '100%', height: '10px', position: 'absolute', top: '-10px', zIndex: 2 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            key={`main-${progress}`} // Ключ, зависящий от progress
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <YAxis dataKey="name" type="category" hide />
            <XAxis type="number" domain={[0, 100]} hide />
            <Tooltip />
            <Bar
              dataKey="value"
              fill="#00ff00"
              radius={[0, 5, 5, 0]}
              isAnimationActive={true} // Включаем анимацию
              animationDuration={2000} // Длительность анимации (2 секунды)
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Третий прогресс-бар (штрихованный) */}
      <div style={{ width: '100%', height: '20px', position: 'absolute', top: '10px', zIndex: 3 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            key={`hatched-${progress}`} // Ключ, зависящий от progress
            data={thirdData}
            layout="vertical"
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <YAxis dataKey="name" type="category" hide />
            <XAxis type="number" domain={[0, 100]} hide />
            <Tooltip />
            <Bar
              dataKey="value"
              fill="url(#diagonalHatch)" // Используем паттерн
              fillOpacity={0.5} // Полупрозрачный фон
              radius={[0, 5, 5, 0]}
              isAnimationActive={true} // Включаем анимацию
              animationDuration={2000} // Длительность анимации (2 секунды)
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Метки */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          position: 'absolute',
          bottom: '0', // Метки остаются внизу
          width: '100%',
          pointerEvents: 'none',
          top: '-20px',
          zIndex: 4, // Метки на переднем плане
        }}
      >
        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
          <span
            key={value}
            style={{
              fontSize: '0.6em',
              color: '#777',
              transform: 'translateX(-50%)',
              fontWeight: 'lighter',
            }}
          >
            {value}
          </span>
        ))}
      </div>

      {/* SVG-паттерн */}
      <svg width="0" height="0">
        <defs>
          <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="10" height="10">
            <line x1="10" y1="0" x2="0" y2="10" stroke="#888" strokeWidth="2" />
          </pattern>
        </defs>
      </svg>
    </div>
  );
};

export default CustomProgressBar;