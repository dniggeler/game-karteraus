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

## Admin-Zugang

- Standard-Admin-Code: `kartenreihen-admin`

## Build und Tests

```bash
dotnet test
cd src/client && npm run build
```
