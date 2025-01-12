@echo off
echo Starting backend...
start cmd /k "cd D:\reactapp\my-react-app\backend && $env:DEBUG='server' && node server.js"

echo Starting frontend...
start cmd /k "cd D:\reactapp\my-react-app\my-react-app && npm start"

echo All servers started!