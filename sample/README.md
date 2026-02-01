# Sample Data for Market Comparison Chart

This folder contains CSV data files for testing the Market Comparison Chart mod in Spotfire.

## Files

### market_comparison_data.csv (Simple)
A basic dataset with the essential columns:
- **Date**: Date in YYYY-MM-DD format
- **Index**: Name of the market index (DAX, FTSE 100, CAC 40, IBEX 35, STOXX 50)
- **PercentChange**: Daily percentage change from the start date

### market_data_extended.csv (Extended)
A more comprehensive dataset with additional columns:
- **Date**: Date in YYYY-MM-DD format  
- **Index**: Name of the market index
- **PercentChange**: Daily percentage change from the start date
- **ClosePrice**: Closing price for the day
- **Volume**: Trading volume

## How to Use in Spotfire

1. **Import the CSV**:
   - Open Spotfire Analyst
   - File → Open → Browse to the CSV file
   - Or drag and drop the CSV file into Spotfire

2. **Add the Mod**:
   - Drag the `.mod` file into your analysis
   - The Market Comparison Chart will be added

3. **Configure the Axes**:
   - **X Axis (Date)**: Drag the `Date` column
   - **Y Axis (Value)**: Drag the `PercentChange` column
   - **Color (Series)**: Drag the `Index` column

## Data Format Requirements

For the mod to work correctly with your own data:

| Column | Type | Description |
|--------|------|-------------|
| Date/Time | Date or String | X-axis values (time series) |
| Value | Numeric | Y-axis values (typically % change) |
| Series | Categorical | Color axis for grouping lines |

## Sample Data Preview

```
Date,Index,PercentChange
2025-01-02,DAX,0.00
2025-01-03,DAX,0.45
2025-01-06,DAX,0.82
...
2025-01-02,FTSE 100,0.00
2025-01-03,FTSE 100,0.25
...
```

## European Market Indices

| Index | Description | Country |
|-------|-------------|---------|
| DAX | Deutscher Aktienindex | Germany |
| FTSE 100 | Financial Times Stock Exchange 100 | UK |
| CAC 40 | Cotation Assistée en Continu | France |
| IBEX 35 | Índice Bursátil Español | Spain |
| STOXX 50 | Euro Stoxx 50 | Pan-European |
