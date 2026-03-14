# 🚀 Быстрая публикация Smart VPN на GitHub

## Для пользователей Windows

### Вариант 1: Двойной клик (самый простой)

1. Откройте папку проекта
2. Дважды кликните на `publish-to-github.bat`
3. Следуйте инструкциям

### Вариант 2: Через PowerShell (больше возможностей)

1. Откройте PowerShell в папке проекта
2. Выполните:
```powershell
.\publish-to-github.ps1
```

---

## 📋 Что нужно перед запуском

### 1. Установите Git

**Скачать:** https://git-scm.com/download/win

**Или через winget:**
```powershell
winget install Git.Git
```

### 2. Создайте репозиторий на GitHub

1. Откройте https://github.com/new
2. Имя: `smart-vpn`
3. Выберите Public/Private
4. **НЕ создавайте README**

### 3. Подготовьте токен (для HTTPS)

1. https://github.com/settings/tokens
2. Generate new token (classic)
3. Отметьте `repo`
4. Скопируйте токен

---

## 🎯 Пошаговый процесс

### Шаг 1: Запуск

```cmd
publish-to-github.bat
```

### Шаг 2: Введите URL репозитория

```
Введите URL репозитория (например, https://github.com/username/smart-vpn.git): 
https://github.com/yourusername/smart-vpn.git
```

### Шаг 3: Введите ваше имя и email

```
Введите ваше имя: John Doe
Введите ваш email: john@example.com
```

### Шаг 4: Введите сообщение коммита

```
Введите сообщение коммита (по умолчанию: 'Initial commit'): 
Initial commit: Smart VPN project
```

### Шаг 5: Введите пароль/токен GitHub

```
Username: yourusername
Password: [ваш токен]
```

---

## ✅ Готово!

Скрипт покажет:
```
==========================================
   РЕПОЗИТОРИЙ ОПУБЛИКОВАН!
==========================================

URL репозитория: https://github.com/yourusername/smart-vpn
```

---

## 🔧 Расширенные опции (PowerShell)

### Использование SSH

```powershell
.\publish-to-github.ps1 -UseSSH
```

### Указание ветки

```powershell
.\publish-to-github.ps1 -Branch "develop"
```

### Без бэкапа

```powershell
.\publish-to-github.ps1 -SkipBackup
```

### Всё вместе

```powershell
.\publish-to-github.ps1 `
  -RepoUrl "https://github.com/username/smart-vpn.git" `
  -Branch "main" `
  -UseSSH `
  -SkipBackup
```

---

## ⚠️ Возможные проблемы

### "Git не является внутренней или внешней командой"

**Решение:** Переустановите Git и перезапустите терминал

### "Authentication failed"

**Решение:** Используйте Personal Access Token вместо пароля

### "Updates were rejected"

**Решение:**
```powershell
git pull --rebase
git push
```

---

## 📚 Полная документация

См. [docs/WINDOWS_GITHUB_SCRIPT.md](./docs/WINDOWS_GITHUB_SCRIPT.md)
