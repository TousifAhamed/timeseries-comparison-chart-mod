/*
 * Market Comparison Chart - A modern stock market comparison visualization
 * Inspired by Google Finance style charts
 */

//@ts-check
import * as d3 from "d3";
import { MARKET_COLORS } from "./data.js";

/**
 * @typedef {Object} MarketDataPoint
 * @property {Date} date
 * @property {number} value - Percentage change
 */

/**
 * @typedef {Object} MarketSeries
 * @property {string} name
 * @property {string} symbol
 * @property {string} marketType - Market category (US, Europe, Asia, etc.)
 * @property {number} currentValue
 * @property {number} change
 * @property {number} changePercent
 * @property {string} color
 * @property {MarketDataPoint[]} data
 */

export class MarketComparisonChart {
    constructor(mod) {
        this.mod = mod;
        this.container = d3.select("#chart-container");
        this.svg = null;
        this.tooltip = null;
        this.legend = null;
        this.highlightedSeries = null;
        this.margin = { top: 20, right: 30, bottom: 40, left: 55 };
        this.headerHeight = 80;
        this.legendWidth = 230;
        this.selectedTimePeriod = "MAX";
        this.selectedMarket = ""; // Empty means show all
        this.availableMarkets = []; // Will be populated from data
        this.dateRange = { min: null, max: null }; // Actual date range from data
        this.onTimePeriodChange = null;
        this.onMarketChange = null;
        
        this.initializeDOM();
    }

    setTimePeriodCallback(callback) {
        this.onTimePeriodChange = callback;
    }

    setMarketChangeCallback(callback) {
        this.onMarketChange = callback;
    }

    initializeDOM() {
        // Clear any existing content
        this.container.selectAll("*").remove();

        // Create main layout wrapper
        const wrapper = this.container
            .append("div")
            .attr("class", "chart-wrapper");

        // Create header with market tabs and time period selector
        this.header = wrapper
            .append("div")
            .attr("class", "chart-header");

        // Create content area (chart + legend side by side)
        const contentArea = wrapper
            .append("div")
            .attr("class", "chart-content");

        // Create SVG for the chart
        this.svg = contentArea
            .append("svg")
            .attr("class", "chart-svg");

        // Create legend container on the right
        this.legend = contentArea
            .append("div")
            .attr("class", "chart-legend");

        // Create defs for clip path
        this.defs = this.svg.append("defs");
        this.clipPath = this.defs.append("clipPath")
            .attr("id", "chart-clip");
        this.clipRect = this.clipPath.append("rect");

        // Create chart group with clip path
        this.chartGroup = this.svg.append("g").attr("class", "chart-group");

        // Create groups for different elements
        this.gridGroup = this.chartGroup.append("g").attr("class", "grid-group");
        this.axisGroup = this.chartGroup.append("g").attr("class", "axis-group");
        
        // Create clipped group for lines and dots (to prevent overflow)
        this.clippedGroup = this.chartGroup.append("g")
            .attr("class", "clipped-group")
            .attr("clip-path", "url(#chart-clip)");
        this.linesGroup = this.clippedGroup.append("g").attr("class", "lines-group");
        this.dotsGroup = this.clippedGroup.append("g").attr("class", "dots-group");
        
        this.hoverGroup = this.chartGroup.append("g").attr("class", "hover-group");

        // Create tooltip
        this.tooltip = this.container
            .append("div")
            .attr("class", "chart-tooltip")
            .style("opacity", 0);

        // Create vertical hover line
        this.hoverLine = this.hoverGroup
            .append("line")
            .attr("class", "hover-line")
            .style("opacity", 0);

        // Create hover overlay for mouse events
        this.hoverOverlay = this.chartGroup
            .append("rect")
            .attr("class", "hover-overlay")
            .style("fill", "none")
            .style("pointer-events", "all");
    }

    /**
     * Clear all chart elements (lines, dots, axes, grid, legend)
     * Used when there's no data to display
     */
    clearChart() {
        // Clear lines
        if (this.linesGroup) {
            this.linesGroup.selectAll("*").remove();
        }
        // Clear dots
        if (this.dotsGroup) {
            this.dotsGroup.selectAll("*").remove();
        }
        // Clear grid
        if (this.gridGroup) {
            this.gridGroup.selectAll("*").remove();
        }
        // Clear axes
        if (this.axisGroup) {
            this.axisGroup.selectAll("*").remove();
        }
        // Clear legend
        if (this.legend) {
            this.legend.selectAll("*").remove();
        }
        // Hide hover line
        if (this.hoverLine) {
            this.hoverLine.style("opacity", 0);
        }
        // Hide tooltip
        if (this.tooltip) {
            this.tooltip.style("opacity", 0);
        }
    }

    createHeader(options, seriesData) {
        this.header.selectAll("*").remove();

        // Determine if header should be shown (explicit check)
        const showHeader = options.showHeader === true || options.showHeader === undefined;
        
        if (!showHeader) {
            this.header.style("display", "none");
            return;
        }

        this.header.style("display", "flex");
        this.selectedTimePeriod = options.timePeriod || "MAX";
        this.selectedMarket = options.selectedMarket || "";

        // Top row with title and market tabs
        const headerTop = this.header
            .append("div")
            .attr("class", "chart-header-top");

        // Title with X icon
        const titleSection = headerTop
            .append("div")
            .attr("class", "chart-title-section");
        
        titleSection
            .append("span")
            .attr("class", "chart-title-icon")
            .text("✕");
            
        titleSection
            .append("span")
            .attr("class", "chart-title")
            .text("COMPARE MARKETS");

        // Market type tabs - dynamically populated from data
        const marketTabs = headerTop
            .append("div")
            .attr("class", "market-tabs");

        // Extract unique market types from data
        const markets = this.availableMarkets.length > 0 
            ? this.availableMarkets 
            : ["All"]; // Default if no market types in data
        
        const self = this;
        
        // Add "All" option first
        marketTabs
            .append("button")
            .attr("class", `tab-btn ${this.selectedMarket === "" ? "active" : ""}`)
            .text("All")
            .on("click", function(event) {
                self.selectedMarket = "";
                marketTabs.selectAll(".tab-btn").classed("active", false);
                d3.select(this).classed("active", true);
                try {
                    self.mod.property("selectedMarket").set("");
                } catch (e) {
                    console.warn("[Chart] Could not save market selection:", e);
                }
            });
        
        // Add market type buttons from data
        markets.forEach((market) => {
            if (market !== "All") {
                marketTabs
                    .append("button")
                    .attr("class", `tab-btn ${market === this.selectedMarket ? "active" : ""}`)
                    .text(market)
                    .on("click", function(event) {
                        self.selectedMarket = market;
                        marketTabs.selectAll(".tab-btn").classed("active", false);
                        d3.select(this).classed("active", true);
                        try {
                            self.mod.property("selectedMarket").set(market);
                        } catch (e) {
                            console.warn("[Chart] Could not save market selection:", e);
                        }
                    });
            }
        });

        // Time period selector row - dynamically calculated based on date range
        const timePeriodRow = this.header
            .append("div")
            .attr("class", "time-period-row");

        const timePeriods = timePeriodRow
            .append("div")
            .attr("class", "time-periods");

        // Calculate available time periods based on actual date range
        const periods = this.calculateAvailableTimePeriods();
        
        periods.forEach((period) => {
            timePeriods
                .append("button")
                .attr("class", `period-btn ${period === this.selectedTimePeriod ? "active" : ""}`)
                .text(period)
                .on("click", function(event) {
                    self.selectedTimePeriod = period;
                    // Update button states
                    timePeriods.selectAll(".period-btn").classed("active", false);
                    d3.select(this).classed("active", true);
                    // Trigger callback to filter data
                    if (self.onTimePeriodChange) {
                        self.onTimePeriodChange(period);
                    }
                    // Also save to mod property
                    try {
                        self.mod.property("timePeriod").set(period);
                    } catch (e) {
                        console.warn("[Chart] Could not save time period:", e);
                    }
                });
        });
    }

    /**
     * Calculate available time periods based on actual date range in data
     */
    calculateAvailableTimePeriods() {
        if (!this.dateRange.min || !this.dateRange.max) {
            return ["MAX"];
        }

        const periods = [];
        const now = new Date();
        const minDate = this.dateRange.min;
        const maxDate = this.dateRange.max;
        const dataSpanDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);

        // Only show periods that make sense for the data range
        if (dataSpanDays >= 1) periods.push("1D");
        if (dataSpanDays >= 5) periods.push("5D");
        if (dataSpanDays >= 30) periods.push("1M");
        if (dataSpanDays >= 180) periods.push("6M");
        if (dataSpanDays >= 30) periods.push("YTD");
        if (dataSpanDays >= 365) periods.push("1Y");
        if (dataSpanDays >= 1825) periods.push("5Y");
        periods.push("MAX"); // Always show MAX

        return periods;
    }

    async render(dataView, windowSize, options) {
        console.log("[Chart] render called with windowSize:", windowSize, "options:", options);
        
        const width = windowSize.width;
        const height = windowSize.height;
        
        console.log("[Chart] Window dimensions - width:", width, "height:", height);
        console.log("[Chart] showLegend option:", options.showLegend, "type:", typeof options.showLegend);

        // Determine if header should be shown (explicit check)
        const showHeader = options.showHeader === true || options.showHeader === undefined;
        
        // Use fixed header height to avoid measurement issues
        const headerHeight = showHeader ? this.headerHeight : 0;
        
        // Determine if legend should be shown (explicit check for boolean false)
        const showLegend = options.showLegend === true || options.showLegend === undefined;
        
        // Calculate responsive legend width based on container width
        let legendWidth = 0;
        if (showLegend) {
            if (width < 600) {
                legendWidth = 0; // Legend moves to bottom in CSS
            } else if (width < 800) {
                legendWidth = 160;
            } else if (width < 1000) {
                legendWidth = 200;
            } else if (width >= 1200) {
                legendWidth = 260;
            } else {
                legendWidth = this.legendWidth;
            }
        }

        // Calculate available space for the chart
        const svgWidth = width - legendWidth;
        const svgHeight = height - headerHeight;

        // Update SVG dimensions - flex:1 will handle width, we just set height
        this.svg
            .style("flex", "1")
            .attr("height", svgHeight);

        const chartWidth = svgWidth - this.margin.left - this.margin.right;
        const chartHeight = svgHeight - this.margin.top - this.margin.bottom;
        
        console.log("[Chart] Chart dimensions - width:", chartWidth, "height:", chartHeight);

        if (chartWidth < 100 || chartHeight < 100) {
            console.warn("[Chart] Chart too small, skipping render:", chartWidth, "x", chartHeight);
            return;
        }

        this.chartGroup.attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);
        
        // Update clip path to match chart area with padding for dots (10px extra on each side)
        const clipPadding = 12;
        this.clipRect
            .attr("x", -clipPadding)
            .attr("y", -clipPadding)
            .attr("width", chartWidth + clipPadding * 2)
            .attr("height", chartHeight + clipPadding * 2);

        // Get data - use demo data for now, or parse from Spotfire dataView
        const rawSeriesData = await this.getData(dataView, options);
        console.log("[Chart] Got seriesData:", rawSeriesData.length, "series");

        // Extract date range from all data for time period calculations
        const allDatesRaw = rawSeriesData.flatMap(s => s.data.map(d => d.date));
        if (allDatesRaw.length > 0) {
            this.dateRange.min = new Date(Math.min(...allDatesRaw.map(d => d.getTime())));
            this.dateRange.max = new Date(Math.max(...allDatesRaw.map(d => d.getTime())));
            console.log("[Chart] Date range:", this.dateRange.min, "to", this.dateRange.max);
        }

        // Extract unique market types from data
        const marketTypes = [...new Set(rawSeriesData.map(s => s.marketType).filter(m => m))];
        this.availableMarkets = marketTypes.length > 0 ? marketTypes : [];
        console.log("[Chart] Available markets:", this.availableMarkets);

        // Create header AFTER we have data (for dynamic tabs)
        this.createHeader(options, rawSeriesData);

        // Filter data based on selected market
        let marketFilteredData = rawSeriesData;
        if (this.selectedMarket && this.selectedMarket !== "") {
            marketFilteredData = rawSeriesData.filter(s => s.marketType === this.selectedMarket);
            console.log("[Chart] Filtered by market:", this.selectedMarket, "series count:", marketFilteredData.length);
        }

        // Filter data based on selected time period
        const seriesData = this.filterDataByTimePeriod(marketFilteredData, options.timePeriod);
        const filteredData = seriesData; // For reference in drawing functions

        // Validate we have data to render
        const allDates = seriesData.flatMap(s => s.data.map(d => d.date));
        const allValues = seriesData.flatMap(s => s.data.map(d => d.value));

        if (allDates.length === 0 || allValues.length === 0) {
            console.warn("[Chart] No data to render - dates:", allDates.length, "values:", allValues.length);
            
            // Clear all chart elements when there's no data
            this.clearChart();
            
            // Show empty state message with theme colors
            const computedStyle = getComputedStyle(document.documentElement);
            const textColor = computedStyle.getPropertyValue('--sf-text-secondary').trim() || '#5f6368';
            
            this.chartGroup.selectAll(".empty-message").remove();
            this.chartGroup.append("text")
                .attr("class", "empty-message")
                .attr("x", chartWidth / 2)
                .attr("y", chartHeight / 2)
                .attr("text-anchor", "middle")
                .attr("fill", textColor)
                .attr("font-size", "14px")
                .text("No data available. Please configure X, Y, and Color axes.");
            return;
        }

        // Remove empty state if we have data
        this.chartGroup.selectAll(".empty-message").remove();

        // Create scales
        const dateExtent = d3.extent(allDates);
        console.log("[Chart] Date extent:", dateExtent);
        const xScale = d3.scaleTime()
            .domain(dateExtent)
            .range([0, chartWidth]);

        const yMinVal = d3.min(allValues);
        const yMaxVal = d3.max(allValues);
        console.log("[Chart] Y range - min:", yMinVal, "max:", yMaxVal);
        
        const yMin = Math.min(yMinVal || 0, 0);
        const yMax = Math.max(yMaxVal || 0, 0);
        const yPadding = Math.max((yMax - yMin) * 0.1, 1); // At least 1 unit padding
        console.log("[Chart] Y scale domain:", [yMin - yPadding, yMax + yPadding]);

        const yScale = d3.scaleLinear()
            .domain([yMin - yPadding, yMax + yPadding])
            .range([chartHeight, 0]);

        // Draw grid
        this.drawGrid(chartWidth, chartHeight, yScale, options);

        // Draw axes
        this.drawAxes(chartWidth, chartHeight, xScale, yScale);

        // Draw lines
        this.drawLines(seriesData, xScale, yScale, chartHeight, options);

        // Draw end dots (pass options to control visibility)
        this.drawEndDots(filteredData, xScale, yScale, options);

        // Draw legend (pass options to control visibility)
        this.drawLegend(filteredData, options);

        // Setup hover interactions
        this.setupHoverInteractions(filteredData, xScale, yScale, chartWidth, chartHeight);
    }

    /**
     * Filter series data based on selected time period
     */
    filterDataByTimePeriod(seriesData, timePeriod) {
        if (!timePeriod || timePeriod === "MAX") {
            return seriesData;
        }

        const now = new Date();
        let startDate;

        switch (timePeriod) {
            case "1D":
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 1);
                break;
            case "5D":
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 5);
                break;
            case "1M":
                startDate = new Date(now);
                startDate.setMonth(now.getMonth() - 1);
                break;
            case "6M":
                startDate = new Date(now);
                startDate.setMonth(now.getMonth() - 6);
                break;
            case "YTD":
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            case "1Y":
                startDate = new Date(now);
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            case "5Y":
                startDate = new Date(now);
                startDate.setFullYear(now.getFullYear() - 5);
                break;
            default:
                return seriesData;
        }

        console.log(`[Chart] Filtering data from ${startDate.toISOString()} for period ${timePeriod}`);

        return seriesData.map(series => {
            const filteredPoints = series.data.filter(d => d.date >= startDate);
            
            // Recalculate summary values for filtered data
            if (filteredPoints.length > 0) {
                const firstPoint = filteredPoints[0];
                const lastPoint = filteredPoints[filteredPoints.length - 1];
                
                return {
                    ...series,
                    data: filteredPoints,
                    currentValue: lastPoint.value,
                    changePercent: lastPoint.value - firstPoint.value,
                    change: lastPoint.value - firstPoint.value
                };
            }
            return { ...series, data: filteredPoints };
        }).filter(series => series.data.length > 0);
    }

    async getData(dataView, options) {
        // Try to get data from Spotfire dataView
        try {
            console.log("[Chart] getData called with dataView:", dataView);
            if (!dataView) {
                console.log("[Chart] No dataView provided - returning empty array");
                return [];
            }
            
            // Check for data view errors first
            const dataViewError = await dataView.getErrors();
            if (dataViewError && dataViewError.length > 0) {
                console.warn("[Chart] DataView has errors:", dataViewError);
                return [];
            }
            
            const rows = await dataView.allRows();
            console.log("[Chart] Got rows:", rows ? rows.length : 'null');
            
            if (rows && rows.length > 0) {
                console.log(`[Chart] Processing ${rows.length} rows from Spotfire`);
                const parsedData = this.parseSpotfireData(rows, dataView, options);
                if (parsedData && parsedData.length > 0) {
                    console.log(`[Chart] Parsed ${parsedData.length} series from data`);
                    return parsedData;
                } else {
                    console.log("[Chart] parseSpotfireData returned empty array");
                    return [];
                }
            } else {
                console.log("[Chart] No rows returned from dataView");
                return [];
            }
        } catch (e) {
            console.warn("[Chart] Error reading Spotfire data:", e.message, e);
            return [];
        }
    }

    parseSpotfireData(rows, dataView, options) {
        // Group rows by color/series
        const seriesMap = new Map();
        const colorPalette = Object.values(MARKET_COLORS);
        let colorIndex = 0;
        
        // Check which axes are available
        const hasMarketTypeAxis = options && options.hasMarketTypeAxis;
        const hasCurrentValueAxis = options && options.hasCurrentValueAxis;
        const hasValueChangeAxis = options && options.hasValueChangeAxis;
        
        console.log("[Chart] Parsing data - MarketType axis:", hasMarketTypeAxis, 
                    "CurrentValue axis:", hasCurrentValueAxis, 
                    "ValueChange axis:", hasValueChangeAxis);
        console.log("[Chart] Total rows to parse:", rows.length);
        
        // Debug first row structure
        if (rows.length > 0) {
            const firstRow = rows[0];
            console.log("[Chart] First row methods:", Object.keys(firstRow));
            try {
                console.log("[Chart] First row color():", firstRow.color());
                console.log("[Chart] First row categorical('X'):", firstRow.categorical("X"));
                console.log("[Chart] First row continuous('Y'):", firstRow.continuous("Y"));
            } catch (e) {
                console.log("[Chart] Error inspecting first row:", e.message);
            }
        }
        
        let skippedNoColor = 0;
        let skippedNoX = 0;
        let skippedNoY = 0;
        let successCount = 0;
        
        rows.forEach((row, rowIndex) => {
            try {
                // Get color/series value
                const colorObj = row.color();
                // The color object only has hexCode, but the actual series name comes from 
                // the categorical "Color" axis when color axis mode is categorical
                let colorValue = null;
                let hexColor = colorObj ? colorObj.hexCode : null;
                
                // Try to get the series name from the Color axis (categorical mode)
                try {
                    const colorCategorical = row.categorical("Color");
                    if (colorCategorical && colorCategorical.formattedValue) {
                        colorValue = colorCategorical.formattedValue();
                    } else if (colorCategorical && colorCategorical.value) {
                        const colorCatValue = colorCategorical.value();
                        if (colorCatValue && colorCatValue.length > 0) {
                            colorValue = colorCatValue[0].formattedValue ? colorCatValue[0].formattedValue() : colorCatValue[0].key;
                        }
                    }
                } catch (e) {
                    // Color axis might not be categorical, fallback to hexCode
                }
                
                // Fallback to hexCode if we couldn't get a series name
                if (!colorValue) {
                    colorValue = hexColor;
                }
                
                // Skip if no valid color/series identifier
                if (colorValue === null || colorValue === undefined) {
                    skippedNoColor++;
                    if (rowIndex < 3) console.log(`[Chart] Row ${rowIndex}: No color value`);
                    return;
                }
                
                // Get X value (categorical axis - date/time)
                const xCategorical = row.categorical("X");
                const xCategoricalValue = xCategorical && xCategorical.value && xCategorical.value();
                let xValue = null;
                if (xCategoricalValue && xCategoricalValue.length > 0) {
                    xValue = xCategoricalValue[0].key;
                } else {
                    const xContinuous = row.continuous("X");
                    xValue = xContinuous ? xContinuous.value() : null;
                }

                if (xValue === null || xValue === undefined) {
                    skippedNoX++;
                    if (rowIndex < 3) console.log(`[Chart] Row ${rowIndex}: No X value, categorical:`, xCategoricalValue);
                    return;
                }
                
                // Get Y value (continuous axis - numeric)
                const yContinuous = row.continuous("Y");
                const yValue = yContinuous ? yContinuous.value() : null;
                
                // Skip null Y values
                if (yValue === null || yValue === undefined || isNaN(yValue)) {
                    skippedNoY++;
                    if (rowIndex < 3) console.log(`[Chart] Row ${rowIndex}: No Y value, continuous:`, yContinuous);
                    return;
                }
                
                if (rowIndex < 3) {
                    console.log(`[Chart] Row ${rowIndex}: color=${colorValue}, x=${xValue}, y=${yValue}`);
                }
                successCount++;

                // Get MarketType value (categorical) - for filtering markets
                let marketType = "";
                if (hasMarketTypeAxis) {
                    try {
                        const marketTypeCat = row.categorical("MarketType");
                        const marketTypeValue = marketTypeCat && marketTypeCat.value && marketTypeCat.value();
                        if (marketTypeValue && marketTypeValue.length > 0) {
                            marketType = marketTypeValue[0].key;
                        }
                    } catch (e) {
                        // MarketType axis not configured, use default
                    }
                }

                // Get CurrentValue (continuous) - for legend display
                let currentValueFromAxis = null;
                if (hasCurrentValueAxis) {
                    try {
                        const currentValueCont = row.continuous("CurrentValue");
                        currentValueFromAxis = currentValueCont ? currentValueCont.value() : null;
                    } catch (e) {
                        // CurrentValue axis not configured
                    }
                }

                // Get ValueChange (continuous) - for legend display
                let valueChangeFromAxis = null;
                if (hasValueChangeAxis) {
                    try {
                        const valueChangeCont = row.continuous("ValueChange");
                        valueChangeFromAxis = valueChangeCont ? valueChangeCont.value() : null;
                    } catch (e) {
                        // ValueChange axis not configured
                    }
                }

                // Create series if not exists
                if (!seriesMap.has(colorValue)) {
                    // Get color from Spotfire (hexColor was captured earlier) or use default palette
                    const seriesColor = hexColor 
                        ? hexColor 
                        : colorPalette[colorIndex % colorPalette.length];
                    colorIndex++;
                    
                    seriesMap.set(colorValue, {
                        name: String(colorValue),
                        symbol: String(colorValue),
                        marketType: marketType,
                        color: seriesColor,
                        data: [],
                        currentValue: 0,
                        change: 0,
                        changePercent: 0,
                        // Store axis values for legend (will be updated with each row, last wins)
                        currentValueFromAxis: currentValueFromAxis,
                        valueChangeFromAxis: valueChangeFromAxis
                    });
                }

                const series = seriesMap.get(colorValue);
                
                // Update axis-based values if they exist (use latest/last value)
                if (currentValueFromAxis !== null) {
                    series.currentValueFromAxis = currentValueFromAxis;
                }
                if (valueChangeFromAxis !== null) {
                    series.valueChangeFromAxis = valueChangeFromAxis;
                }
                // Update market type if not already set
                if (!series.marketType && marketType) {
                    series.marketType = marketType;
                }

                // Parse date from X value
                let dateValue;
                if (xValue instanceof Date) {
                    dateValue = xValue;
                } else if (typeof xValue === 'number') {
                    // Unix timestamp in milliseconds
                    dateValue = new Date(xValue);
                } else if (typeof xValue === 'string') {
                    // Check if it's a numeric string (Unix timestamp)
                    const numericValue = Number(xValue);
                    if (!isNaN(numericValue) && numericValue > 1000000000000) {
                        // Looks like a millisecond timestamp
                        dateValue = new Date(numericValue);
                    } else if (!isNaN(numericValue) && numericValue > 1000000000) {
                        // Looks like a second timestamp, convert to milliseconds
                        dateValue = new Date(numericValue * 1000);
                    } else {
                        // Try to parse as date string
                        dateValue = new Date(xValue);
                    }
                } else {
                    // Try to parse as date
                    dateValue = new Date(xValue);
                }
                
                // Validate date
                if (isNaN(dateValue.getTime())) {
                    console.warn(`[Chart] Invalid date value: ${xValue} (type: ${typeof xValue})`);
                    return;
                }

                series.data.push({
                    date: dateValue,
                    value: Number(yValue)
                });
            } catch (rowError) {
                console.warn(`[Chart] Error processing row ${rowIndex}:`, rowError.message);
            }
        });

        // Sort by date and calculate summary values FROM THE ACTUAL FILTERED DATA
        // This ensures values update correctly when Spotfire filters are applied
        seriesMap.forEach(series => {
            series.data.sort((a, b) => a.date - b.date);
            if (series.data.length > 0) {
                const firstPoint = series.data[0];
                const lastPoint = series.data[series.data.length - 1];
                
                // Always calculate from the filtered data points (Y-axis values)
                // This ensures the legend reflects the currently visible/filtered data
                series.currentValue = lastPoint.value;
                series.change = lastPoint.value - firstPoint.value;
                
                // Calculate percentage change
                if (firstPoint.value !== 0 && Math.abs(firstPoint.value) > 1) {
                    // Values appear to be absolute (large numbers), calculate percentage
                    const absFirst = Math.abs(firstPoint.value);
                    if (absFirst !== 0 && isFinite(absFirst)) {
                        series.changePercent = ((lastPoint.value - firstPoint.value) / absFirst) * 100;
                    } else {
                        series.changePercent = lastPoint.value;
                    }
                } else {
                    // Values are already percentages (small values like -5.2, 3.1, etc.)
                    series.changePercent = lastPoint.value;
                }
                
                // Final safety check for Infinity/NaN
                if (!isFinite(series.changePercent) || isNaN(series.changePercent)) {
                    series.changePercent = lastPoint.value;
                }
                if (!isFinite(series.change) || isNaN(series.change)) {
                    series.change = 0;
                }
            }
        });

        const result = Array.from(seriesMap.values());
        console.log(`[Chart] Parse summary: ${successCount} rows parsed successfully, skipped: ${skippedNoColor} no color, ${skippedNoX} no X, ${skippedNoY} no Y`);
        console.log(`[Chart] Parsed series:`, result.map(s => `${s.name} (${s.marketType}): ${s.data.length} points, current: ${s.currentValue}, change: ${s.change}`));
        return result;
    }

    drawGrid(width, height, yScale, options) {
        this.gridGroup.selectAll("*").remove();

        if (!options.showGrid) return;

        const ticks = yScale.ticks(6);
        
        // Get theme colors from CSS variables (set by Spotfire theme)
        const computedStyle = getComputedStyle(document.documentElement);
        const gridColor = computedStyle.getPropertyValue('--sf-border-light').trim() || '#e0e0e0';
        const zeroLineColor = computedStyle.getPropertyValue('--sf-border-medium').trim() || '#999';

        // Horizontal grid lines
        this.gridGroup.selectAll(".grid-line")
            .data(ticks)
            .join("line")
            .attr("class", "grid-line")
            .attr("x1", 0)
            .attr("x2", width)
            .attr("y1", d => yScale(d))
            .attr("y2", d => yScale(d))
            .attr("stroke", gridColor)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "3,3");

        // Zero line (more prominent)
        if (yScale.domain()[0] < 0 && yScale.domain()[1] > 0) {
            this.gridGroup.append("line")
                .attr("class", "zero-line")
                .attr("x1", 0)
                .attr("x2", width)
                .attr("y1", yScale(0))
                .attr("y2", yScale(0))
                .attr("stroke", zeroLineColor)
                .attr("stroke-width", 1);
        }
    }

    drawAxes(width, height, xScale, yScale) {
        this.axisGroup.selectAll("*").remove();
        
        // Get theme colors from CSS variables (set by Spotfire theme)
        const computedStyle = getComputedStyle(document.documentElement);
        const textColor = computedStyle.getPropertyValue('--sf-scale-font-color').trim() || 
                          computedStyle.getPropertyValue('--sf-text-secondary').trim() || '#666';
        const lineColor = computedStyle.getPropertyValue('--sf-scale-line-stroke').trim() || 
                          computedStyle.getPropertyValue('--sf-border-medium').trim() || '#ccc';
        const tickColor = computedStyle.getPropertyValue('--sf-scale-tick-stroke').trim() || lineColor;
        const fontSize = computedStyle.getPropertyValue('--sf-scale-font-size').trim() || '12px';
        const fontFamily = computedStyle.getPropertyValue('--sf-scale-font-family').trim() || 'inherit';

        // X Axis
        const xAxis = d3.axisBottom(xScale)
            .ticks(6)
            .tickFormat(d3.timeFormat("%b %d"));

        this.axisGroup.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0, ${height})`)
            .call(xAxis)
            .selectAll("text")
            .attr("fill", textColor)
            .attr("font-size", fontSize)
            .attr("font-family", fontFamily);

        // Y Axis
        const yAxis = d3.axisLeft(yScale)
            .ticks(6)
            .tickFormat(d => `${d > 0 ? "+" : ""}${d.toFixed(0)}%`);

        this.axisGroup.append("g")
            .attr("class", "y-axis")
            .call(yAxis)
            .selectAll("text")
            .attr("fill", textColor)
            .attr("font-size", fontSize)
            .attr("font-family", fontFamily);

        // Style axis lines using theme colors
        this.axisGroup.selectAll(".domain").attr("stroke", lineColor);
        this.axisGroup.selectAll(".tick line").attr("stroke", tickColor);
    }

    drawLines(seriesData, xScale, yScale, height, options) {
        this.linesGroup.selectAll("*").remove();

        // Get line width from options (default 2.5)
        const lineWidth = options.lineWidth !== undefined ? options.lineWidth : 2.5;

        const line = d3.line()
            .x(d => xScale(d.date))
            .y(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        seriesData.forEach((series, i) => {
            const path = this.linesGroup.append("path")
                .datum(series.data)
                .attr("class", `line line-${i}`)
                .attr("data-series", series.symbol)
                .attr("fill", "none")
                .attr("stroke", series.color)
                .attr("stroke-width", lineWidth)
                .attr("stroke-linecap", "round")
                .attr("stroke-linejoin", "round")
                .attr("d", line);

            // Animate line drawing
            if (options.animateLines) {
                const totalLength = path.node().getTotalLength();
                path
                    .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
                    .attr("stroke-dashoffset", totalLength)
                    .transition()
                    .duration(1000)
                    .ease(d3.easeLinear)
                    .attr("stroke-dashoffset", 0);
            }
        });
    }

    drawEndDots(seriesData, xScale, yScale, options = {}) {
        this.dotsGroup.selectAll("*").remove();

        // Determine if dots should be shown (explicit check)
        const showDots = options.showDots === true || options.showDots === undefined;
        
        if (!showDots) {
            return;
        }

        seriesData.forEach((series, i) => {
            const lastPoint = series.data[series.data.length - 1];
            
            // Outer glow
            this.dotsGroup.append("circle")
                .attr("class", `dot-glow dot-glow-${i}`)
                .attr("data-series", series.symbol)
                .attr("cx", xScale(lastPoint.date))
                .attr("cy", yScale(lastPoint.value))
                .attr("r", 8)
                .attr("fill", series.color)
                .attr("opacity", 0.3);

            // Inner dot
            this.dotsGroup.append("circle")
                .attr("class", `dot dot-${i}`)
                .attr("data-series", series.symbol)
                .attr("cx", xScale(lastPoint.date))
                .attr("cy", yScale(lastPoint.value))
                .attr("r", 5)
                .attr("fill", series.color)
                .attr("stroke", "#fff")
                .attr("stroke-width", 2);
        });
    }

    drawLegend(seriesData, options = {}) {
        this.legend.selectAll("*").remove();

        // Determine if legend should be shown (explicit check)
        const showLegend = options.showLegend === true || options.showLegend === undefined;
        
        // Hide legend if showLegend is false
        if (!showLegend) {
            this.legend.style("display", "none");
            return;
        }
        
        // Show legend
        this.legend.style("display", "flex");

        // Add legend header row with column names
        const header = this.legend
            .append("div")
            .attr("class", "legend-header");
        
        header.append("span").attr("class", "legend-header-spacer"); // For color bar
        header.append("span").attr("class", "legend-header-name").text("Symbol");
        header.append("span").attr("class", "legend-header-value").text("Value");
        header.append("span").attr("class", "legend-header-change").text("Change");
        header.append("span").attr("class", "legend-header-percent").text("% Change");

        seriesData.forEach((series, i) => {
            const item = this.legend
                .append("div")
                .attr("class", "legend-item")
                .attr("data-series", series.symbol)
                .on("mouseenter", () => this.highlightSeries(series.symbol))
                .on("mouseleave", () => this.unhighlightSeries());

            // Color indicator (vertical bar)
            item.append("div")
                .attr("class", "legend-color-bar")
                .style("background-color", series.color);

            // Name
            item.append("span")
                .attr("class", "legend-name")
                .text(series.symbol);

            // Current value - format with commas for large numbers
            const valueText = Math.abs(series.currentValue) >= 1000 
                ? series.currentValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : series.currentValue.toFixed(2);
            item.append("span")
                .attr("class", "legend-value")
                .text(valueText);

            // Change value - handle Infinity/NaN
            const changeDisplay = isFinite(series.change) && !isNaN(series.change) 
                ? series.change.toFixed(2) 
                : "0.00";
            item.append("span")
                .attr("class", `legend-change ${series.change >= 0 ? "positive" : "negative"}`)
                .text(`${series.change >= 0 ? "+" : ""}${changeDisplay}`);

            // Percentage change with arrow - handle Infinity/NaN
            const percentDisplay = isFinite(series.changePercent) && !isNaN(series.changePercent)
                ? Math.abs(series.changePercent).toFixed(2)
                : "0.00";
            item.append("span")
                .attr("class", `legend-percent ${series.changePercent >= 0 ? "positive" : "negative"}`)
                .text(`${series.changePercent >= 0 ? "↑" : "↓"}${percentDisplay}%`);
        });
    }

    setupHoverInteractions(seriesData, xScale, yScale, width, height) {
        // Update hover overlay size
        this.hoverOverlay
            .attr("width", width)
            .attr("height", height);

        // Remove existing hover dots
        this.hoverGroup.selectAll(".hover-dot").remove();

        // Create hover dots for each series
        seriesData.forEach((series, i) => {
            this.hoverGroup.append("circle")
                .attr("class", `hover-dot hover-dot-${i}`)
                .attr("data-series", series.symbol)
                .attr("r", 6)
                .attr("fill", series.color)
                .attr("stroke", "#fff")
                .attr("stroke-width", 2)
                .style("opacity", 0)
                .style("pointer-events", "none");
        });

        const bisect = d3.bisector(d => d.date).left;

        this.hoverOverlay
            .on("mousemove", (event) => {
                const [mx] = d3.pointer(event);
                const x0 = xScale.invert(mx);

                // Show hover line
                this.hoverLine
                    .attr("x1", mx)
                    .attr("x2", mx)
                    .attr("y1", 0)
                    .attr("y2", height)
                    .style("opacity", 1);

                // Update hover dots and tooltip
                let tooltipContent = `<div class="tooltip-date">${d3.timeFormat("%B %d, %Y")(x0)}</div>`;
                
                seriesData.forEach((series, i) => {
                    const idx = bisect(series.data, x0, 1);
                    const d0 = series.data[idx - 1];
                    const d1 = series.data[idx];
                    
                    if (!d0 && !d1) return;
                    
                    const d = !d1 ? d0 : !d0 ? d1 : (x0 - d0.date > d1.date - x0 ? d1 : d0);

                    // Update dot position
                    this.hoverGroup.select(`.hover-dot-${i}`)
                        .attr("cx", xScale(d.date))
                        .attr("cy", yScale(d.value))
                        .style("opacity", 1);

                    tooltipContent += `
                        <div class="tooltip-row">
                            <span class="tooltip-color" style="background-color: ${series.color}"></span>
                            <span class="tooltip-name">${series.symbol}</span>
                            <span class="tooltip-value ${d.value >= 0 ? "positive" : "negative"}">
                                ${d.value >= 0 ? "+" : ""}${d.value.toFixed(2)}%
                            </span>
                        </div>
                    `;
                });

                // Show tooltip
                this.tooltip
                    .html(tooltipContent)
                    .style("opacity", 1)
                    .style("left", `${event.pageX + 15}px`)
                    .style("top", `${event.pageY - 10}px`);
            })
            .on("mouseleave", () => {
                this.hoverLine.style("opacity", 0);
                this.hoverGroup.selectAll(".hover-dot").style("opacity", 0);
                this.tooltip.style("opacity", 0);
            });
    }

    highlightSeries(symbol) {
        this.highlightedSeries = symbol;

        // Dim other lines
        this.linesGroup.selectAll("path")
            .attr("opacity", d => 0.2)
            .filter(`[data-series="${symbol}"]`)
            .attr("opacity", 1)
            .attr("stroke-width", 4);

        // Dim other dots
        this.dotsGroup.selectAll("circle")
            .attr("opacity", 0.2)
            .filter(`[data-series="${symbol}"]`)
            .attr("opacity", 1);

        // Highlight legend item
        this.legend.selectAll(".legend-item")
            .classed("dimmed", true)
            .filter(`[data-series="${symbol}"]`)
            .classed("dimmed", false)
            .classed("highlighted", true);
    }

    unhighlightSeries() {
        this.highlightedSeries = null;

        // Reset lines
        this.linesGroup.selectAll("path")
            .attr("opacity", 1)
            .attr("stroke-width", 2.5);

        // Reset dots
        this.dotsGroup.selectAll("circle")
            .attr("opacity", d => 1);

        // Reset legend
        this.legend.selectAll(".legend-item")
            .classed("dimmed", false)
            .classed("highlighted", false);
    }
}
