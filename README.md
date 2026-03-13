# City Signals

A live city intelligence dashboard for Sydney, Australia. Fuses real-time data streams — maritime AIS, traffic, parking, air quality, weather, and major events — into a single dark map interface.

![City Signals Dashboard](https://img.shields.io/badge/status-live-4ade80?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-38bdf8?style=flat-square)

## Live Demo

Open `index.html` directly in your browser, or enable GitHub Pages to serve it at:
`https://greystoke1337.github.io/city-signals`

## What it shows

| Layer | Source | Status |
|---|---|---|
| Traffic heatmap | TfNSW model (time-aware simulation) | Simulated — live with API key |
| Parking pressure | TfNSW Car Park API locations | Simulated — live with API key |
| Major events | SCG, Allianz, Qudos, ICC, Opera House, EQ | Representative data |
| Weather | [Open-Meteo](https://open-meteo.com) | **Live** |
| Air quality | [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) | **Live** |
| Maritime AIS | [aisstream.io](https://aisstream.io) WebSocket | **Live** — requires free API key |

## Getting started

Clone the repo and open `index.html` in your browser — no build step, no dependencies to install.

```bash
git clone https://github.com/greystoke1337/city-signals.git
cd city-signals
open index.html
```

### Adding your own API keys

**Maritime AIS (aisstream.io)**
1. Register free at [aisstream.io](https://aisstream.io)
2. Copy your API key into `index.html`:
```js
const AIS_KEY = 'your_key_here';
```

**TfNSW live traffic & parking**
1. Register free at [opendata.transport.nsw.gov.au](https://opendata.transport.nsw.gov.au)
2. Replace the simulated traffic and parking functions with live API calls to:
   - `Live Traffic Hazards` — incidents, roadworks, events in GeoJSON
   - `Car Park API` — real-time occupancy for Park & Ride and Metro car parks

## Tech stack

- [Leaflet.js](https://leafletjs.com) — map rendering
- [CartoDB Dark Matter](https://carto.com/basemaps) — base tile layer
- [Open-Meteo](https://open-meteo.com) — weather & air quality (no API key needed)
- [aisstream.io](https://aisstream.io) — real-time maritime AIS via WebSocket
- Vanilla HTML / CSS / JS — single file, no framework, no build step

## Roadmap

- [ ] Live TfNSW traffic & parking feeds
- [ ] Ticketmaster / Eventbrite integration for real event data
- [ ] Timeline scrubber — replay congestion across the day
- [ ] Multi-city support (Melbourne, Brisbane)
- [ ] Neighbourhood drill-down panels

## License

MIT — see [LICENSE](LICENSE)
