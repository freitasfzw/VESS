@echo off
cd /d "%~dp0"

echo =============================
echo Subindo atualizações para o GitHub...
echo =============================

git add .
git commit -m "Atualizacao automatica -- autopush.bat"
git push --force

echo =============================
echo Concluído!
echo =============================
pause
