/**
 * Market Comparison Chart - Configuration Module
 * 
 * Provides a configuration UI panel similar to official Spotfire mods.
 * Includes settings icon, form-based configuration, and property persistence.
 * 
 * @version 2.0.0
 */

//@ts-check

/* ============================================
   Default Configuration Values
   ============================================ */

export const defaultConfiguration = {
    display: {
        rowLimit: 5000,
        showHeader: true,
        showLegend: true,
        legendPosition: "right"
    },
    chart: {
        animateLines: true,
        lineWidth: 2.5,
        showGrid: true,
        showDots: true,
        curveType: "monotone"
    },
    interactions: {
        enableHover: true,
        enableMarking: true,
        highlightOnLegendHover: true
    },
    colors: {
        useDataColors: true,
        positiveColor: "#137333",
        negativeColor: "#c5221f"
    }
};

/* ============================================
   Configuration Template for Form UI
   ============================================ */

export const configurationTemplate = {
    label: "Chart Settings",
    display: {
        label: "Display",
        rowLimit: {
            label: "Row Limit",
            datatype: "int",
            minVal: 100,
            maxVal: 50000,
            tooltip: "Maximum number of data points to render"
        },
        showHeader: {
            label: "Show Header",
            datatype: "boolean",
            tooltip: "Display market tabs and time period selector"
        },
        showLegend: {
            label: "Show Legend",
            datatype: "boolean",
            tooltip: "Display the legend panel"
        },
        legendPosition: {
            label: "Legend Position",
            datatype: "string",
            enumeration: ["right", "bottom", "hidden"],
            tooltip: "Position of the legend panel"
        }
    },
    chart: {
        label: "Chart",
        animateLines: {
            label: "Animate Lines",
            datatype: "boolean",
            tooltip: "Enable line drawing animation on load"
        },
        lineWidth: {
            label: "Line Width",
            datatype: "float",
            minVal: 1,
            maxVal: 5,
            tooltip: "Thickness of chart lines in pixels"
        },
        showGrid: {
            label: "Show Grid Lines",
            datatype: "boolean",
            tooltip: "Display horizontal grid lines"
        },
        showDots: {
            label: "Show End Dots",
            datatype: "boolean",
            tooltip: "Display dots at end of each line"
        },
        curveType: {
            label: "Curve Type",
            datatype: "string",
            enumeration: ["monotone", "linear", "cardinal", "step"],
            tooltip: "Line interpolation method"
        }
    },
    interactions: {
        label: "Interactions",
        enableHover: {
            label: "Enable Hover",
            datatype: "boolean",
            tooltip: "Show crosshair and tooltip on hover"
        },
        enableMarking: {
            label: "Enable Marking",
            datatype: "boolean",
            tooltip: "Allow data marking on click"
        },
        highlightOnLegendHover: {
            label: "Highlight on Legend Hover",
            datatype: "boolean",
            tooltip: "Highlight series when hovering legend"
        }
    },
    colors: {
        label: "Colors",
        useDataColors: {
            label: "Use Data Colors",
            datatype: "boolean",
            tooltip: "Use colors from Spotfire data instead of defaults"
        },
        positiveColor: {
            label: "Positive Color",
            datatype: "color",
            tooltip: "Color for positive values"
        },
        negativeColor: {
            label: "Negative Color",
            datatype: "color",
            tooltip: "Color for negative values"
        }
    }
};

/* ============================================
   Configuration Manager Class
   ============================================ */

export class ConfigurationManager {
    /**
     * Creates a new ConfigurationManager
     * @param {HTMLElement} containerElem - The container element
     * @param {boolean} isEditing - Whether in editing mode
     * @param {Function} onChangeCallback - Callback when config changes
     */
    constructor(containerElem, isEditing, onChangeCallback) {
        this.containerElem = containerElem;
        this.isEditing = isEditing;
        this.onChangeCallback = onChangeCallback;
        this.configuration = JSON.parse(JSON.stringify(defaultConfiguration));
        this.active = false;
        
        // Create UI elements
        this.ui = new ConfigurationUI(this, containerElem, isEditing, onChangeCallback);
    }

    /**
     * Initialize from stored configuration string
     * @param {string|null} configStr - JSON configuration string
     */
    setConfigurationStr(configStr) {
        if (!configStr || configStr.length === 0) {
            // New mod - use default configuration
            this.configuration = JSON.parse(JSON.stringify(defaultConfiguration));
            this.onChangeCallback(this.configuration);
        } else {
            try {
                this.configuration = JSON.parse(configStr);
                // Merge with defaults to handle new properties
                this.configuration = this._mergeWithDefaults(this.configuration, defaultConfiguration);
            } catch (e) {
                console.warn("[ConfigurationManager] Invalid config, using defaults:", e);
                this.configuration = JSON.parse(JSON.stringify(defaultConfiguration));
            }
        }
        this.ui.setConfiguration(this.configuration);
    }

    /**
     * Get current configuration
     * @returns {Object} Current configuration object
     */
    getConfiguration() {
        return this.configuration;
    }

    /**
     * Deep merge configuration with defaults
     * @private
     */
    _mergeWithDefaults(config, defaults) {
        const result = { ...defaults };
        for (const key of Object.keys(config)) {
            if (config[key] !== null && typeof config[key] === 'object' && !Array.isArray(config[key])) {
                result[key] = this._mergeWithDefaults(config[key], defaults[key] || {});
            } else {
                result[key] = config[key];
            }
        }
        return result;
    }
}

/* ============================================
   Configuration UI Class
   ============================================ */

class ConfigurationUI {
    constructor(configManager, containerElem, isEditing, onChangeCallback) {
        this.configManager = configManager;
        this.containerElem = containerElem;
        this.isEditing = isEditing;
        this.onChangeCallback = onChangeCallback;
        this.configuration = null;
        
        this.vizElem = null;
        this.configElem = null;
        this.configIconElem = null;
        
        this._draw();
    }

    _draw() {
        if (!this.isEditing) return;
        this._drawIcon();
        this._drawConfigPanel();
    }

    _drawIcon() {
        const template = `
            <svg viewBox="0 0 24 24" width="20" height="20" class="config-gear">
                <path fill="currentColor" d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
            </svg>
        `;

        const iconElem = document.createElement('div');
        iconElem.classList.add('configuration-icon');
        iconElem.innerHTML = template.trim();
        iconElem.title = "Chart Settings";
        
        this.containerElem.appendChild(iconElem);
        this.configIconElem = iconElem;

        iconElem.addEventListener('click', (e) => {
            e.stopPropagation();
            this._viewConfiguration();
        });
    }

    _drawConfigPanel() {
        const template = `
            <div class="config-header">
                <h3>Chart Configuration</h3>
                <button class="config-close-btn" title="Close">×</button>
            </div>
            <div class="config-body">
                <div class="config-form"></div>
            </div>
            <div class="config-footer">
                <button class="config-btn config-reset">Reset to Defaults</button>
                <button class="config-btn config-save primary">Save & Close</button>
            </div>
        `;

        const configElem = document.createElement('div');
        configElem.classList.add('configuration-panel');
        configElem.innerHTML = template.trim();
        configElem.style.display = 'none';
        
        this.containerElem.appendChild(configElem);
        this.configElem = configElem;

        // Event listeners
        const closeBtn = configElem.querySelector('.config-close-btn');
        closeBtn.addEventListener('click', () => this._hideConfiguration());

        const resetBtn = configElem.querySelector('.config-reset');
        resetBtn.addEventListener('click', () => {
            this.configuration = JSON.parse(JSON.stringify(defaultConfiguration));
            this._renderForm();
        });

        const saveBtn = configElem.querySelector('.config-save');
        saveBtn.addEventListener('click', () => {
            this.configManager.configuration = this.configuration;
            this._hideConfiguration();
            this.onChangeCallback(this.configuration);
        });
    }

    _viewConfiguration() {
        this._renderForm();
        this.configElem.style.display = 'flex';
        this.configIconElem.style.display = 'none';
        this.configManager.active = true;
    }

    _hideConfiguration() {
        this.configElem.style.display = 'none';
        this.configIconElem.style.display = 'flex';
        this.configManager.active = false;
    }

    setConfiguration(config) {
        this.configuration = JSON.parse(JSON.stringify(config));
    }

    _renderForm() {
        const formElem = this.configElem.querySelector('.config-form');
        formElem.innerHTML = '';
        this._appendFormSections(formElem, this.configuration, configurationTemplate);
    }

    _appendFormSections(parentElem, configObj, template) {
        for (const key of Object.keys(template)) {
            if (key === 'label') continue;

            const templateItem = template[key];
            
            if (templateItem.datatype) {
                // This is a field
                this._appendFormField(parentElem, configObj, key, templateItem);
            } else if (typeof templateItem === 'object' && templateItem.label) {
                // This is a section
                const sectionElem = document.createElement('div');
                sectionElem.classList.add('config-section');
                
                const sectionHeader = document.createElement('h4');
                sectionHeader.textContent = templateItem.label;
                sectionElem.appendChild(sectionHeader);

                const sectionContent = document.createElement('div');
                sectionContent.classList.add('config-section-content');
                sectionElem.appendChild(sectionContent);

                this._appendFormSections(sectionContent, configObj[key] || {}, templateItem);
                parentElem.appendChild(sectionElem);
            }
        }
    }

    _appendFormField(parentElem, configObj, key, template) {
        const fieldElem = document.createElement('div');
        fieldElem.classList.add('config-field');

        const labelElem = document.createElement('label');
        labelElem.textContent = template.label;
        if (template.tooltip) {
            labelElem.title = template.tooltip;
        }
        fieldElem.appendChild(labelElem);

        const inputContainer = document.createElement('div');
        inputContainer.classList.add('config-input');

        const currentValue = configObj[key];

        switch (template.datatype) {
            case 'boolean':
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = currentValue;
                checkbox.addEventListener('change', () => {
                    configObj[key] = checkbox.checked;
                });
                inputContainer.appendChild(checkbox);
                break;

            case 'int':
            case 'float':
                const numberInput = document.createElement('input');
                numberInput.type = 'number';
                numberInput.value = currentValue;
                if (template.minVal !== undefined) numberInput.min = template.minVal;
                if (template.maxVal !== undefined) numberInput.max = template.maxVal;
                numberInput.step = template.datatype === 'float' ? '0.1' : '1';
                numberInput.addEventListener('change', () => {
                    const val = template.datatype === 'float' 
                        ? parseFloat(numberInput.value) 
                        : parseInt(numberInput.value);
                    configObj[key] = val;
                });
                inputContainer.appendChild(numberInput);
                break;

            case 'string':
                if (template.enumeration) {
                    const select = document.createElement('select');
                    template.enumeration.forEach(opt => {
                        const option = document.createElement('option');
                        option.value = opt;
                        option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
                        option.selected = currentValue === opt;
                        select.appendChild(option);
                    });
                    select.addEventListener('change', () => {
                        configObj[key] = select.value;
                    });
                    inputContainer.appendChild(select);
                } else {
                    const textInput = document.createElement('input');
                    textInput.type = 'text';
                    textInput.value = currentValue || '';
                    textInput.addEventListener('change', () => {
                        configObj[key] = textInput.value;
                    });
                    inputContainer.appendChild(textInput);
                }
                break;

            case 'color':
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.value = currentValue || '#000000';
                colorInput.addEventListener('change', () => {
                    configObj[key] = colorInput.value;
                });
                inputContainer.appendChild(colorInput);
                break;
        }

        fieldElem.appendChild(inputContainer);
        parentElem.appendChild(fieldElem);
    }
}
