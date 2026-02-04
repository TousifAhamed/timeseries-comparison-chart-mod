/*
 * Copyright © 2020. TIBCO Software Inc.
 * This file is subject to the license terms contained
 * in the license file that is distributed with this file.
 */

//@ts-check
import "core-js/es/array";
import { MarketComparisonChart } from "./chart.js";
import { ConfigurationManager, defaultConfiguration } from "./config.js";

const Spotfire = window.Spotfire;
const DEBUG = true;

Spotfire.initialize(async (mod) => {
    const modMetaData = mod.metadata;
    console.log("Market Comparison Mod version:", modMetaData.version ? "v" + modMetaData.version : "unknown");

    const context = mod.getRenderContext();
    const containerElem = document.getElementById("chart-container");
    
    // Apply Spotfire styling context for theme support
    const applySpotfireTheme = () => {
        const styling = context.styling;
        const general = styling.general;
        const scales = styling.scales;
        
        // Apply background and text colors from Spotfire theme
        // Note: backgroundColor and font.color are strings, not objects
        document.body.style.backgroundColor = general.backgroundColor;
        document.body.style.color = general.font.color;
        document.body.style.fontFamily = general.font.fontFamily;
        document.body.style.fontSize = general.font.fontSize + "px";
        
        containerElem.style.backgroundColor = general.backgroundColor;
        containerElem.style.color = general.font.color;
        
        // Set CSS custom properties for theme colors so CSS and D3 can use them
        const root = document.documentElement;
        root.style.setProperty('--sf-bg-primary', general.backgroundColor);
        root.style.setProperty('--sf-text-primary', general.font.color);
        root.style.setProperty('--sf-font-family', general.font.fontFamily);
        root.style.setProperty('--sf-font-size', general.font.fontSize + 'px');
        
        // Scale styling for axes
        root.style.setProperty('--sf-scale-font-color', scales.font.color);
        root.style.setProperty('--sf-scale-font-family', scales.font.fontFamily);
        root.style.setProperty('--sf-scale-font-size', scales.font.fontSize + 'px');
        root.style.setProperty('--sf-scale-line-stroke', scales.line.stroke);
        root.style.setProperty('--sf-scale-tick-stroke', scales.tick.stroke);
        
        // Calculate derived colors based on theme (light/dark detection)
        const bgColor = general.backgroundColor;
        const textColor = general.font.color;
        const isDarkTheme = isColorDark(bgColor);
        
        if (isDarkTheme) {
            // Dark theme - lighter secondary colors
            root.style.setProperty('--sf-text-secondary', adjustColorBrightness(textColor, -20));
            root.style.setProperty('--sf-text-muted', adjustColorBrightness(textColor, -40));
            root.style.setProperty('--sf-bg-secondary', adjustColorBrightness(bgColor, 12));
            root.style.setProperty('--sf-bg-tertiary', adjustColorBrightness(bgColor, 20));
            root.style.setProperty('--sf-bg-hover', adjustColorBrightness(bgColor, 25));
            root.style.setProperty('--sf-border-light', adjustColorBrightness(bgColor, 25));
            root.style.setProperty('--sf-border-medium', adjustColorBrightness(bgColor, 35));
            root.style.setProperty('--sf-border-accent', 'rgba(99, 102, 241, 0.4)');
            // Dark theme shadows are more subtle
            root.style.setProperty('--sf-shadow-xs', '0 1px 2px rgba(0, 0, 0, 0.3)');
            root.style.setProperty('--sf-shadow-sm', '0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)');
            root.style.setProperty('--sf-shadow-md', '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.4)');
        } else {
            // Light theme - darker secondary colors  
            root.style.setProperty('--sf-text-secondary', adjustColorBrightness(textColor, 30));
            root.style.setProperty('--sf-text-muted', adjustColorBrightness(textColor, 50));
            root.style.setProperty('--sf-bg-secondary', adjustColorBrightness(bgColor, -4));
            root.style.setProperty('--sf-bg-tertiary', adjustColorBrightness(bgColor, -8));
            root.style.setProperty('--sf-bg-hover', adjustColorBrightness(bgColor, -6));
            root.style.setProperty('--sf-border-light', adjustColorBrightness(bgColor, -10));
            root.style.setProperty('--sf-border-medium', adjustColorBrightness(bgColor, -18));
            root.style.setProperty('--sf-border-accent', 'rgba(99, 102, 241, 0.3)');
            // Light theme shadows
            root.style.setProperty('--sf-shadow-xs', '0 1px 2px rgba(0, 0, 0, 0.04)');
            root.style.setProperty('--sf-shadow-sm', '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)');
            root.style.setProperty('--sf-shadow-md', '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -1px rgba(0, 0, 0, 0.04)');
        }
        
        // Add a class for theme type to help with CSS targeting
        document.body.classList.toggle('dark-theme', isDarkTheme);
        document.body.classList.toggle('light-theme', !isDarkTheme);
        
        return { general, scales, isDarkTheme };
    };
    
    // Helper: determine if color is dark
    const isColorDark = (color) => {
        // Handle various color formats
        let hex = color;
        if (color.startsWith('rgb')) {
            // Convert rgb/rgba to hex
            const match = color.match(/\d+/g);
            if (match && match.length >= 3) {
                const r = parseInt(match[0]);
                const g = parseInt(match[1]);
                const b = parseInt(match[2]);
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                return luminance < 0.5;
            }
        }
        hex = hex.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
    };
    
    // Helper: adjust color brightness
    const adjustColorBrightness = (color, percent) => {
        // Handle various color formats
        let r, g, b;
        if (color.startsWith('rgb')) {
            const match = color.match(/\d+/g);
            if (match && match.length >= 3) {
                r = parseInt(match[0]);
                g = parseInt(match[1]);
                b = parseInt(match[2]);
            }
        } else {
            const hex = color.replace('#', '');
            r = parseInt(hex.substr(0, 2), 16);
            g = parseInt(hex.substr(2, 2), 16);
            b = parseInt(hex.substr(4, 2), 16);
        }
        r = Math.min(255, Math.max(0, r + Math.round(255 * percent / 100)));
        g = Math.min(255, Math.max(0, g + Math.round(255 * percent / 100)));
        b = Math.min(255, Math.max(0, b + Math.round(255 * percent / 100)));
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };
    
    // Apply theme on load and get styling info
    let themeInfo = applySpotfireTheme();
    
    // Create the chart instance
    const chart = new MarketComparisonChart(mod);

    // Configuration management
    let currentConfig = { ...defaultConfiguration };
    
    const updateConfig = async (configObj) => {
        currentConfig = configObj;
        // Save to mod property
        try {
            mod.property("mod-config").set(JSON.stringify(configObj));
        } catch (e) {
            console.warn("[Config] Could not save config:", e);
        }
    };
    
    // Initialize configuration manager
    const configManager = new ConfigurationManager(
        containerElem,
        context.isEditing,
        updateConfig
    );
    
    // Load saved configuration
    try {
        const modConfigProp = await mod.property("mod-config");
        const savedConfig = modConfigProp.value();
        configManager.setConfigurationStr(savedConfig);
        currentConfig = configManager.getConfiguration();
    } catch (e) {
        console.log("[Config] Using default configuration");
    }

    // Helper function to safely get axis (returns null if axis doesn't exist)
    const safeAxis = (axisName) => {
        try {
            const axis = mod.visualization.axis(axisName);
            return axis;
        } catch (e) {
            console.log(`[Axis] Optional axis '${axisName}' not available`);
            return null;
        }
    };

    // Get optional axes - these may not exist in all configurations
    const marketTypeAxis = safeAxis("MarketType");
    const currentValueAxis = safeAxis("CurrentValue");
    const valueChangeAxis = safeAxis("ValueChange");

    // Build reader with required axes and optional axes if they exist
    const readerParams = [
        mod.visualization.axis("X"),
        mod.visualization.axis("Y"),
        mod.visualization.axis("Color"),
        mod.visualization.data(),
        mod.windowSize(),
        mod.property("timePeriod"),
        mod.property("selectedMarket"),
        mod.property("showGrid"),
        mod.property("animateLines"),
        mod.property("showLegend"),
        mod.property("mod-config")  // Include config to trigger re-render on config changes
    ];

    // Add optional axes to reader if they exist
    if (marketTypeAxis) readerParams.push(marketTypeAxis);
    if (currentValueAxis) readerParams.push(currentValueAxis);
    if (valueChangeAxis) readerParams.push(valueChangeAxis);

    const reader = mod.createReader(...readerParams);

    reader.subscribe(async (...args) => {
        // Parse arguments - required args first, then optional
        const [xAxis, yAxis, colorAxis, dataView, windowSize, timePeriod, selectedMarket, showGrid, animateLines, showLegend, modConfig, ...optionalAxes] = args;
        
        // Update currentConfig from mod-config property if it changed
        const configStr = modConfig.value();
        if (configStr && configStr.length > 0) {
            try {
                const parsedConfig = JSON.parse(configStr);
                currentConfig = { ...defaultConfiguration, ...parsedConfig };
            } catch (e) {
                console.warn("[Config] Could not parse mod-config:", e);
            }
        }
        
        // Map optional axes based on what was included in the reader
        let marketTypeAxisValue = null;
        let currentValueAxisValue = null;
        let valueChangeAxisValue = null;
        let optIdx = 0;
        
        if (marketTypeAxis && optIdx < optionalAxes.length) {
            marketTypeAxisValue = optionalAxes[optIdx++];
        }
        if (currentValueAxis && optIdx < optionalAxes.length) {
            currentValueAxisValue = optionalAxes[optIdx++];
        }
        if (valueChangeAxis && optIdx < optionalAxes.length) {
            valueChangeAxisValue = optionalAxes[optIdx++];
        }

        // Skip rendering if configuration panel is open
        if (configManager.active) {
            context.signalRenderComplete();
            return;
        }
        
        try {
            // Re-apply Spotfire theme on each render (theme may have changed)
            themeInfo = applySpotfireTheme();
            
            // Debug: Log current config state
            console.log("[Config] currentConfig:", JSON.stringify(currentConfig, null, 2));
            
            // Build options - Configuration panel values take priority over Spotfire properties
            // This allows users to customize via the gear icon config panel
            const yAxisTitles = (yAxis && Array.isArray(yAxis.parts) && yAxis.parts.length > 0)
                ? yAxis.parts.map((part) => part.displayName || part.expression || "Value")
                : ["Value"];

            const options = {
                timePeriod: timePeriod.value(),
                selectedMarket: selectedMarket.value(),
                // Use config panel values if they exist, otherwise fall back to Spotfire properties
                showGrid: currentConfig.chart?.showGrid !== undefined ? currentConfig.chart.showGrid : showGrid.value(),
                animateLines: currentConfig.chart?.animateLines !== undefined ? currentConfig.chart.animateLines : animateLines.value(),
                showLegend: currentConfig.display?.showLegend !== undefined ? currentConfig.display.showLegend : showLegend.value(),
                showHeader: currentConfig.display?.showHeader !== undefined ? currentConfig.display.showHeader : true,
                legendPosition: currentConfig.display?.legendPosition ?? "right",
                lineWidth: currentConfig.chart?.lineWidth ?? 2.5,
                showDots: currentConfig.chart?.showDots ?? true,
                curveType: currentConfig.chart?.curveType ?? "monotone",
                enableHover: currentConfig.interactions?.enableHover ?? true,
                enableMarking: currentConfig.interactions?.enableMarking ?? true,
                highlightOnLegendHover: currentConfig.interactions?.highlightOnLegendHover ?? true,
                rowLimit: currentConfig.display?.rowLimit ?? 5000,
                yAxisTitles: yAxisTitles,
                // Pass axis info for dynamic rendering
                hasMarketTypeAxis: marketTypeAxisValue ? marketTypeAxisValue.parts.length > 0 : false,
                hasCurrentValueAxis: currentValueAxisValue ? currentValueAxisValue.parts.length > 0 : false,
                hasValueChangeAxis: valueChangeAxisValue ? valueChangeAxisValue.parts.length > 0 : false
            };
            
            console.log("[Options] showLegend:", options.showLegend, "showHeader:", options.showHeader, "showGrid:", options.showGrid);
            
            await chart.render(dataView, windowSize, options);
            
            context.signalRenderComplete();
            mod.controls.errorOverlay.hide("catch");
        } catch (e) {
            mod.controls.errorOverlay.show(
                e.message || e || "☹️ Something went wrong, check developer console",
                "catch"
            );
            if (DEBUG) {
                throw e;
            }
        }
    });
});
