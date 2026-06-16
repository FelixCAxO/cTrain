@echo off
setlocal

pushd "%~dp0" || exit /b 1

for /f "usebackq delims=" %%I in (`node -p "require('./package.json').name + '-' + require('./package.json').version + '.vsix'"`) do set "VSIX_NAME=%%I"

if not defined VSIX_NAME (
  echo Failed to resolve VSIX name from package.json.
  popd
  exit /b 1
)

set "RELEASE_DIR=%~dp0..\releases"
set "VSIX=%RELEASE_DIR%\%VSIX_NAME%"

if not exist "%RELEASE_DIR%" (
  mkdir "%RELEASE_DIR%"
  if errorlevel 1 (
    echo Failed to create release directory "%RELEASE_DIR%".
    popd
    exit /b 1
  )
)

if exist "%VSIX%" (
  echo Removing old "%VSIX%"
  del /f /q "%VSIX%"
  if errorlevel 1 (
    echo Failed to remove "%VSIX%".
    popd
    exit /b 1
  )
)

call npm run package
set "BUILD_STATUS=%ERRORLEVEL%"

if not "%BUILD_STATUS%"=="0" (
  echo VSIX rebuild failed with exit code %BUILD_STATUS%.
  popd
  exit /b %BUILD_STATUS%
)

if not exist "%VSIX%" (
  echo Expected VSIX was not created: "%VSIX%"
  popd
  exit /b 1
)

echo Rebuilt "%VSIX%"
popd
exit /b 0
