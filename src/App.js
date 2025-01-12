import React from 'react';
import PlayerStatsWidget from './PlayerStatsWidget'; // Добавлено
import './index.css'; // Убедитесь, что у вас index.css
import Cors from 'cors'; // Добавлено


function App() {
  return (
    <div className="app-container">
      <PlayerStatsWidget />
    </div>
  );
}

export default App;