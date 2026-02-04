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
        this.legendWidth = 280;
        this.selectedTimePeriod = "MAX";
        this.selectedMarket = ""; // Empty means show all
        this.availableMarkets = []; // Will be populated from data
        this.dateRange = { min: null, max: null }; // Actual date range from data
        this.onTimePeriodChange = null;
        this.onMarketChange = null;
        this.yMeasures = []; // Track multiple Y measures
        this.yScales = {}; // Store scales for each measure
        
        // Marking support
        this.dataView = null; // Store reference for marking operations
        this.markingEnabled = false; // Track if marking is available
        this.outsideClickBound = false;
        
        // Rectangular marking state (following Spotfire pattern)
        this.rectangleMarking = {
            active: false,
            startPoint: null,
            rectangle: null
        };
        
        // Zoom state for X and Y axes
        this.zoomState = {
            xMin: 0,    // X-axis zoom start (0-1 range)
            xMax: 1,    // X-axis zoom end (0-1 range)
            yMin: 0,    // Y-axis zoom start (0-1 range)
            yMax: 1     // Y-axis zoom end (0-1 range)
        };
        
        // Classes to ignore when clearing marking (UI controls)
        this.ignoredClickClasses = [
            'tab-btn', 'period-btn', 'legend-item', 'legend-color-bar',
            'legend-name', 'legend-value', 'legend-change', 'legend-percent',
            'chart-header', 'chart-header-top', 'market-tabs', 'time-period-row',
            'time-periods', 'chart-title-section', 'skip-unmark',
            'zoom-slider', 'zoom-slider-wrapper', 'zoom-slider-track', 'zoom-slider-range',
            'x-zoom-container', 'y-zoom-container', 'chart-area-wrapper'
        ];
        
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

        // Create Y-axis zoom slider (left side)
        this.yZoomContainer = contentArea
            .append("div")
            .attr("class", "y-zoom-container skip-unmark");
        
        this.createYZoomSlider();

        // Create chart area wrapper (SVG + X zoom slider)
        const chartAreaWrapper = contentArea
            .append("div")
            .attr("class", "chart-area-wrapper");

        // Create SVG for the chart
        this.svg = chartAreaWrapper
            .append("svg")
            .attr("class", "chart-svg");

        // Create X-axis zoom slider (below chart)
        this.xZoomContainer = chartAreaWrapper
            .append("div")
            .attr("class", "x-zoom-container skip-unmark");
        
        this.createXZoomSlider();

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
            
        // Create marking rectangle for rectangular selection (Spotfire pattern)
        this.markingRect = this.chartGroup
            .append("path")
            .attr("class", "marking-rectangle")
            .attr("visibility", "hidden");
        
        // Setup mouse wheel zoom
        this.setupMouseWheelZoom();
    }

    /**
     * Create X-axis zoom slider (range slider)
     */
    createXZoomSlider() {
        const self = this;
        
        this.xZoomContainer.html(`
            <div class="zoom-slider-wrapper">
                <input type="range" class="zoom-slider zoom-slider-min" min="0" max="100" value="0" />
                <input type="range" class="zoom-slider zoom-slider-max" min="0" max="100" value="100" />
                <div class="zoom-slider-track"></div>
                <div class="zoom-slider-range"></div>
            </div>
        `);
        
        const minSlider = this.xZoomContainer.select('.zoom-slider-min');
        const maxSlider = this.xZoomContainer.select('.zoom-slider-max');
        const rangeTrack = this.xZoomContainer.select('.zoom-slider-range');
        
        this.updateXZoomSliders = () => {
            minSlider.property('value', Math.round(self.zoomState.xMin * 100));
            maxSlider.property('value', Math.round(self.zoomState.xMax * 100));
            const minVal = Math.round(self.zoomState.xMin * 100);
            const maxVal = Math.round(self.zoomState.xMax * 100);
            rangeTrack.style('left', minVal + '%').style('width', (maxVal - minVal) + '%');
        };
        
        const updateXRange = () => {
            const minVal = parseInt(minSlider.property('value'));
            const maxVal = parseInt(maxSlider.property('value'));
            
            // Ensure min doesn't exceed max
            if (minVal > maxVal - 5) {
                minSlider.property('value', maxVal - 5);
                return;
            }
            
            // Update visual range
            rangeTrack.style('left', minVal + '%').style('width', (maxVal - minVal) + '%');
            
            // Update zoom state
            self.zoomState.xMin = minVal / 100;
            self.zoomState.xMax = maxVal / 100;
            
            // Trigger re-render if we have a stored render context
            if (self.lastRenderContext) {
                self.applyZoom();
            }
        };
        
        minSlider.on('input', updateXRange);
        maxSlider.on('input', updateXRange);
        
        // Initialize range display
        this.updateXZoomSliders();
    }

    /**
     * Create Y-axis zoom slider (vertical range slider)
     */
    createYZoomSlider() {
        const self = this;
        
        this.yZoomContainer.html(`
            <div class="zoom-slider-wrapper vertical">
                <input type="range" class="zoom-slider zoom-slider-min" min="0" max="100" value="0" orient="vertical" />
                <input type="range" class="zoom-slider zoom-slider-max" min="0" max="100" value="100" orient="vertical" />
                <div class="zoom-slider-track"></div>
                <div class="zoom-slider-range"></div>
            </div>
        `);
        
        const minSlider = this.yZoomContainer.select('.zoom-slider-min');
        const maxSlider = this.yZoomContainer.select('.zoom-slider-max');
        const rangeTrack = this.yZoomContainer.select('.zoom-slider-range');
        
        this.updateYZoomSliders = () => {
            // Invert for display (Y-axis is inverted)
            const displayMin = Math.round((1 - self.zoomState.yMax) * 100);
            const displayMax = Math.round((1 - self.zoomState.yMin) * 100);
            minSlider.property('value', displayMin);
            maxSlider.property('value', displayMax);
            rangeTrack.style('bottom', displayMin + '%').style('height', (displayMax - displayMin) + '%');
        };
        
        const updateYRange = () => {
            const minVal = parseInt(minSlider.property('value'));
            const maxVal = parseInt(maxSlider.property('value'));
            
            // Ensure min doesn't exceed max
            if (minVal > maxVal - 5) {
                minSlider.property('value', maxVal - 5);
                return;
            }
            
            // For Y-axis, invert values (slider goes top to bottom, but values go bottom to top)
            const invertedMin = 100 - maxVal;
            const invertedMax = 100 - minVal;
            
            // Update visual range (position from bottom)
            rangeTrack.style('bottom', minVal + '%').style('height', (maxVal - minVal) + '%');
            
            // Update zoom state (inverted for Y-axis)
            self.zoomState.yMin = invertedMin / 100;
            self.zoomState.yMax = invertedMax / 100;
            
            // Trigger re-render if we have a stored render context
            if (self.lastRenderContext) {
                self.applyZoom();
            }
        };
        
        minSlider.on('input', updateYRange);
        maxSlider.on('input', updateYRange);
        
        // Initialize range display
        this.updateYZoomSliders();
    }

    /**
     * Setup mouse wheel zoom on chart area
     */
    setupMouseWheelZoom() {
        const self = this;
        
        this.svg.on('wheel.zoom', function(event) {
            event.preventDefault();
            
            const delta = event.deltaY;
            const zoomFactor = delta > 0 ? 0.05 : -0.05; // Zoom in/out by 5%
            
            // Check if Shift key is pressed for Y-axis zoom, otherwise X-axis zoom
            if (event.shiftKey) {
                // Y-axis zoom
                const currentRange = self.zoomState.yMax - self.zoomState.yMin;
                const newRange = Math.max(0.1, Math.min(1, currentRange + zoomFactor));
                const center = (self.zoomState.yMin + self.zoomState.yMax) / 2;
                
                self.zoomState.yMin = Math.max(0, center - newRange / 2);
                self.zoomState.yMax = Math.min(1, center + newRange / 2);
                
                // Adjust if we hit boundaries
                if (self.zoomState.yMin === 0) {
                    self.zoomState.yMax = Math.min(1, newRange);
                }
                if (self.zoomState.yMax === 1) {
                    self.zoomState.yMin = Math.max(0, 1 - newRange);
                }
                
                if (self.updateYZoomSliders) self.updateYZoomSliders();
            } else {
                // X-axis zoom
                const currentRange = self.zoomState.xMax - self.zoomState.xMin;
                const newRange = Math.max(0.1, Math.min(1, currentRange + zoomFactor));
                const center = (self.zoomState.xMin + self.zoomState.xMax) / 2;
                
                self.zoomState.xMin = Math.max(0, center - newRange / 2);
                self.zoomState.xMax = Math.min(1, center + newRange / 2);
                
                // Adjust if we hit boundaries
                if (self.zoomState.xMin === 0) {
                    self.zoomState.xMax = Math.min(1, newRange);
                }
                if (self.zoomState.xMax === 1) {
                    self.zoomState.xMin = Math.max(0, 1 - newRange);
                }
                
                if (self.updateXZoomSliders) self.updateXZoomSliders();
            }
            
            // Apply zoom
            if (self.lastRenderContext) {
                self.applyZoom();
            }
        });
    }

    /**
     * Reset zoom to default state (full view)
     */
    resetZoom() {
        this.zoomState.xMin = 0;
        this.zoomState.xMax = 1;
        this.zoomState.yMin = 0;
        this.zoomState.yMax = 1;
        
        if (this.updateXZoomSliders) this.updateXZoomSliders();
        if (this.updateYZoomSliders) this.updateYZoomSliders();
        
        if (this.lastRenderContext) {
            this.applyZoom();
        }
    }

    /**
     * Apply zoom to the current chart view
     */
    applyZoom() {
        if (!this.lastRenderContext) return;
        
        const { xScale, yScales, chartWidth, chartHeight, seriesData } = this.lastRenderContext;
        
        // Calculate zoomed domain for X-axis
        const fullXDomain = xScale.domain();
        const xRange = fullXDomain[1].getTime() - fullXDomain[0].getTime();
        const zoomedXMin = new Date(fullXDomain[0].getTime() + xRange * this.zoomState.xMin);
        const zoomedXMax = new Date(fullXDomain[0].getTime() + xRange * this.zoomState.xMax);
        
        // Create zoomed X scale
        const zoomedXScale = d3.scaleTime()
            .domain([zoomedXMin, zoomedXMax])
            .range([0, chartWidth]);
        
        // Create zoomed Y scales
        const zoomedYScales = {};
        Object.keys(yScales).forEach(axisIdx => {
            const fullYDomain = yScales[axisIdx].domain();
            const yRange = fullYDomain[1] - fullYDomain[0];
            const zoomedYMin = fullYDomain[0] + yRange * this.zoomState.yMin;
            const zoomedYMax = fullYDomain[0] + yRange * this.zoomState.yMax;
            
            zoomedYScales[axisIdx] = d3.scaleLinear()
                .domain([zoomedYMin, zoomedYMax])
                .range([chartHeight, 0]);
        });
        
        // Redraw with zoomed scales
        this.drawGrid(chartWidth, chartHeight, zoomedYScales[0] || Object.values(zoomedYScales)[0], this.lastRenderContext.options);
        this.redrawAxesWithZoom(chartWidth, chartHeight, zoomedXScale, zoomedYScales);
        this.drawLines(seriesData, zoomedXScale, zoomedYScales, chartHeight, this.lastRenderContext.options);
        this.drawEndDots(seriesData, zoomedXScale, zoomedYScales, this.lastRenderContext.options);
    }

    /**
     * Redraw axes with zoomed scales
     */
    redrawAxesWithZoom(width, height, xScale, yScales) {
        this.axisGroup.selectAll("*").remove();
        
        const computedStyle = getComputedStyle(document.documentElement);
        const textColor = computedStyle.getPropertyValue('--sf-scale-font-color').trim() || 
                          computedStyle.getPropertyValue('--sf-text-secondary').trim() || '#666';
        const lineColor = computedStyle.getPropertyValue('--sf-scale-line-stroke').trim() || 
                          computedStyle.getPropertyValue('--sf-border-medium').trim() || '#ccc';
        const tickColor = computedStyle.getPropertyValue('--sf-scale-tick-stroke').trim() || lineColor;
        const fontSize = computedStyle.getPropertyValue('--sf-scale-font-size').trim() || '12px';
        const fontFamily = computedStyle.getPropertyValue('--sf-scale-font-family').trim() || 'inherit';

        // X-axis
        const xAxis = d3.axisBottom(xScale)
            .ticks(Math.max(4, Math.min(10, Math.floor(width / 80))))
            .tickFormat(d => this.formatXAxisFallbackLabel(d, xScale));

        const xAxisGroup = this.axisGroup.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0, ${height})`)
            .call(xAxis);
        
        xAxisGroup.selectAll("text")
            .attr("fill", textColor)
            .attr("font-size", fontSize)
            .attr("font-family", fontFamily);
        xAxisGroup.select(".domain").attr("stroke", lineColor);
        xAxisGroup.selectAll(".tick line").attr("stroke", tickColor);

        // Y-axes
        const yScalesObj = typeof yScales === 'object' && !yScales.domain ? yScales : { 0: yScales };
        const axisIndices = Object.keys(yScalesObj);
        
        axisIndices.forEach((axisIdx, i) => {
            const yScale = yScalesObj[axisIdx];
            const isLeftAxis = i % 2 === 0;
            
            const yAxis = isLeftAxis ? d3.axisLeft(yScale) : d3.axisRight(yScale);
            yAxis.ticks(6).tickFormat(d => this.formatSmartNumber(d));

            const axisGroup = this.axisGroup.append("g")
                .attr("class", `y-axis y-axis-${i}`)
                .attr("transform", isLeftAxis ? "" : `translate(${width}, 0)`)
                .call(yAxis);
            
            axisGroup.selectAll("text")
                .attr("fill", textColor)
                .attr("font-size", fontSize)
                .attr("font-family", fontFamily);
            axisGroup.select(".domain").attr("stroke", lineColor);
            axisGroup.selectAll(".tick line").attr("stroke", tickColor);
        });
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
                .text("COMPARE APPLICATIONS");

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
        const minDate = this.dateRange.min;
        const maxDate = this.dateRange.max;
        const dataSpanDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
        
        // Use the max date in data as reference point (not system's current date)
        // This handles historical data correctly
        const referenceDate = maxDate;
        const startOfYear = new Date(referenceDate.getFullYear(), 0, 1);

        // Only show periods that make sense for the data range
        if (dataSpanDays >= 1) periods.push("1D");
        if (dataSpanDays >= 5) periods.push("5D");
        if (dataSpanDays >= 30) periods.push("1M");
        if (dataSpanDays >= 180) periods.push("6M");
        
        // YTD: Check if data spans from start of the year containing the max date
        if (minDate <= startOfYear) {
            periods.push("YTD");
        }
        
        if (dataSpanDays >= 365) periods.push("1Y");
        if (dataSpanDays >= 1825) periods.push("5Y");

        // Always show MAX
        periods.push("MAX");

        return periods;
    }

    formatSmartNumber(value) {
        if (!isFinite(value) || isNaN(value)) return "0";
        const sign = value < 0 ? "-" : value > 0 ? "+" : "";
        const abs = Math.abs(value);
        if (abs < 0.005) return "0";
        let formatted = "";

        if (abs >= 1e9) {
            formatted = (abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1) + "B";
        } else if (abs >= 1e6) {
            formatted = (abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1) + "M";
        } else if (abs >= 1e3) {
            formatted = (abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1) + "K";
        } else if (abs >= 100) {
            formatted = abs.toFixed(0);
        } else if (abs >= 10) {
            formatted = abs.toFixed(1);
        } else {
            formatted = abs.toFixed(2);
        }

        return `${sign}${formatted}`;
    }

    formatXAxisFallbackLabel(dateValue, xScale) {
        const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
        if (isNaN(date.getTime())) {
            return String(dateValue);
        }

        const dateExtent = xScale.domain();
        const daysDiff = (dateExtent[1] - dateExtent[0]) / (1000 * 60 * 60 * 24);

        if (daysDiff <= 7) {
            return d3.timeFormat("%a %d")(date);
        } else if (daysDiff <= 365) {
            return d3.timeFormat("%b %d")(date);
        }
        return d3.timeFormat("%b '%y")(date);
    }

    getXAxisLabelParts(dateValue, dateToLabelMap, xScale, allowFullLabel = false) {
        const timestamp = dateValue instanceof Date ? dateValue.getTime() : dateValue;
        const labelFromMap = dateToLabelMap.get(timestamp);

        // If we have a label from the data, show it as-is (user's selected format)
        if (labelFromMap) {
            // If it's a parseable date, show full label as provided by the user
            const parsed = new Date(labelFromMap);
            if (!isNaN(parsed.getTime())) {
                return { line1: labelFromMap, line2: "" };
            }

            // Non-date label - show as-is with slightly higher limit
            if (allowFullLabel) {
                return { line1: labelFromMap, line2: "" };
            }
            const trimmed = labelFromMap.length > 18 ? `${labelFromMap.substring(0, 16)}...` : labelFromMap;
            return { line1: trimmed, line2: "" };
        }

        // Fallback for dates without labels
        if (dateValue instanceof Date) {
            const dateExtent = xScale.domain();
            const daysDiff = (dateExtent[1] - dateExtent[0]) / (1000 * 60 * 60 * 24);
            
            if (daysDiff <= 31) {
                return {
                    line1: d3.timeFormat("%b %d")(dateValue),
                    line2: d3.timeFormat("%Y")(dateValue)
                };
            } else if (daysDiff <= 365) {
                return {
                    line1: d3.timeFormat("%b %d")(dateValue),
                    line2: d3.timeFormat("%Y")(dateValue)
                };
            } else {
                return {
                    line1: d3.timeFormat("%b")(dateValue),
                    line2: d3.timeFormat("%Y")(dateValue)
                };
            }
        }

        const fallback = this.formatXAxisFallbackLabel(dateValue, xScale);
        const trimmed = fallback.length > 15 ? `${fallback.substring(0, 13)}...` : fallback;
        return { line1: trimmed, line2: "" };
    }

    applyTwoLineXAxisLabels(xAxisGroup, dateToLabelMap, xScale, allowFullLabel = false) {
        xAxisGroup.selectAll(".tick text")
            .attr("dy", 0)
            .each((d, i, nodes) => {
                const text = d3.select(nodes[i]);
                const { line1, line2 } = this.getXAxisLabelParts(d, dateToLabelMap, xScale, allowFullLabel);
                text.text(null);
                text.append("tspan")
                    .attr("x", 0)
                    .attr("dy", "0")
                    .text(line1);
                if (line2) {
                    text.append("tspan")
                        .attr("x", 0)
                        .attr("dy", "1.1em")
                        .text(line2);
                }
            });
    }

    async render(dataView, windowSize, options) {
        console.log("[Chart] render called with windowSize:", windowSize, "options:", options);
        
        // Store dataView reference for marking operations
        this.dataView = dataView;
        
        // Check if marking is enabled
        try {
            const markingInfo = await dataView.marking();
            this.markingEnabled = markingInfo !== null;
            console.log("[Chart] Marking enabled:", this.markingEnabled, markingInfo);
        } catch (e) {
            this.markingEnabled = false;
            console.log("[Chart] Marking not available:", e.message);
        }
        
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
            if (width < 700) {
                legendWidth = 0; // Legend moves to bottom in CSS
            } else if (width < 1000) {
                legendWidth = 220;
            } else if (width >= 1200) {
                legendWidth = 300;
            } else {
                legendWidth = this.legendWidth;
            }
        }

        // Account for left-side Y zoom container width to prevent overflow
        const yZoomWidth = this.yZoomContainer && this.yZoomContainer.node()
            ? (this.yZoomContainer.node().offsetWidth || 0)
            : 0;

        // Calculate available space for the chart
        const svgWidth = Math.max(0, width - legendWidth - yZoomWidth);
        const svgHeight = height - headerHeight;

        // Update SVG dimensions
        this.svg
            .attr("width", svgWidth)
            .attr("height", svgHeight);

        // Get data first to determine if we need multiple Y-axes (affects margins)
        const rawSeriesData = await this.getData(dataView, options);
        console.log("[Chart] Got seriesData:", rawSeriesData.length, "series");
        
        // Count unique Y-axis indices to determine if we need a right Y-axis
        const uniqueAxisIndices = [...new Set(rawSeriesData.map(s => s.yAxisIndex || 0))];
        const hasMultipleYAxes = uniqueAxisIndices.length > 1;
        
        // Early check for hierarchical X-axis labels (affects bottom margin)
        const hasHierarchicalLabelsEarly = rawSeriesData.some(s => 
            s.data.some(d => d.displayLabel && d.displayLabel.includes("||"))
        );
        let hierarchyLevelCountEarly = 1;
        if (hasHierarchicalLabelsEarly) {
            const sampleLabel = rawSeriesData
                .flatMap(s => s.data)
                .find(d => d.displayLabel && d.displayLabel.includes("||"));
            if (sampleLabel) {
                hierarchyLevelCountEarly = sampleLabel.displayLabel.split("||").length;
            }
        }
        
        // Calculate extra bottom margin for multi-level X-axis (18px per additional level)
        const multiLevelBottomMargin = hasHierarchicalLabelsEarly && hierarchyLevelCountEarly > 1
            ? 20 + (hierarchyLevelCountEarly * 18) // Base row + extra rows
            : 0;

        // Add space for two-line X-axis labels when not using hierarchical labels
        const twoLineXAxisMargin = hasHierarchicalLabelsEarly ? 0 : 16;

        // Add space for Y-axis titles
        const axisTitleMargin = 18;
        
        // Adjust margins dynamically
        const dynamicMargin = {
            ...this.margin,
            left: this.margin.left + axisTitleMargin,
            right: (hasMultipleYAxes ? 55 : this.margin.right) + (hasMultipleYAxes ? axisTitleMargin : 0),
            bottom: this.margin.bottom + multiLevelBottomMargin + twoLineXAxisMargin
        };

        const chartWidth = svgWidth - dynamicMargin.left - dynamicMargin.right;
        const chartHeight = svgHeight - dynamicMargin.top - dynamicMargin.bottom;
        
        console.log("[Chart] Chart dimensions - width:", chartWidth, "height:", chartHeight, "multiY:", hasMultipleYAxes);

        if (chartWidth < 100 || chartHeight < 100) {
            console.warn("[Chart] Chart too small, skipping render:", chartWidth, "x", chartHeight);
            return;
        }

        this.chartGroup.attr("transform", `translate(${dynamicMargin.left}, ${dynamicMargin.top})`);
        
        // Update clip path to match chart area with padding for dots (10px extra on each side)
        const clipPadding = 24;
        this.clipRect
            .attr("x", -clipPadding)
            .attr("y", -clipPadding)
            .attr("width", chartWidth + clipPadding * 2)
            .attr("height", chartHeight + clipPadding * 2);

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

        // Build a map of date timestamps to display labels for X-axis formatting
        const dateToLabelMap = new Map();
        seriesData.forEach(series => {
            series.data.forEach(d => {
                if (d.displayLabel) {
                    dateToLabelMap.set(d.date.getTime(), d.displayLabel);
                }
            });
        });
        
        // Check if we have hierarchical labels (multiple X columns)
        // Using || as separator for multi-level hierarchy
        const hasHierarchicalLabels = seriesData.some(s => 
            s.data.some(d => d.displayLabel && d.displayLabel.includes("||"))
        );
        
        // Count the number of hierarchy levels
        let hierarchyLevelCount = 1;
        if (hasHierarchicalLabels) {
            const sampleLabel = seriesData
                .flatMap(s => s.data)
                .find(d => d.displayLabel && d.displayLabel.includes("||"));
            if (sampleLabel) {
                hierarchyLevelCount = sampleLabel.displayLabel.split("||").length;
            }
        }

        // Group series by Y-axis index for multi-axis support
        const seriesByAxis = {};
        seriesData.forEach(series => {
            const axisIdx = series.yAxisIndex || 0;
            if (!seriesByAxis[axisIdx]) {
                seriesByAxis[axisIdx] = [];
            }
            seriesByAxis[axisIdx].push(series);
        });
        
        const numYAxes = Math.max(1, Object.keys(seriesByAxis).length);
        this.yScales = {};
        
        // Create Y scale for each axis group
        Object.keys(seriesByAxis).forEach((axisIdx, idx) => {
            const axisSeriesData = seriesByAxis[axisIdx];
            const axisValues = axisSeriesData.flatMap(s => s.data.map(d => d.value));
            
            const yMinVal = d3.min(axisValues);
            const yMaxVal = d3.max(axisValues);
            
            const yMin = Math.min(yMinVal || 0, 0);
            const yMax = Math.max(yMaxVal || 0, 0);
            const yPadding = Math.max((yMax - yMin) * 0.1, 1);
            
            this.yScales[axisIdx] = d3.scaleLinear()
                .domain([yMin - yPadding, yMax + yPadding])
                .range([chartHeight, 0]);
                
            console.log(`[Chart] Y-axis ${axisIdx} scale domain:`, [yMin - yPadding, yMax + yPadding]);
        });
        
        // Use primary scale for backward compatibility
        const yScale = this.yScales[0] || this.yScales[Object.keys(this.yScales)[0]];

        const yMinVal = d3.min(allValues);
        const yMaxVal = d3.max(allValues);
        console.log("[Chart] Y range - min:", yMinVal, "max:", yMaxVal);

        // Draw grid (uses primary Y scale)
        this.drawGrid(chartWidth, chartHeight, yScale, options);

        // Draw axes (supports multiple Y axes, passes label map for X-axis formatting)
        this.drawAxes(
            chartWidth,
            chartHeight,
            xScale,
            this.yScales,
            seriesByAxis,
            dateToLabelMap,
            hasHierarchicalLabels,
            hierarchyLevelCount,
            options.yAxisTitles || []
        );

        // Draw lines (uses appropriate scale per series)
        this.drawLines(seriesData, xScale, this.yScales, chartHeight, options);

        // Draw end dots (uses appropriate scale per series)
        this.drawEndDots(filteredData, xScale, this.yScales, options);

        // Draw legend (pass options to control visibility)
        this.drawLegend(filteredData, options);

        // Setup hover interactions (pass label map for tooltip)
        this.setupHoverInteractions(filteredData, xScale, this.yScales, chartWidth, chartHeight, dateToLabelMap);
        
        // Setup rectangular marking selection (Spotfire pattern)
        this.setupRectangularMarking(filteredData, xScale, this.yScales, chartWidth, chartHeight);
        
        // Store render context for zoom functionality
        this.lastRenderContext = {
            xScale: xScale,
            yScales: this.yScales,
            chartWidth: chartWidth,
            chartHeight: chartHeight,
            seriesData: filteredData,
            options: options,
            dateToLabelMap: dateToLabelMap
        };
    }

    /**
     * Filter series data based on selected time period
     */
    filterDataByTimePeriod(seriesData, timePeriod) {
        if (!timePeriod || timePeriod === "MAX") {
            return seriesData;
        }

        // Use the max date from data as reference point (not system's current date)
        // This correctly handles historical data
        const referenceDate = this.dateRange.max || new Date();
        let startDate;

        switch (timePeriod) {
            case "1D":
                startDate = new Date(referenceDate);
                startDate.setDate(referenceDate.getDate() - 1);
                break;
            case "5D":
                startDate = new Date(referenceDate);
                startDate.setDate(referenceDate.getDate() - 5);
                break;
            case "1M":
                startDate = new Date(referenceDate);
                startDate.setMonth(referenceDate.getMonth() - 1);
                break;
            case "6M":
                startDate = new Date(referenceDate);
                startDate.setMonth(referenceDate.getMonth() - 6);
                break;
            case "YTD":
                // Start of the year containing the reference date
                startDate = new Date(referenceDate.getFullYear(), 0, 1);
                break;
            case "1Y":
                startDate = new Date(referenceDate);
                startDate.setFullYear(referenceDate.getFullYear() - 1);
                break;
            case "5Y":
                startDate = new Date(referenceDate);
                startDate.setFullYear(referenceDate.getFullYear() - 5);
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
                
                // Get X value (categorical axis - date/time, supports multiple columns)
                const xCategorical = row.categorical("X");
                const xCategoricalValue = xCategorical && xCategorical.value && xCategorical.value();
                let xValue = null;
                let xHierarchyKey = null; // Composite key for multiple X columns
                let xDisplayLabel = null; // Formatted label for X-axis display
                
                if (xCategoricalValue && xCategoricalValue.length > 0) {
                    // Multiple categorical columns (e.g., Year, Month, Week)
                    // Create a composite key and formatted display label
                    if (xCategoricalValue.length > 1) {
                        // Build hierarchical key: "2024|January|Week 1"
                        xHierarchyKey = xCategoricalValue.map(v => v.key).join("|");
                        
                        // Build hierarchical parts array for multi-level axis display
                        // Each part is: { level: index, value: formatted value }
                        const hierarchyParts = xCategoricalValue.map((v, idx) => ({
                            level: idx,
                            value: v.formattedValue ? v.formattedValue() : v.key
                        }));
                        
                        // Store full hierarchy parts as JSON for multi-level axis rendering
                        // Format: "level0Value||level1Value||level2Value" (uses || as separator to avoid conflicts)
                        xDisplayLabel = hierarchyParts.map(p => p.value).join("||");
                        
                        // Use the last (finest) value as the primary x value for parsing
                        xValue = xCategoricalValue[xCategoricalValue.length - 1].key;
                    } else {
                        xValue = xCategoricalValue[0].key;
                        xHierarchyKey = xValue;
                        xDisplayLabel = xCategoricalValue[0].formattedValue 
                            ? xCategoricalValue[0].formattedValue() 
                            : xValue;
                    }
                } else {
                    const xContinuous = row.continuous("X");
                    xValue = xContinuous ? xContinuous.value() : null;
                    xHierarchyKey = xValue;
                    // For continuous X values (dates/numbers), format nicely
                    if (xValue instanceof Date) {
                        xDisplayLabel = d3.timeFormat("%b %d, %Y")(xValue);
                    } else if (typeof xValue === 'number' && xValue > 1000000000) {
                        // Likely a timestamp, format as date
                        const dateVal = xValue > 1000000000000 ? new Date(xValue) : new Date(xValue * 1000);
                        xDisplayLabel = d3.timeFormat("%b %d, %Y")(dateVal);
                    } else {
                        xDisplayLabel = xValue;
                    }
                }

                if (xValue === null || xValue === undefined) {
                    skippedNoX++;
                    if (rowIndex < 3) console.log(`[Chart] Row ${rowIndex}: No X value, categorical:`, xCategoricalValue);
                    return;
                }
                
                // Get Y values (continuous axis - may have multiple measures)
                // Support for multiple Y-axis measures
                const yValues = {};
                let primaryYValue = null;
                let yMeasureIndex = 0;
                
                try {
                    // Try to get all Y axis values (multiple measures support)
                    const yAxisNode = row.continuous("Y");
                    if (yAxisNode) {
                        // Check if there are multiple values
                        if (typeof yAxisNode.value === 'function') {
                            const val = yAxisNode.value();
                            if (val !== null && val !== undefined && !isNaN(val)) {
                                primaryYValue = val;
                                const measureName = yAxisNode.name ? yAxisNode.name() : "Y";
                                yValues[measureName] = val;
                                yMeasureIndex = 0;
                            }
                        }
                    }
                } catch (e) {
                    if (rowIndex < 3) console.log(`[Chart] Row ${rowIndex}: Error getting Y values:`, e.message);
                }
                
                // Skip if no Y values found
                if (primaryYValue === null || primaryYValue === undefined || isNaN(primaryYValue)) {
                    skippedNoY++;
                    if (rowIndex < 3) console.log(`[Chart] Row ${rowIndex}: No Y value found`);
                    return;
                }
                
                if (rowIndex < 3) {
                    console.log(`[Chart] Row ${rowIndex}: color=${colorValue}, x=${xValue}, y=${primaryYValue}, yValues:`, yValues);
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
                    
                    // Assign Y-axis index for multiple axes support
                    // Each series gets assigned to an axis (alternates if multiple measures)
                    const yAxisIndex = colorIndex % Math.max(1, Object.keys(yValues).length);
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
                        yAxisIndex: yAxisIndex, // Track which Y-axis this series uses
                        yMeasureName: Object.keys(yValues)[yAxisIndex] || "Y",
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

                // Store with hierarchical key for proper aggregation
                // Include the Spotfire row reference for marking support
                const dataPoint = {
                    date: dateValue,
                    value: Number(primaryYValue),
                    hierarchyKey: xHierarchyKey,
                    displayLabel: xDisplayLabel, // User-friendly label for X-axis
                    originalXValue: xValue,
                    row: row, // Store Spotfire row reference for marking
                    isMarked: row.isMarked ? row.isMarked() : false // Track marked state
                };
                
                // Check if we already have a point with this hierarchy key (for aggregation)
                const existingPointIndex = series.data.findIndex(d => d.hierarchyKey === xHierarchyKey);
                if (existingPointIndex >= 0) {
                    // Aggregate: keep all rows for marking, but update display value
                    const existingPoint = series.data[existingPointIndex];
                    if (!existingPoint.rows) {
                        existingPoint.rows = [existingPoint.row];
                    }
                    existingPoint.rows.push(row);
                    existingPoint.value = Number(primaryYValue); // Update to latest value
                    existingPoint.isMarked = existingPoint.isMarked || dataPoint.isMarked;
                } else {
                    dataPoint.rows = [row]; // Initialize rows array
                    series.data.push(dataPoint);
                }
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
                
                // Track if any data point in this series is marked
                series.hasMarkedData = series.data.some(d => d.isMarked);
                
                // Collect all rows for this series (for series-level marking)
                series.allRows = series.data.flatMap(d => d.rows || [d.row]).filter(r => r);
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

    drawAxes(width, height, xScale, yScales, seriesByAxis = {}, dateToLabelMap = new Map(), hasHierarchicalLabels = false, hierarchyLevelCount = 1, axisTitles = []) {
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
        const borderLight = computedStyle.getPropertyValue('--sf-border-light').trim() || '#e0e0e0';

        // Determine tick count based on chart width and hierarchy
        const baseTickCount = Math.max(4, Math.min(10, Math.floor(width / 80)));
        const tickCount = hasHierarchicalLabels ? Math.min(baseTickCount, dateToLabelMap.size) : baseTickCount;

        if (hasHierarchicalLabels && hierarchyLevelCount > 1) {
            // Multi-level X-axis: Create separate rows for each hierarchy level
            this.drawMultiLevelXAxis(width, height, xScale, dateToLabelMap, hierarchyLevelCount, {
                textColor, lineColor, tickColor, fontSize, fontFamily, borderLight, tickCount
            });
        } else {
            // Standard single-level X-axis
            const xAxis = d3.axisBottom(xScale)
                .ticks(tickCount)
                .tickFormat(d => {
                    const timestamp = d instanceof Date ? d.getTime() : d;
                    const label = dateToLabelMap.get(timestamp);
                    
                    if (label) {
                        // Use the label from data as-is for single-level axes
                        return label;
                    } else {
                        return this.formatXAxisFallbackLabel(d, xScale);
                    }
                });

            const xAxisGroup = this.axisGroup.append("g")
                .attr("class", "x-axis")
                .attr("transform", `translate(0, ${height})`)
                .call(xAxis);
            
            xAxisGroup.selectAll("text")
                .attr("fill", textColor)
                .attr("font-size", fontSize)
                .attr("font-family", fontFamily);
                
            xAxisGroup.select(".domain").attr("stroke", lineColor);
            xAxisGroup.selectAll(".tick line").attr("stroke", tickColor);

            this.applyTwoLineXAxisLabels(xAxisGroup, dateToLabelMap, xScale, true);
        }

        // Handle yScales as object (multiple Y-axes) or single scale (backward compatibility)
        const yScalesObj = typeof yScales === 'object' && !yScales.domain ? yScales : { 0: yScales };
        const axisIndices = Object.keys(yScalesObj);
        const numAxes = axisIndices.length;
        
        // Define colors for multiple Y-axes (matching series colors if available)
        const axisColors = [];
        axisIndices.forEach(idx => {
            if (seriesByAxis[idx] && seriesByAxis[idx].length > 0) {
                axisColors.push(seriesByAxis[idx][0].color);
            } else {
                axisColors.push(textColor);
            }
        });

        // Draw Y-axes (left for first, right for second, alternating)
        axisIndices.forEach((axisIdx, i) => {
            const yScale = yScalesObj[axisIdx];
            const isLeftAxis = i % 2 === 0;
            
            // Create axis generator
            const yAxis = isLeftAxis 
                ? d3.axisLeft(yScale)
                : d3.axisRight(yScale);
            
            yAxis.ticks(6)
                .tickFormat(d => this.formatSmartNumber(d));

            // Position the axis
            const axisGroup = this.axisGroup.append("g")
                .attr("class", `y-axis y-axis-${i}`)
                .attr("transform", isLeftAxis ? "" : `translate(${width}, 0)`)
                .call(yAxis);
            
            // Style axis text with axis color for multi-axis distinction
            const axisColor = numAxes > 1 ? axisColors[i] : textColor;
            axisGroup.selectAll("text")
                .attr("fill", axisColor)
                .attr("font-size", fontSize)
                .attr("font-family", fontFamily);
            
            // Style axis line and ticks
            axisGroup.select(".domain").attr("stroke", numAxes > 1 ? axisColor : lineColor);
            axisGroup.selectAll(".tick line").attr("stroke", numAxes > 1 ? axisColor : tickColor);
            
            // Y-axis labels removed as per requirement
        });

        // Style all axis lines using theme colors (for single axis mode)
        if (numAxes === 1) {
            this.axisGroup.selectAll(".domain").attr("stroke", lineColor);
            this.axisGroup.selectAll(".tick line").attr("stroke", tickColor);
        }
    }

    /**
     * Draw multi-level X-axis with hierarchical labels
     * Creates grouped labels where higher-level categories span their child elements
     * Example: Year spans months, Month spans days, etc.
     */
    drawMultiLevelXAxis(width, height, xScale, dateToLabelMap, levelCount, styles) {
        const { textColor, lineColor, tickColor, fontSize, fontFamily, borderLight, tickCount } = styles;
        
        // Parse hierarchy data from label map
        // Structure: { timestamp: "Level0||Level1||Level2", ... }
        const hierarchyData = [];
        dateToLabelMap.forEach((label, timestamp) => {
            const parts = label.split("||");
            hierarchyData.push({
                timestamp: timestamp,
                x: xScale(new Date(timestamp)),
                levels: parts
            });
        });
        
        // Sort by x position
        hierarchyData.sort((a, b) => a.x - b.x);
        
        if (hierarchyData.length === 0) return;
        
        // Calculate spacing and layout
        const rowHeight = 18; // Height per hierarchy level row
        const finestLevelRowY = height; // Bottom row position (finest granularity)
        
        // Create X-axis group
        const xAxisGroup = this.axisGroup.append("g")
            .attr("class", "x-axis-multi-level");
        
        // Draw the main axis line at the chart bottom
        xAxisGroup.append("line")
            .attr("class", "x-axis-line")
            .attr("x1", 0)
            .attr("x2", width)
            .attr("y1", height)
            .attr("y2", height)
            .attr("stroke", lineColor)
            .attr("stroke-width", 1);
        
        // Sample data points for display (avoid overcrowding)
        const maxLabelsToShow = tickCount;
        const step = Math.max(1, Math.ceil(hierarchyData.length / maxLabelsToShow));
        const sampledData = hierarchyData.filter((_, i) => i % step === 0);
        
        // Draw finest level labels (bottom row) - these show for each tick
        const finestLevelGroup = xAxisGroup.append("g")
            .attr("class", "x-axis-level-finest");
        
        sampledData.forEach(item => {
            const finestLabel = item.levels[item.levels.length - 1]; // Last level is finest
            
            // Tick line
            finestLevelGroup.append("line")
                .attr("x1", item.x)
                .attr("x2", item.x)
                .attr("y1", height)
                .attr("y2", height + 6)
                .attr("stroke", tickColor);
            
            // Label text
            finestLevelGroup.append("text")
                .attr("x", item.x)
                .attr("y", height + rowHeight)
                .attr("text-anchor", "middle")
                .attr("fill", textColor)
                .attr("font-size", "10px")
                .attr("font-family", fontFamily)
                .text(finestLabel.length > 12 ? finestLabel.substring(0, 10) + ".." : finestLabel);
        });
        
        // Draw higher-level grouped labels (from level 0 to levelCount-2)
        // These are displayed as spans that group their child elements
        for (let levelIdx = 0; levelIdx < levelCount - 1; levelIdx++) {
            const levelRowY = height + rowHeight * (levelCount - levelIdx);
            
            // Group consecutive items with the same value at this level
            const groups = this.groupByLevel(hierarchyData, levelIdx);
            
            const levelGroup = xAxisGroup.append("g")
                .attr("class", `x-axis-level-${levelIdx}`);
            
            groups.forEach(group => {
                // Calculate group bounds
                const groupStartX = group.items[0].x;
                const groupEndX = group.items[group.items.length - 1].x;
                const groupCenterX = (groupStartX + groupEndX) / 2;
                const groupWidth = Math.max(groupEndX - groupStartX, 10);
                
                // Only draw if group has meaningful width
                if (groupWidth > 20 || group.items.length === 1) {
                    // Draw bracket/span line for grouped items
                    if (group.items.length > 1 && groupWidth > 30) {
                        // Left bracket
                        levelGroup.append("line")
                            .attr("x1", groupStartX)
                            .attr("x2", groupStartX)
                            .attr("y1", levelRowY - 4)
                            .attr("y2", levelRowY)
                            .attr("stroke", borderLight)
                            .attr("stroke-width", 1);
                        
                        // Horizontal span line
                        levelGroup.append("line")
                            .attr("x1", groupStartX)
                            .attr("x2", groupEndX)
                            .attr("y1", levelRowY - 4)
                            .attr("y2", levelRowY - 4)
                            .attr("stroke", borderLight)
                            .attr("stroke-width", 1);
                        
                        // Right bracket  
                        levelGroup.append("line")
                            .attr("x1", groupEndX)
                            .attr("x2", groupEndX)
                            .attr("y1", levelRowY - 4)
                            .attr("y2", levelRowY)
                            .attr("stroke", borderLight)
                            .attr("stroke-width", 1);
                    }
                    
                    // Group label - center it in the span
                    const labelText = group.value;
                    const maxLabelWidth = Math.min(groupWidth, 80);
                    const truncatedLabel = labelText.length > maxLabelWidth / 6 
                        ? labelText.substring(0, Math.floor(maxLabelWidth / 6) - 2) + ".."
                        : labelText;
                    
                    levelGroup.append("text")
                        .attr("x", groupCenterX)
                        .attr("y", levelRowY + 12)
                        .attr("text-anchor", "middle")
                        .attr("fill", textColor)
                        .attr("font-size", levelIdx === 0 ? "11px" : "10px")
                        .attr("font-weight", levelIdx === 0 ? "500" : "normal")
                        .attr("font-family", fontFamily)
                        .text(truncatedLabel);
                }
            });
        }
    }
    
    /**
     * Group hierarchy data by a specific level value
     * Returns array of { value: string, items: array } where items share the same value at levelIdx
     */
    groupByLevel(hierarchyData, levelIdx) {
        const groups = [];
        let currentGroup = null;
        
        hierarchyData.forEach(item => {
            const levelValue = item.levels[levelIdx] || "";
            
            if (!currentGroup || currentGroup.value !== levelValue) {
                // Start new group
                currentGroup = {
                    value: levelValue,
                    items: [item]
                };
                groups.push(currentGroup);
            } else {
                // Add to current group
                currentGroup.items.push(item);
            }
        });
        
        return groups;
    }

    drawLines(seriesData, xScale, yScales, height, options) {
        this.linesGroup.selectAll("*").remove();

        // Get line width from options (default 2.5)
        const lineWidth = options.lineWidth !== undefined ? options.lineWidth : 2.5;
        const self = this;

        // Handle yScales as object (multiple Y-axes) or single scale (backward compatibility)
        const yScalesObj = typeof yScales === 'object' && !yScales.domain ? yScales : { 0: yScales };

        // Determine if any series has marked data (for dimming effect)
        const hasAnyMarked = seriesData.some(s => s.hasMarkedData);

        seriesData.forEach((series, i) => {
            // Get the appropriate Y scale for this series
            const axisIdx = series.yAxisIndex || 0;
            const yScale = yScalesObj[axisIdx] || yScalesObj[Object.keys(yScalesObj)[0]];
            
            const line = d3.line()
                .x(d => xScale(d.date))
                .y(d => yScale(d.value))
                .curve(d3.curveMonotoneX);
            
            // Determine opacity based on marking state
            const lineOpacity = hasAnyMarked ? (series.hasMarkedData ? 1 : 0.25) : 1;
            
            // Add glow effect behind marked lines for emphasis
            if (series.hasMarkedData) {
                this.linesGroup.append("path")
                    .datum(series.data)
                    .attr("class", `line-glow line-glow-${i}`)
                    .attr("data-series", series.symbol)
                    .attr("fill", "none")
                    .attr("stroke", series.color)
                    .attr("stroke-width", lineWidth + 6)
                    .attr("stroke-linecap", "round")
                    .attr("stroke-linejoin", "round")
                    .attr("opacity", 0.25)
                    .attr("d", line)
                    .style("pointer-events", "none")
                    .style("filter", `blur(4px)`);
            }
            
            const path = this.linesGroup.append("path")
                .datum(series.data)
                .attr("class", `line line-${i}${series.hasMarkedData ? ' marked' : ''}`)
                .attr("data-series", series.symbol)
                .attr("data-axis", axisIdx)
                .attr("fill", "none")
                .attr("stroke", series.color)
                .attr("stroke-width", series.hasMarkedData ? lineWidth + 1 : lineWidth)
                .attr("stroke-linecap", "round")
                .attr("stroke-linejoin", "round")
                .attr("opacity", lineOpacity)
                .attr("d", line)
                .style("cursor", this.markingEnabled ? "pointer" : "default");
            
            // Add click handler for marking entire series
            if (this.markingEnabled) {
                path.on("click", function(event) {
                    event.stopPropagation();
                    self.markSeries(series, event);
                });
            }

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

    drawEndDots(seriesData, xScale, yScales, options = {}) {
        this.dotsGroup.selectAll("*").remove();

        // Determine if dots should be shown (explicit check)
        const showDots = options.showDots === true || options.showDots === undefined;
        
        if (!showDots) {
            return;
        }

        // Handle yScales as object (multiple Y-axes) or single scale (backward compatibility)
        const yScalesObj = typeof yScales === 'object' && !yScales.domain ? yScales : { 0: yScales };
        
        // Determine if any series has marked data (for dimming effect)
        const hasAnyMarked = seriesData.some(s => s.hasMarkedData);
        
        seriesData.forEach((series, i) => {
            const lastPoint = series.data[series.data.length - 1];
            
            // Get the appropriate Y scale for this series
            const axisIdx = series.yAxisIndex || 0;
            const yScale = yScalesObj[axisIdx] || yScalesObj[Object.keys(yScalesObj)[0]];
            
            // Determine opacity based on marking state
            const dotOpacity = hasAnyMarked ? (series.hasMarkedData ? 1 : 0.25) : 1;
            const self = this;
            const cx = xScale(lastPoint.date);
            const cy = yScale(lastPoint.value);
            
            // Enhanced glow effect for marked dots
            if (series.hasMarkedData) {
                // Extra outer glow for emphasis
                this.dotsGroup.append("circle")
                    .attr("class", `dot-glow-outer dot-glow-outer-${i}`)
                    .attr("data-series", series.symbol)
                    .attr("cx", cx)
                    .attr("cy", cy)
                    .attr("r", 16)
                    .attr("fill", series.color)
                    .attr("opacity", 0.15)
                    .style("filter", "blur(4px)")
                    .style("pointer-events", "none");
            }
            
            // Outer glow/pulse
            this.dotsGroup.append("circle")
                .attr("class", `dot-glow dot-glow-${i}${series.hasMarkedData ? ' marked' : ''}`)
                .attr("data-series", series.symbol)
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", series.hasMarkedData ? 12 : 8)
                .attr("fill", series.color)
                .attr("opacity", series.hasMarkedData ? dotOpacity * 0.4 : dotOpacity * 0.3);

            // End-point highlighter ring
            this.dotsGroup.append("circle")
                .attr("class", `end-dot-ring end-dot-ring-${i}${series.hasMarkedData ? ' marked' : ''}`)
                .attr("data-series", series.symbol)
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", series.hasMarkedData ? 11 : 9)
                .attr("fill", "none")
                .attr("stroke", series.color)
                .attr("stroke-width", series.hasMarkedData ? 2.5 : 2)
                .attr("opacity", series.hasMarkedData ? dotOpacity * 0.9 : dotOpacity * 0.7)
                .style("pointer-events", "none");

            // Inner dot with shadow for depth
            this.dotsGroup.append("circle")
                .attr("class", `dot end-dot dot-${i}${series.hasMarkedData ? ' marked' : ''}`)
                .attr("data-series", series.symbol)
                .attr("cx", cx)
                .attr("cy", cy)
                .attr("r", series.hasMarkedData ? 7 : 5)
                .attr("fill", series.color)
                .attr("stroke", "#fff")
                .attr("stroke-width", series.hasMarkedData ? 3 : 2)
                .attr("opacity", dotOpacity)
                .style("cursor", this.markingEnabled ? "pointer" : "default")
                .style("filter", series.hasMarkedData ? `drop-shadow(0 2px 4px ${series.color}80)` : "none")
                .on("click", function(event) {
                    if (self.markingEnabled) {
                        event.stopPropagation();
                        self.markDataPoint(lastPoint, event);
                    }
                });
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
        header.append("span").attr("class", "legend-header-name").text("Application");
        header.append("span").attr("class", "legend-header-value").text("Value");
        header.append("span").attr("class", "legend-header-change").text("Change");
        header.append("span").attr("class", "legend-header-percent").text("% Change");

        // Determine if any series has marked data (for dimming effect)
        const hasAnyMarked = seriesData.some(s => s.hasMarkedData);

        seriesData.forEach((series, i) => {
            // Apply dimming effect when some series are marked
            const isMarked = series.hasMarkedData;
            const dimClass = hasAnyMarked && !isMarked ? ' dimmed' : '';
            
            const item = this.legend
                .append("div")
                .attr("class", `legend-item${isMarked ? ' marked' : ''}${dimClass}`)
                .attr("data-series", series.symbol)
                .on("mouseenter", () => this.highlightSeries(series.symbol))
                .on("mouseleave", () => this.unhighlightSeries())
                .on("click", (event) => {
                    if (this.markingEnabled) {
                        this.markSeries(series, event);
                    }
                })
                .style("cursor", this.markingEnabled ? "pointer" : "default");
            
            // Show marking indicator if series has marked data
            if (isMarked) {
                item.classed("has-marking", true);
            }

            // Color indicator (vertical bar) with glow effect for marked items
            const colorBar = item.append("div")
                .attr("class", "legend-color-bar")
                .style("background-color", series.color);
            
            if (isMarked) {
                colorBar.style("box-shadow", `0 0 8px ${series.color}`);
            }

            // Name with optional marker icon
            const nameSpan = item.append("span")
                .attr("class", "legend-name")
                .text(series.symbol);
            
            if (isMarked) {
                nameSpan.append("span")
                    .style("margin-left", "4px")
                    .style("font-size", "10px")
                    .style("opacity", "0.7")
                    .text("●");
            }

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

    setupHoverInteractions(seriesData, xScale, yScales, width, height, dateToLabelMap = new Map()) {
        // Handle yScales as object (multiple Y-axes) or single scale (backward compatibility)
        const yScalesObj = typeof yScales === 'object' && !yScales.domain ? yScales : { 0: yScales };
        
        // Update hover overlay size
        this.hoverOverlay
            .attr("width", width)
            .attr("height", height);

        // Remove existing hover dots
        this.hoverGroup.selectAll(".hover-dot").remove();

        // Create hover dots for each series
        const self = this;
        seriesData.forEach((series, i) => {
            this.hoverGroup.append("circle")
                .attr("class", `hover-dot hover-dot-${i}`)
                .attr("data-series", series.symbol)
                .attr("data-axis", series.yAxisIndex || 0)
                .attr("r", 6)
                .attr("fill", series.color)
                .attr("stroke", "#fff")
                .attr("stroke-width", 2)
                .style("opacity", 0)
                .style("pointer-events", "none");
        });

        const bisect = d3.bisector(d => d.date).left;
        
        // Track the nearest data point for click marking
        let nearestDataPoint = null;
        let nearestSeries = null;
        let nearestDistancePx = Infinity;

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
                // Try to get the display label for this date from the nearest data point
                let dateLabel = d3.timeFormat("%B %d, %Y")(x0);
                
                // Reset nearest tracking
                nearestDataPoint = null;
                nearestSeries = null;
                let minDistance = Infinity;
                
                seriesData.forEach((series, i) => {
                    const idx = bisect(series.data, x0, 1);
                    const d0 = series.data[idx - 1];
                    const d1 = series.data[idx];
                    
                    if (!d0 && !d1) return;
                    
                    const d = !d1 ? d0 : !d0 ? d1 : (x0 - d0.date > d1.date - x0 ? d1 : d0);
                    
                    // Use the display label if available
                    if (d.displayLabel && i === 0) {
                        dateLabel = d.displayLabel;
                    }
                    
                    // Track nearest data point for click marking
                    const distance = Math.abs(x0 - d.date);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestDataPoint = d;
                        nearestSeries = series;
                        nearestDistancePx = Math.abs(xScale(d.date) - mx);
                    }
                });
                
                let tooltipContent = `<div class="tooltip-date">${dateLabel}</div>`;
                
                seriesData.forEach((series, i) => {
                    const idx = bisect(series.data, x0, 1);
                    const d0 = series.data[idx - 1];
                    const d1 = series.data[idx];
                    
                    if (!d0 && !d1) return;
                    
                    const d = !d1 ? d0 : !d0 ? d1 : (x0 - d0.date > d1.date - x0 ? d1 : d0);

                    // Get the appropriate Y scale for this series
                    const axisIdx = series.yAxisIndex || 0;
                    const yScale = yScalesObj[axisIdx] || yScalesObj[Object.keys(yScalesObj)[0]];

                    // Update dot position
                    this.hoverGroup.select(`.hover-dot-${i}`)
                        .attr("cx", xScale(d.date))
                        .attr("cy", yScale(d.value))
                        .style("opacity", 1);

                    // Show marking indicator in tooltip if data point is marked
                    const markedIndicator = d.isMarked ? ' ●' : '';
                    tooltipContent += `
                        <div class="tooltip-row${d.isMarked ? ' marked' : ''}">
                            <span class="tooltip-color" style="background-color: ${series.color}"></span>
                            <span class="tooltip-name">${series.symbol}${markedIndicator}</span>
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
                nearestDataPoint = null;
                nearestSeries = null;
                nearestDistancePx = Infinity;
            })
            .on("click.marking", (event) => {
                if (!this.markingEnabled) return;

                // If click is not near any point, clear marking
                const maxSnapPx = 12;
                if (!nearestDataPoint || nearestDistancePx > maxSnapPx) {
                    this.clearMarking();
                    return;
                }

                // Mark the nearest data point
                this.markDataPoint(nearestDataPoint, event);
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

    /**
     * Get the marking operation based on modifier keys
     * Following Spotfire patterns:
     * - Default: ToggleOrAdd (behaves like toggle if all/no rows marked, otherwise add)
     * - Ctrl/Cmd: Toggle
     * - Shift: Add
     */
    getMarkingOperation(event) {
        if (event && (event.ctrlKey || event.metaKey)) {
            return "Toggle";
        } else if (event && event.shiftKey) {
            return "Add";
        }
        // ToggleOrAdd is the default Spotfire behavior for control marking
        return "ToggleOrAdd";
    }
    
    /**
     * Mark rows in Spotfire
     * @param {Array} rows - Array of Spotfire row objects to mark
     * @param {Event} event - The triggering event (for modifier key detection)
     */
    markRows(rows, event) {
        if (!this.markingEnabled || !this.dataView || !rows || rows.length === 0) {
            console.log("[Marking] Cannot mark - enabled:", this.markingEnabled, "rows:", rows?.length);
            return;
        }
        
        const operation = this.getMarkingOperation(event);
        
        console.log("[Marking] Marking", rows.length, "rows with operation:", operation);
        
        try {
            this.dataView.mark(rows, operation);
        } catch (e) {
            console.warn("[Marking] Error marking rows:", e.message);
        }
    }
    
    /**
     * Mark all rows in a series
     * @param {Object} series - The series object containing allRows
     * @param {Event} event - The triggering event
     */
    markSeries(series, event) {
        if (!series || !series.allRows) {
            console.log("[Marking] No rows to mark for series");
            return;
        }
        this.markRows(series.allRows, event);
    }
    
    /**
     * Mark rows at a specific data point
     * @param {Object} dataPoint - The data point containing rows
     * @param {Event} event - The triggering event
     */
    markDataPoint(dataPoint, event) {
        if (!dataPoint) return;
        
        const rows = dataPoint.rows || (dataPoint.row ? [dataPoint.row] : []);
        this.markRows(rows, event);
    }
    
    /**
     * Check if an element or its parents have an ignored class
     * Used to prevent clearing marking when clicking on UI controls
     */
    shouldIgnoreClick(target) {
        let elem = target;
        while (elem) {
            if (elem.classList) {
                const classes = Array.from(elem.classList);
                if (classes.some(c => this.ignoredClickClasses.includes(c))) {
                    return true;
                }
            }
            elem = elem.parentNode;
        }
        return false;
    }
    
    /**
     * Clear all marking
     */
    clearMarking() {
        if (!this.markingEnabled || !this.dataView) return;
        
        try {
            this.dataView.clearMarking();
            console.log("[Marking] Cleared all marking");
        } catch (e) {
            console.warn("[Marking] Error clearing marking:", e.message);
        }
    }
    
    /**
     * Setup rectangular marking selection (Spotfire pattern)
     * Enables drag-to-select behavior on the chart
     */
    setupRectangularMarking(seriesData, xScale, yScales, chartWidth, chartHeight) {
        if (!this.markingEnabled) return;
        
        const self = this;
        const svg = this.svg;
        const yScalesObj = typeof yScales === 'object' && !yScales.domain ? yScales : { 0: yScales };
        
        // Helper to draw rectangle path
        const drawRectangle = (x, y, w, h) => {
            return `M${x},${y} l${w},0 l0,${h} l${-w},0 z`;
        };
        
        // Start selection
        const startSelection = (start) => {
            self.rectangleMarking.active = true;
            self.rectangleMarking.startPoint = start;
            self.markingRect
                .attr("d", drawRectangle(start[0], start[1], 0, 0))
                .attr("visibility", "visible");
        };
        
        // Update selection during drag
        const moveSelection = (start, current) => {
            const w = current[0] - start[0];
            const h = current[1] - start[1];
            self.markingRect.attr("d", drawRectangle(start[0], start[1], w, h));
        };
        
        // End selection and perform marking
        const endSelection = (start, end, event) => {
            self.markingRect.attr("visibility", "hidden");
            self.rectangleMarking.active = false;
            
            // Ignore small drags (treat as clicks)
            // Click handling (mark/clear) is managed by hoverOverlay click handler
            if (Math.abs(start[0] - end[0]) < 4 && Math.abs(start[1] - end[1]) < 4) {
                return;
            }
            
            // Get selection bounds
            const selectionBox = {
                x: Math.min(start[0], end[0]),
                y: Math.min(start[1], end[1]),
                width: Math.abs(end[0] - start[0]),
                height: Math.abs(end[1] - start[1])
            };
            
            // Find data points within the selection box, grouped by series
            const seriesMatches = [];
            
            seriesData.forEach(series => {
                const axisIdx = series.yAxisIndex || 0;
                const yScale = yScalesObj[axisIdx] || yScalesObj[Object.keys(yScalesObj)[0]];
                const rowsForSeries = [];
                let matchCount = 0;
                
                series.data.forEach(d => {
                    const px = xScale(d.date);
                    const py = yScale(d.value);
                    
                    // Check if point center is within selection box
                    if (px >= selectionBox.x && 
                        px <= selectionBox.x + selectionBox.width &&
                        py >= selectionBox.y && 
                        py <= selectionBox.y + selectionBox.height) {
                        matchCount += 1;
                        if (d.rows) {
                            rowsForSeries.push(...d.rows);
                        } else if (d.row) {
                            rowsForSeries.push(d.row);
                        }
                    }
                });
                
                if (matchCount > 0) {
                    seriesMatches.push({ series, rows: rowsForSeries, count: matchCount });
                }
            });
            
            if (seriesMatches.length === 0) {
                self.clearMarking();
                return;
            }

            // Prefer the series with the most points in the selection box
            seriesMatches.sort((a, b) => b.count - a.count);
            const bestMatch = seriesMatches[0];
            
            if (bestMatch.rows.length === 0) {
                self.clearMarking();
            } else {
                self.markRows(bestMatch.rows, event);
            }
        };
        
        // Attach mouse handlers to the hover overlay
        this.hoverOverlay
            .on("mousedown.marking", function(event) {
                // Ignore right-click
                if (event.button === 2) return;
                
                const coords = d3.pointer(event);
                startSelection(coords);
                
                // Attach move and up handlers to window
                d3.select(window)
                    .on("mousemove.marking", function(e) {
                        if (self.rectangleMarking.active) {
                            const current = d3.pointer(e, self.chartGroup.node());
                            moveSelection(self.rectangleMarking.startPoint, current);
                        }
                    })
                    .on("mouseup.marking", function(e) {
                        if (self.rectangleMarking.active) {
                            const end = d3.pointer(e, self.chartGroup.node());
                            endSelection(self.rectangleMarking.startPoint, end, e);
                        }
                        d3.select(window)
                            .on("mousemove.marking", null)
                            .on("mouseup.marking", null);
                    });
            });
            
        // Setup chart background click handler for clearing marking
        // Click on chart area (but not on data points) should clear marking
        this.chartGroup.on("click.clearmarking", function(event) {
            // Check if click is directly on the chart group or its background elements
            const target = event.target;
            const isOnLine = target.classList.contains('line') || target.closest('.line');
            const isOnDot = target.classList.contains('dot') || target.classList.contains('dot-glow') || target.closest('.dot');
            const isOnHoverOverlay = target.classList.contains('hover-overlay');
            
            // If click is on hover overlay but not on a line or dot, it's a background click
            if (isOnHoverOverlay && !isOnLine && !isOnDot) {
                // This is already handled by the rectangular marking mousedown
                // Only clear if it was a simple click (not a drag)
                return;
            }
        });
        
        // Double-click to reset zoom and clear marking
        this.svg.on("dblclick.reset", function(event) {
            // Reset zoom to default
            self.resetZoom();
            // Clear marking
            self.clearMarking();
        });

        // Clear marking when clicking outside the chart container
        if (!this.outsideClickBound) {
            this.outsideClickBound = true;
            document.addEventListener("click", (event) => {
                if (!this.markingEnabled) return;
                const containerNode = this.container && this.container.node ? this.container.node() : null;
                if (containerNode && !containerNode.contains(event.target)) {
                    this.clearMarking();
                }
            }, true);
        }
    }
}
