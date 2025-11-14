@echo off
cd /d "%~dp0"

echo =============================
echo Subindo atualizações para o GitHub...
echo =============================

git add .
git commit -m "Atualização automática"
git push

echo =============================
echo Concluído!
echo =============================
pause
