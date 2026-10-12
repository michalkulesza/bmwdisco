# UdsEngine — контракт потребления компактного бандла (drop-EDIABAS)

Движок собирает UDS/KWP2000/DS2-запросы и разбирает ответы из компактного JSON-бандла + фиксированного рулбука, **без интерпретации `.prg`**.

**Источник истины (bimmercontrol, не переписывать — только зеркалировать):**
- Схема/типы: `bimmercontrol/react/src/shared/prg-bundle.ts` (`EngineBundle`, `EngineFn`, `EngineArg`, `EngineResult`, `EngineResultFlags`, `LightMap`, `LightBits`).
- Рулбук: `bimmercontrol/react/src/main/prg-extract/rulebook.ts`.
- Логика сборки/разбора: `extract.ts` (`assembleFunctions`, `buildTemplate`, `parseResultFields`, `widthOf`).
- DS2 lights: `scripts/derive-ds2.ts`, `~/Desktop/ds2_channelmaps.json`, инъекция в `scripts/prg-export.ts`.
- Эталон byte-parity запросов: `~/Desktop/uds_groundtruth.json` (2546 записей) — движок: **2176/2176 совпадений**.
- Эталон разбора ответов: `~/Desktop/response_groundtruth.json` (77 записей) — движок: **69/71 записей с эталоном**.
- Генерация: `cd bimmercontrol/react && npm run uds:export -- --batch <prg-dir> <out-dir>` (корпус `additional/sqbd/PRG`, имена ЗАГЛАВНЫМИ).

---

## 1. Схема бандла `<sgbd>.json`

```
EngineBundle = {
  sgbd: string
  jobs:  { [name]: hex }                 // Form B: готовые байты запроса
  fns:   EngineFn[]                       // Form A: SG_FUNKTIONEN
  enums: { [TAB]: { [symbol]: byte } }    // мапы, на которые ссылаются args/results
  lights?: LightMap                       // DS2/light-output (когда статикой не собрать)
}
EngineFn      = { n, s, id?, a?: EngineArg[], r?: EngineResult[], p?: 'raw' | 'vm' }
EngineArg     = [name, width] | [name, width, enumTable] | [name, width, { e?, s?:[mul,div,add] }]
EngineResult  = [name, width] | [name, width, EngineResultFlags]
EngineResultFlags = { o?:'L', m?:hexMask, s?:[mul,div,add], e?:enumTable, bf?:[[name,mask]|[name,mask,enum]] }
LightMap  = { function, template: "D0 10 0C …", channels: { [ch]: LightBits }, state?: {on:LightBits, off:LightBits}, fixed?: { [name]: hexFrame } }
LightBits = [ [byteOffset, "0xNN"], … ]   // биты, которые OR-ятся в шаблон
```

Ширины (`widthOf`): `char/byte`=1, `int/word/short`=2, `long/dword`=4, `double`=8, `data[N]/string[N]`=N.

## 2. Фиксированный рулбук (зашить в движок, НЕ в JSON)

```
IO_CONTROL_PARAM: RCTECU=0x00 RTD=0x01 FCS=0x02 STA=0x03
ROUTINE_SUBFN:    STR=0x01 STPR=0x02 RRR=0x03
DIAG_SESSION:     DEFAULT=0x01 ECUPM=0x02 ECUEXTDIAG=0x03 ECUSSDS=0x04 ECUADS=0x05 SUPPLIER=0x60
```
(UDS_SERVICES — справочно; движку нужен только байт сервиса `s`.)

## 3. Сборка запроса

Порядок разрешения по `mapping.function`:

**(a) Lights** — если `bundle.lights.function == function`, либо `function ∈ lights.fixed`:
- `fixed[function]` → отдать кадр как есть.
- иначе: старт = байты `template`; для запрошенного канала (args[0]; для «all/группы» — OR нескольких) — `channels[ch]` = список `[offset, mask]`, **OR** маску в байт `offset`; если есть `state` и передан on/off — OR `state.on`/`state.off` поверх.
- Пример: LCM `STATUS_VORGEBEN ['AL_L']`, template `D0 10 0C 00×12`, `AL_L=[[7,0x40]]` → `D0 10 0C 00 00 00 00 40 …`.
- Пример: REM_20 `STEUERN_LEUCHTENAUSGANG_DIGITAL ['SL_L','1']`, template `2E 45 01 00 00`, `SL_L=[[3,0x14]]`, `state.on=[[4,0x01]]` → `2E 45 01 14 01`.
- Пример: FRM3 `STEUERN_DIGITAL_LICHT ['AL_L','1']`, template `2F 01 00 03 00`, `AL_L=[[2,0x04]]` (индекс канала в байте 2), `state.on=[[4,0x64]]` → `2F 01 04 03 64`. (Это НЕ RMW: `22 30 80` — гейт-чтение статуса, сама команда — детерминированный per-channel IOControl, каждый выход независим.)

**(b) Form B (job)** — если `function ∈ jobs`: base = байты `jobs[function]`; если есть args — снять до `len(args)` хвостовых `0x00`, затем дописать разрешённые байты args.
- Пример: KOMB_G11 `STEUERN_CC_MELDUNG_TRIGGERN` job `3101f012`, args `['0x01','0xfc','0x32','0x21']` → `31 01 F0 12 01 FC 32 21`.

**(c) ARG-dispatch** — `function ∈ {STEUERN, STEUERN_IO, STEUERN_ROUTINE}` и `args[0]=='ARG'`: цель = `fns[args[1]]`; голова по сервису цели, `sub/ioparam` из `args[2]` (рулбук), значения из `args[3:]` по полям `a`.

**(d) Form A (direct fn)** — `function == fn.n`: голова по `s`:
| s | голова |
|---|---|
| 0x22 | `[22] + id` |
| 0x2E | `[2E] + id` |
| 0x2F | `[2F] + id + [0x03=STA]` ← ioparam по умолчанию |
| 0x31 | `[31, 0x01=STR] + id` ← sub по умолчанию |
| 0x10 | `[10] + <session из рулбука>` |
| else | `[s] + id` |
затем поля `a` (big-endian по ширине; символ → `enums[table]`; иначе hex/dec).
- Пример: FEM_20 `_STEUERN_LEUCHTENAUSGANG_DIGITAL` (s=0x2F, id=4501), args `['0x01','1']` → `2F 45 01 03 01 01`.

**(e) Сессия/спец** — `DIAGNOSE_MODE` → `[0x10, DIAG_SESSION[arg]]`; `DIAGNOSE_ENDE`/`DIAGNOSE_AUFRECHT` → через `lights.fixed` либо сессионный слой (джоба нет в PRG); raw-интерсепты (`RAW_UDS`/`COMMUNICATION_CONTROL`/`IO_RETURN_CONTROL`) — уже шлются напрямую сервисом.

**Резолв символа арга:** `0x..`→hex, десятичное→dec, иначе `enums[enumTable][symbol]`.

## 4. Транспорт (в т.ч. DS2-кадры `D0 …`)

Движок отдаёт **payload** — ровно то, что лежит в `uds_groundtruth.request`. Семантика едина для всех семейств: у UDS это `2F 45 01 …`, у DS2 — `D0 10 0C …` (кадр DS2 целиком, со своим байтом длины). Обёртка одинаковая для всех: сервис оборачивает payload в EDIABAS-кадр `[0x80|len, dest, 0xF1] + payload`, а транспорт дописывает контрольную сумму — **арифметическую сумму байтов** (`reduce(0, &+)`, `ThorNetworkService.ensureChecksum`), не XOR. **DS2-специфики в транспорте нет и не требуется** — проверено shadow-прогоном.

Подтверждено на живой машине (THOR/ENET): движок `2E D5 42 00 05 00 64` → кадр `87 40 F1 | 2E D5 42 00 05 00 64 | 66`.

## 5. Разбор ответа

- **Срез транспортного кадра:** `[fmt, dest, src, …payload, checksum]`. Длина — младшие 6 бит `fmt` (если 0 — длинная форма, длина в байте 3). Резать **строго по длине**: иначе контрольная сумма попадает в данные (VIN приходил как `…487y`, а незапрограммированное поле переставало быть all-`0xFF`).
- **Срез заголовка положительного ответа** (подтверждено эталоном): `62`→3 (0x22), `5A`→2 (KWP 0x1A), `61`→2 (KWP 0x21), `71`→4 (0x31), `A0`→3 (DS2).
- `p:'raw'` → сырой DATA (`.bytes`).
- `p:'vm'` → встроенный спец-парсер.
- иначе идти по `r`: ширина; endian `o:'L'`; маска `m` (+сдвиг по младшему биту); масштаб `s=[mul,div,add]`; enum `e` (значение→символ); `bf` = битполя `[name,mask,enum?]`.
- **Поля за пределами ответа = 0**, а не обрыв разбора (VM так и делает: KOMB_G11 `BMW_CC_DATENSAETZE` отдаёт нули в незаполненных слотах).
- В `fns` одно имя может встречаться несколько раз (по строке на сервис) — для разбора брать вариант **с `r`/`p`** (read-сторона).

Возврат — тот же `[String:[ResultData]]`, что и VM.

### Проверено против `~/Desktop/response_groundtruth.json` (77 записей)
**69 из 71 записей с эталоном совпадают полностью.** Оставшиеся 2 — только поле-единица `STAT_FGNR17_EINH = "-"`: VM отдаёт единицы измерения рядом со значением, движок их не эмитит (приложение единицы не читает). 6 записей без эталона (`vm`/`decl` = null) — контекстные.

Ветки декодера и их статус:
| Ветка | Статус |
|---|---|
| масштаб `s` | ✅ на реальных данных (EPS_20 `STAT_LW_OFFSET_WERT` = 648.71 из `0xFD67`÷100) |
| enum `e` | ✅ VM-эталон + реальные (DSC_25) |
| битполя `bf` | ✅ (`READHWMODIFICATIONINDEX`) |
| `p:'raw'` | ✅ VM + декларативно |
| маска `m` | ⚠️ примеры только в НЕ отгруженных модулях (ACSM4I/CTM_F33) — сверено декларативно |
| **little-endian `o:'L'`** | ⛔ **НЕ ПРОВЕРЕНА**: во всём корпусе 0 примеров (277 915 многобайтных полей — все big-endian) |

Часть read-джобов (`STATUS_BETRIEBSMODE`, `C_FA_AUFTRAG`, IDENT на некоторых модулях) существует **только как job**, без Form-A `r` — их разбирает байткод VM. Для них декларативного пути нет by design: IDENT/VIN/FA закрыты встроенными парсерами (§6), остальные — вне отгруженной поверхности приложения.

## 6. Встроенные спец-парсеры (`UdsBuiltinParsers.swift`, не в JSON)

Реализовано (распознаются по имени джоба, `handledJobs`):

| Джоб | Запрос | Разбор | Ключ результата |
|---|---|---|---|
| `IDENT` (любой) | — | **адрес источника из кадра (байт 2)** — подтверждено эталоном: кадр с чужим источником VM отвергает целиком | `ID_SG_ADR` |
| `IDENT` (F/G) | `22 F1 50` | дополнительно 3 байта после `62 F1 50`, big-endian | `ID_SGBD_INDEX` (→ `"0"+hex` = `SGBD_HEX` в `ecu_modules`) |
| `STATUS_VIN_LESEN` | ZGW | ASCII после заголовка | `STAT_VIN` |
| `STATUS_FAHRGESTELLNUMMER` | `22 F1 90` | 17 байт ASCII; **all-`0xFF` → `"0"×17`** (VM отдаёт нули, не пустую строку) | `FGNUMMER`, `STAT_FGNR17_WERT`, `STAT_VIN` |
| `C_FG_LESEN` | `1A 90` | ASCII после `5A 90` | `FG_NR` |
| `STATUS_VCM_GET_FA` / `C_FA_LESEN` / `C_FA_AUFTRAG` | `22 3F 06` / `22 3F 00` | 6-битная упаковка (символ = `ascii−0x20`): 24 символа заголовка, 4 бита выравнивания, дальше список кодов по 3 символа | `STAT_TYP_SCHLUESSEL`, `STAT_BAUREIHE`, `STAT_ZEITKRITERIUM`, `STAT_LACKCODE`, `STAT_POLSTERCODE`, `STAT_SALAPA` |

Срез заголовка: `62`→3 байта, `5A`/`61`→2 байта.

Имена результатов различаются по модулям (`FGNUMMER` на CAS vs `STAT_FGNR17_WERT` на FEM_20), поэтому VIN публикуется под всеми известными ключами с одним значением.

**Статус:** сверено с `response_groundtruth.json` — 69/71 записей с эталоном совпали (см. §5). Точка входа — `UdsEngine.decodeRead(sgbd:jobName:response:)`, **но чтения ещё НЕ маршрутизируются**: `EdiabasService` шлёт их через VM, пока путь не сверен с дампом ответов или живой машиной (эталона ответов сейчас нет — в `uds_groundtruth.json` только запросы).

## 7. Acceptance (byte-parity, реконструкция из бандла)

| SGBD | function | args | ожидается |
|---|---|---|---|
| FEM_20 | `_STEUERN_LEUCHTENAUSGANG_DIGITAL` | `['0x01','1']` | `2F 45 01 03 01 01` |
| KOMB_G11 | `STEUERN_CC_MELDUNG_TRIGGERN` | `['0x01','0xfc','0x32','0x21']` | `31 01 F0 12 01 FC 32 21` |
| LCM | `STATUS_VORGEBEN` | `['AL_L']` | `D0 10 0C 00 00 00 00 40 00 00 00 00 00 00 00` |
| REM_20 | `STEUERN_LEUCHTENAUSGANG_DIGITAL` | `['SL_L','1']` | `2E 45 01 14 01` |
| FRM3 | `STEUERN_DIGITAL_LICHT` | `['AL_L','1']` | `2F 01 04 03 64` |

**Полная проверка:** реконструкция каждой `mapping.(function,args)` == `uds_groundtruth.request` (1110 команд); ожидаемое покрытие сборки ≈ **96.0%**.

## Покрытие / вне scope
- **Офлайн-покрытие 98.7%** (1543/1564 отгруженных команд). FRM3 закрыт как `lights`-карта (per-channel IOControl `2F 01 <idx> 03 <state>` — НЕ RMW).
- Остаётся вне бандла: **DIAGNOSE_ENDE / DIAGNOSE_AUFRECHT** (сессионные — обрабатывает сессионный слой движка фиксированными кадрами: AUFRECHT=`3E FF` TesterPresent, ENDE=возврат к дефолтной сессии; джоба в PRG нет). Плюс несколько отсутствующих-на-варианте выходов FRM3 (ABBL_L/R, BL_L_2/R_2 → NRC на этом варианте ECU) и плейсхолдер `XX`.
