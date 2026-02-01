# Time Series Comparison Chart

A modern, interactive time series comparison chart mod for **TIBCO Spotfire**, inspired by Google Finance. Perfect for comparing multiple data series over time with dynamic filtering, responsive design, and full Spotfire theme integration.

![Time Series Comparison Chart](docs/screenshot.png)

## ✨ Features

### Visualization
- **Multi-series line chart** - Compare multiple time series simultaneously
- **Interactive hover** - Shows detailed values for all series at any point
- **End point indicators** - Glowing dots at the end of each line
- **Smooth animations** - Animated line drawing on load

### Interactivity
- **Time period selector** - Quick buttons (1D, 5D, 1M, 6M, YTD, 1Y, 5Y, MAX)
- **Category tabs** - Filter by data categories (e.g., regions, types)
- **Legend highlights** - Hover over legend items to highlight specific series
- **Spotfire filtering** - Responds to standard Spotfire filter panel

### Design
- **Responsive layout** - Adapts to different window sizes
- **Spotfire theme support** - Automatically adopts light/dark themes
- **Configurable options** - Gear icon settings panel

## 📊 Use Cases

- **Financial Markets** - Compare stock indices, currencies, commodities
- **Performance Metrics** - Track KPIs across departments or products
- **Scientific Data** - Compare experimental results over time
- **IoT/Sensors** - Monitor multiple sensor readings
- **Any time-based comparison** - Works with any timestamped data

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v16+ (includes npm)
- TIBCO Spotfire 11.0+ with Mods support

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/TousifAhamed/timeseries-comparison-chart-mod.git
   cd timeseries-comparison-chart-mod
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   # Terminal 1: Start webpack watch mode
   npm start
   
   # Terminal 2: Start dev server
   npm run server
   ```

4. In Spotfire:
   - Create a new Mod visualization
   - Connect to `http://127.0.0.1:8090`

### Production Build

```bash
npm run build
```

The production bundle will be in the `dist/` folder.

## ⚙️ Configuration

### Data Axes

| Axis | Mode | Description |
|------|------|-------------|
| **X** | Categorical | Date/Time column |
| **Y** | Continuous | Value to plot (e.g., % change, price) |
| **Color** | Categorical | Series identifier (e.g., symbol, name) |
| **MarketType** | Categorical | *(Optional)* Category for filtering tabs |

### Mod Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `timePeriod` | string | "MAX" | Selected time period filter |
| `selectedMarket` | string | "" | Selected category filter |
| `showGrid` | boolean | true | Show/hide grid lines |
| `animateLines` | boolean | true | Enable line animations |
| `showLegend` | boolean | true | Show/hide legend panel |

### Configuration Panel (Gear Icon)

When in edit mode, click the gear icon to access:

| Setting | Description |
|---------|-------------|
| **Show Header** | Toggle header with tabs and time selector |
| **Show Legend** | Toggle legend panel |
| **Legend Position** | Right, Bottom, or Hidden |
| **Line Width** | Thickness of chart lines |
| **Show End Dots** | Toggle endpoint indicators |
| **Show Grid** | Toggle grid lines |
| **Animate Lines** | Toggle entry animations |

## 📁 Project Structure

```
├── src/
│   ├── index.js        # Spotfire initialization & theme handling
│   ├── chart.js        # Main chart class (rendering, interactions)
│   ├── config.js       # Configuration manager & UI
│   └── data.js         # Demo data & color palette
├── static/
│   ├── index.html      # HTML template
│   ├── main.css        # Responsive styles
│   └── mod-manifest.json
├── sample/
│   ├── market_comparison_data.csv
│   └── market_data_extended.csv
├── spotfire/
│   └── spotfire-api-1-3.d.ts
├── package.json
├── webpack.config.js
└── README.md
```

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **D3.js v7** | Data visualization & DOM manipulation |
| **Spotfire Mods API 1.3** | Spotfire integration |
| **Webpack 5** | Module bundling |
| **Babel** | ES6+ transpilation |
| **CSS Variables** | Theme support |

## 📈 Sample Data

The `sample/` folder contains CSV files for testing:

- `market_comparison_data.csv` - Basic market index data
- `market_data_extended.csv` - Extended dataset with multiple regions

### Expected Data Format

| Column | Type | Example |
|--------|------|---------|
| Date | DateTime | 2024-01-15 |
| Symbol | String | "DAX", "S&P 500" |
| PercentChange | Number | -2.45, 1.23 |
| MarketType | String | "Europe", "US" |

## 🎨 Theme Support

The chart automatically adapts to Spotfire themes:

- **Light Theme**: Light background, dark text
- **Dark Theme**: Dark background, light text

All colors (axes, grid, text, borders) are derived from Spotfire's styling context.

## 🐛 Known Limitations

- **Row Limit**: Default 5,000 rows (configurable). For large datasets, consider aggregating data.
- **Time Periods**: 1D period requires data with intraday timestamps

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the BSD-3-Clause License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Google Finance](https://www.google.com/finance) charts
- Built with [TIBCO Spotfire Mods](https://docs.tibco.com/pub/spotfire/general/sr/GUID-mods.html)
- Visualization powered by [D3.js](https://d3js.org/)

---

**Made with ❤️ for the Spotfire community**