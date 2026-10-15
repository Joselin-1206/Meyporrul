@echo off
cd /d "%~dp0"
python scripts\import_project_madurai.py
if errorlevel 1 goto failed
python backend\server.py
pause
exit /b

:failed
echo Could not load the saved edition comparison data.
pause
