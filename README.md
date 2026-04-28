# Kartenreihen

Webbasierte Multiplayer-Umsetzung der in `kartenreihen-variante.md` beschriebenen Spielregeln.

## Stack

- **Backend / Game-Engine:** C#, ASP.NET Core, SignalR
- **Frontend:** React + TypeScript + Vite
- **Spielmodus:** ein zentraler Spielraum, Admin startet und beendet die Partie, fehlende Plaetze werden mit AI-Spielern aufgefuellt

## Projektstruktur

- `src/server/Kartenreihen.Game`: fachliche Game-Engine und AI-Logik
- `src/server/Kartenreihen.Api`: In-Memory-Spielserver, REST-API und SignalR-Hub
- `src/client`: React-Frontend fuer Spieler und Administrator
- `tests/Kartenreihen.Game.Tests`: Tests fuer die Kernregeln

## Entwicklung starten

### Backend

```bash
dotnet run --project src/server/Kartenreihen.Api
```

Der Server laeuft standardmaessig unter `http://localhost:5051`.

### Frontend

```bash
cd src/client
npm install
npm run dev
```

Das Frontend erwartet standardmaessig den API-Server unter `http://localhost:5051`.
Mit `VITE_API_BASE_URL` kann bei Bedarf ein anderer API-Ursprung gesetzt werden.

## Admin-Zugang

- Standard-Admin-Code in `src/server/Kartenreihen.Api/appsettings.json`: `admin`
- Fuer produktive Deployments sollte der Wert per `Game__AdminCode` ueberschrieben werden.
- Die Denkzeit der AI-Spieler kann per `Game__AiMoveDelayMilliseconds` angepasst werden. Standard: `1200`.

## Deployment

- Der Spielserver haelt den Zustand nur **in-memory**. Fuer einen gemeinsamen Spielraum sollte genau **eine** API-Instanz laufen.
- `dotnet publish` fuer `src/server/Kartenreihen.Api` baut das React-Frontend mit und legt die Dateien in `wwwroot` des Publish-Outputs ab.
- In Produktion verwendet das Frontend standardmaessig denselben Ursprung wie die API. Dadurch kann ein einzelner ASP.NET-Dienst sowohl UI als auch API und SignalR ausliefern.

### Publish

```bash
dotnet publish src/server/Kartenreihen.Api -c Release -o publish/api
```

### Start des Publish-Outputs

```bash
Game__AdminCode=ein-geheimer-admin-code dotnet publish/api/Kartenreihen.Api.dll
```

### Optional: separates Frontend erlauben

Falls das Frontend auf einem anderen Ursprung laeuft, koennen erlaubte Urspruenge per Konfiguration gesetzt werden:

```bash
Cors__AllowedOrigins__0=https://game.example.com
Cors__AllowedOrigins__1=https://www.game.example.com
```

## Build und Tests

```bash
dotnet test
cd src/client && npm run build
```
