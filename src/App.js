import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PlayerStatsWidget from './PlayerStatsWidget'; // Добавлено
import StatisticsPage from './StatisticsPage'; // Импортируем новый компонент
import './index.css'; // Убедитесь, что у вас index.css
import Cors from 'cors'; // Добавлено


function App() {
  return (
    <Router>
    <Routes>
      <Route path="/" element={<PlayerStatsWidget />} />
      <Route path="/statistics" element={<StatisticsPage />} />
    </Routes>
  </Router>
  );
}

export default App;