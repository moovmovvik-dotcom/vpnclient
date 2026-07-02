# blowvpn — Desktop Client

VPN-клиент для управления подписками (VLESS, VMess, Shadowsocks, Trojan).

## Требования

- **Node.js 18+** — скачать с https://nodejs.org  
- **Windows 10/11 x64**

---

## Сборка .exe (пошагово)

### 1. Установить Node.js
Скачайте и установите с https://nodejs.org (выберите LTS-версию).

### 2. Распаковать архив
Распакуйте `blowvpn-electron.zip` в любую папку, например `C:\blowvpn`.

### 3. Собрать веб-приложение
Откройте PowerShell или командную строку в корневой папке проекта (где лежит `artifacts/`) и выполните:

```powershell
npm install -g pnpm
pnpm install
pnpm --filter @workspace/naixvpn run build
```

### 4. Скопировать сборку в Electron-проект
```powershell
xcopy /E /I /Y artifacts\naixvpn\dist blowvpn-electron\web
```

### 5. Установить зависимости Electron
```powershell
cd blowvpn-electron
npm install
```

### 6. Собрать установщик .exe
```powershell
npm run build:win
```

Готовый установщик появится в папке `blowvpn-electron\dist-electron\`.  
Файл называется `blowvpn Setup 1.0.0.exe`.

---

## Запуск без сборки (для проверки)

```powershell
cd blowvpn-electron
npm install
npm start
```

Откроется окно приложения.

---

## Что умеет приложение

- Добавление VPN-подписок по ссылке (+)
- Автоматический парсинг серверов (VLESS / VMess / Shadowsocks / Trojan)
- Обновление списка серверов
- Быстрый запуск YouTube, Instagram, Facebook, Twitter и других сервисов
- Статистика трафика в реальном времени
