# Суть проекта.
Этот проект отслеживает валютные пары, сохраняет их цены, отслеживает движения валюты.

Проект отслеживает следующие движения:
- Если валюта упала более чем на 4% за последние 10 минут, это сообщится в телеграм (параметры можно изменить)
- Если валюта поднялась более чем на 2% за последние 3 минуты, это сообщится в телеграм (параметры можно изменить).

Так же для проверки используется цена продажи (bid price). Если требуется изменить - исправлю.

В проекте есть два варианта запуска:
- Запускать проверку ВСЕХ валютных пар раз в 20 секунд. В таком случае движение валюты фиксируется в таблице `traffic`, но сообщение в телеграм не отсылается. (файл `curr_20_sec.js`)
- Отслеживать валюту по вебсокету. В таком случае сообщение остылается в телеграм и дополнительно фиксируется в таблице `traffic`. (файл `curr_ws.js`)
## Предупреждение.
При работе с телеграм можно столкнутся с таким видом "бага":

![Множество](image20210415160827.png)

Исправить баг не возможно: за 1 минуту пришло много разных цен и все они больше или меньше той, что была 3 минуты назад. Альтернативное решение: не использовать телеграм бота, а брать движение из таблицы `traffics`.

# Установка.
1. Запустить `npm install`.
2. Настроить параметры.
3. Запустить `forever start curr_ws.js`.
4. Для просмотра всех `console.log` запустите `forever logs curr_ws.js -f`.

# Параметры.
Параметры находятся в файле params.json. Имеются:
- настройки базы данных: хост, пользователь, пароль, имя.
- Настройки бота телеграм: включить ли бота, api, id чата.
- настройки binance: api_key, api_secret
- настройки самой программы: процент снижения, повышения, время понижения, повышения и массив валютных пар.

# Требования к базе данных.
Для работы с приложением в базе данных требуются 3 таблицы:
- `prices` - таблица, сохраняющая актуальную цену
- `history` - временная таблица, сохраняющая пришедшие с binance изменения в цене вместе с временем прихода изменения. Но данные старше 12 минут удаляются (если параметры изменены - самое большое время + 2 минуты).
- `traffic` - сохраняет особые движения валюты (скачки вверх и вниз, проценты и время настраивается). Это так же временная таблица. Данные старше 1 суток стираются.
## Состав таблиц.
### **Prices.**
| Поле     | Тип         | Null | Key | Default        |
|----------|-------------|------|-----|----------------|
| id       | int         | No   | PRI | Auto_increment |
| curr_str | varchar(10) | No   | UNI |                |
| value    | float       | No   |     | 0              |
| message  | varchar(100)| NO   |     |                |
**Индекс:**
```sql
CREATE INDEX curr_str ON prices(curr_str);
```
### **History.**
| Field    | Type        | Null | Key | Default |
|----------|-------------|------|-----|---------|
| curr_str | varchar(20) | NO   |     |         |
| value    | float       | NO   |     | 0       |
| date     | datetime    | YES  | MUL | NULL    |
**Индекс**
```sql
CREATE INDEX curr_and_date ON history(date, curr_str);
```

### **Traffic.**
| Field            | Type        | Null | Key | Default           | Extra             |
|------------------|-------------|------|-----|-------------------|-------------------|
| curr_str         | varchar(20) | NO   |     |                   |                   |
| old_price        | float       | NO   |     | 0                 |                   |
| new_price        | float       | NO   |     | 0                 |                   |
| traffic_new_date | datetime    | NO   | MUL | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| direction        | varchar(4)  | NO   |     | up                |                   |
**Индекс**
```sql
CREATE INDEX traffic_new_date ON traffic(traffic_new_date);
```
