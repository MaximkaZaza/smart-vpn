# Публикация Smart VPN на GitHub (Windows)

## 📜 Скрипты для Windows

Проект включает 2 скрипта для публикации на GitHub из-под Windows:

| Скрипт | Тип | Описание |
|--------|-----|----------|
| `publish-to-github.bat` | Batch | Простой скрипт с базовыми функциями |
| `publish-to-github.ps1` | PowerShell | Расширенный скрипт с дополнительными опциями |

---

## 🚀 Быстрый старт

### Вариант 1: Batch файл (проще)

```cmd
publish-to-github.bat
```

### Вариант 2: PowerShell (больше возможностей)

```powershell
.\publish-to-github.ps1
```

**Если PowerShell блокирует выполнение:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📋 Пошаговый процесс

### Шаг 1: Подготовка

Перед запуском скрипта:

1. **Установите Git** (если не установлен)
   - Скачайте с https://git-scm.com/download/win
   - Или через winget: `winget install Git.Git`

2. **Создайте репозиторий на GitHub**
   - Откройте https://github.com/new
   - Имя репозитория: `smart-vpn`
   - Выберите Public или Private
   - **НЕ инициализируйте README** (у нас уже есть файлы)

### Шаг 2: Запуск скрипта

#### Batch версия
```cmd
publish-to-github.bat
```

#### PowerShell версия
```powershell
.\publish-to-github.ps1
```

### Шаг 3: Следуйте инструкциям

Скрипт автоматически:
1. ✅ Проверит установку Git
2. ✅ Инициализирует репозиторий (если нужно)
3. ✅ Создаст .gitignore
4. ✅ Создаст бэкап важных файлов
5. ✅ Настроит удалённый репозиторий
6. ✅ Настроит пользователя Git
7. ✅ Добавит файлы и создаст коммит
8. ✅ Опубликует на GitHub

---

## 🔧 Параметры (PowerShell)

### Базовое использование

```powershell
.\publish-to-github.ps1
```

### С указанием репозитория

```powershell
.\publish-to-github.ps1 -RepoUrl "https://github.com/username/smart-vpn.git"
```

### С указанием ветки

```powershell
.\publish-to-github.ps1 -RepoUrl "https://github.com/username/smart-vpn.git" -Branch "main"
```

### Использование SSH

```powershell
.\publish-to-github.ps1 -UseSSH
```

### Без создания бэкапа

```powershell
.\publish-to-github.ps1 -SkipBackup
```

### Все параметры вместе

```powershell
.\publish-to-github.ps1 `
  -RepoUrl "https://github.com/username/smart-vpn.git" `
  -Branch "main" `
  -UseSSH `
  -SkipBackup
```

---

## 📁 Что делает скрипт

### 1. Проверка требований
- Проверяет наличие Git
- Проверяет наличие .git директории
- Проверяет .gitignore

### 2. Создание бэкапа
```
backup-20240314-120000/
├── .env
├── package.json
└── docker-compose.yml
```

### 3. Настройка .gitignore
Автоматически создаёт .gitignore с правилами для:
- node_modules/
- .env
- logs/
- .DS_Store
- и т.д.

### 4. Настройка remote
- Добавляет origin URL
- Или обновляет существующий

### 5. Настройка пользователя
- git config user.name
- git config user.email

### 6. Коммит
- git add -A
- git commit -m "Initial commit: Smart VPN project"

### 7. Публикация
- git push -u origin main

---

## 🔐 HTTPS vs SSH

### HTTPS (по умолчанию)

**Плюсы:**
- ✅ Проще настроить
- ✅ Работает сразу

**Минусы:**
- ❌ Требует ввод пароля/токена при каждом push
- ❌ Нужно создавать Personal Access Token

**Как использовать токен:**
```
При push введите токен вместо пароля
```

### SSH

**Плюсы:**
- ✅ Не требует ввода пароля
- ✅ Безопаснее

**Минусы:**
- ❌ Требует генерации SSH ключа

**Настройка SSH:**

1. **Сгенерируйте ключ:**
```powershell
ssh-keygen -t ed25519 -C "your_email@example.com"
```

2. **Добавьте ключ в GitHub:**
   - Откройте https://github.com/settings/keys
   - Нажмите "New SSH key"
   - Вставьте содержимое файла:
   ```
   C:\Users\YourName\.ssh\id_ed25519.pub
   ```

3. **Используйте скрипт с SSH:**
```powershell
.\publish-to-github.ps1 -UseSSH
```

---

## 🛡️ Что НЕ попадает в репозиторий

Скрипт создаёт .gitignore который исключает:

```
❌ node_modules/
❌ .env (пароли и секреты)
❌ logs/
❌ *.log
❌ coverage/
❌ dist/
❌ build/
❌ .DS_Store
❌ Thumbs.db
❌ .vscode/
❌ .idea/
❌ *.pem, *.key (сертификаты)
❌ config/certs/
❌ config/xray/
```

---

## 📊 Пример вывода

```
==========================================
   Smart VPN — Публикация на GitHub     
==========================================

[OK] Git установлен: git version 2.43.0.windows.1
[OK] Git репозиторий найден
[OK] .gitignore найден

==========================================
   Настройка удалённого репозитория     
==========================================

[INFO] Текущий remote: https://github.com/old/repo.git
Изменить remote? (y/N): y
[OK] Remote обновлён: https://github.com/username/smart-vpn.git

==========================================
   Настройка пользователя Git           
==========================================

[OK] Пользователь настроен: John Doe <john@example.com>

==========================================
   Добавление файлов и коммит           
==========================================

[OK] Коммит создан: Initial commit: Smart VPN project

==========================================
   Публикация на GitHub                 
==========================================

[OK] ✅ Публикация успешна!

==========================================
   Репозиторий опубликован!             
==========================================

📦 URL репозитория: https://github.com/username/smart-vpn

Следующие шаги:
  1. Откройте https://github.com/username/smart-vpn
  2. Настройте GitHub Actions (опционально)
  3. Добавьте секреты в Settings > Secrets
```

---

## ⚠️ Возможные проблемы

### Ошибка: "Git не является внутренней или внешней командой"

**Решение:**
1. Установите Git
2. Перезапустите терминал
3. Или добавьте Git в PATH

### Ошибка: "Authentication failed"

**Причина:** Неверный логин/пароль или токен

**Решение для HTTPS:**
1. Создайте Personal Access Token:
   - https://github.com/settings/tokens
   - Generate new token (classic)
   - Отметьте `repo` permissions
2. Используйте токен вместо пароля при push

**Решение для SSH:**
1. Проверьте SSH ключ:
```powershell
ssh -T git@github.com
```
2. Пересоздайте ключ если нужно

### Ошибка: "remote origin already exists"

**Решение:**
```powershell
git remote remove origin
.\publish-to-github.ps1
```

### Ошибка: "Updates were rejected because the remote contains work"

**Решение:**
```powershell
git pull --rebase
git push -u origin main
```

Или используйте force push (осторожно!):
```powershell
.\publish-to-github.ps1 -Force
```

---

## 🔧 Дополнительные команды

### Проверка статуса
```powershell
git status
```

### Просмотр удалённого репозитория
```powershell
git remote -v
```

### Изменение remote вручную
```powershell
git remote set-url origin https://github.com/username/smart-vpn.git
```

### Повторная публикация
```powershell
git push
```

---

## 📞 Поддержка

При проблемах:

1. Проверьте вывод скрипта на ошибки
2. Убедитесь, что Git установлен: `git --version`
3. Проверьте доступ к репозиторию
4. Попробуйте выполнить команды вручную

---

## 📚 Полезные ссылки

- Git для Windows: https://git-scm.com/download/win
- GitHub Desktop: https://desktop.github.com/
- Personal Access Tokens: https://docs.github.com/en/authentication
- SSH Keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
