@echo off
setlocal enabledelayedexpansion

if defined CLI_LSP_CLIENT_BIN_PATH (
    set "resolved=%CLI_LSP_CLIENT_BIN_PATH%"
    goto :execute
)

rem Get the directory of this script
set "script_dir=%~dp0"
set "script_dir=%script_dir:~0,-1%"

rem Detect architecture
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    set "arch=x64"
) else if "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
    set "arch=arm64"
) else (
    set "arch=x64"
)

set "name=cli-lsp-client-windows-!arch!"
set "binary=cli-lsp-client.exe"

rem Search for the binary
set "resolved="
set "current_dir=%script_dir%"

:search_loop
rem Check dist/ first (for local development)
set "candidate=%current_dir%\dist\%name%\bin\%binary%"
if exist "%candidate%" (
    set "resolved=%candidate%"
    goto :execute
)

rem Then check node_modules/ (for production installs)
set "candidate=%current_dir%\node_modules\%name%\bin\%binary%"
if exist "%candidate%" (
    set "resolved=%candidate%"
    goto :execute
)

for %%i in ("%current_dir%") do set "parent_dir=%%~dpi"
set "parent_dir=%parent_dir:~0,-1%"

if "%current_dir%"=="%parent_dir%" goto :not_found
set "current_dir=%parent_dir%"
goto :search_loop

:not_found
echo Failed to find %name% binary for your platform >&2
exit /b 1

:execute
start /b /wait "" "%resolved%" %*
exit /b %ERRORLEVEL%