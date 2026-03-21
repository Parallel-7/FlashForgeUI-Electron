# Perfect README Example: Home Assistant Integration

This is a reference implementation of the ideal README format following all skill guidelines.

## Source

Repository: https://github.com/GhostTypes/ff-5mp-hass

## Full README

```markdown
<div align="center">
  <h1>FlashForge 3D Printer Integration for Home Assistant</h1>
  <p>A modern Home Assistant custom integration for FlashForge 3D printers using the HTTP API for reliable, real-time monitoring and control.</p>
</div>

<p align="center">
  <a href="https://github.com/hacs/integration">
    <img src="https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge">
  </a>
  <a href="https://github.com/GhostTypes/ff-5mp-hass/releases">
    <img src="https://img.shields.io/github/release/GhostTypes/ff-5mp-hass.svg?style=for-the-badge">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/GhostTypes/ff-5mp-hass.svg?style=for-the-badge">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/HA%20Min-2025.1.0-blue.svg?style=for-the-badge&logo=homeassistant&logoColor=white">
  <img src="https://img.shields.io/badge/HA%20Tested-2025.12.4-brightgreen.svg?style=for-the-badge&logo=homeassistant&logoColor=white">
  <img src="https://img.shields.io/badge/Python-3.11+-blue.svg?style=for-the-badge&logo=python&logoColor=white">
  <img src="https://img.shields.io/github/downloads/GhostTypes/ff-5mp-hass/total?style=for-the-badge">
</p>



<div align="center">
  <h2>Features</h2>
</div>

<div align="center">
<table>
  <tr>
    <th>Category</th>
    <th>Feature</th>
    <th>Details</th>
  </tr>
  <tr>
    <td rowspan="3"><b>Monitoring</b></td>
    <td>18 Sensors</td>
    <td>Real-time temperature monitoring, print progress, filament tracking, lifetime statistics</td>
  </tr>
  <tr>
    <td>4 Binary Sensors</td>
    <td>Printing status, connectivity, error detection, pause state</td>
  </tr>
  <tr>
    <td>Live Camera Feed</td>
    <td>MJPEG stream from printer camera (model-dependent)</td>
  </tr>
  <tr>
    <td rowspan="3"><b>Control</b></td>
    <td>Switches</td>
    <td>LED control</td>
  </tr>
  <tr>
    <td>Select Entities</td>
    <td>Filtration mode control (Off/Internal/External)</td>
  </tr>
  <tr>
    <td>Buttons</td>
    <td>Pause, resume, cancel print jobs, and clear status directly from Home Assistant</td>
  </tr>
  <tr>
    <td rowspan="4"><b>Architecture</b></td>
    <td>HTTP-First Design</td>
    <td>Superior reliability compared to TCP-only implementations</td>
  </tr>
  <tr>
    <td>Async/Await</td>
    <td>Fully asynchronous for optimal Home Assistant integration</td>
  </tr>
  <tr>
    <td>Auto-Discovery</td>
    <td>UDP-based network discovery with manual fallback</td>
  </tr>
  <tr>
    <td>Configurable Polling</td>
    <td>Adjust update frequency from 5-300 seconds</td>
  </tr>
</table>
</div>



<div align="center">
  <h2>Supported Hardware</h2>
</div>

<div align="center">
<table>
  <tr>
    <th>Printer Model</th>
    <th>Support Status</th>
  </tr>
  <tr>
    <td>FlashForge Adventurer 5M Series</td>
    <td>Fully Supported </td>
  </tr>
  <tr>
    <td>FlashForge Adventurer 4</td>
    <td>Fully Supported</td>
  </tr>
  <tr>
    <td>Other</td>
    <td>Not Supported (Not planned)</td>
  </tr>
</table>
</div>

<div align="center">
<p><i>Model-specific features (LED, filtration, camera) are automatically detected and enabled when available.</i></p>
</div>



<div align="center">
  <h2>Requirements</h2>
</div>

<div align="center">

| Requirement | Details |
|-------------|---------|
| **Home Assistant** | 2025.1.0 or newer |
| **Python Library** | [flashforge-python-api](https://pypi.org/project/flashforge-python-api/) 1.0.2+ |
| **Network** | Local LAN connectivity to printer |
| **Printer Setup** | LAN mode enabled with check code |

</div>


<div align="center">
  <h2>Installation</h2>
</div>

<div align="center">

| Method | Steps |
|--------|-------|
| **Via HACS (Recommended)** | 1. Open **HACS** in Home Assistant<br>2. Click on **Integrations**<br>3. Click the **⋮** menu (top right) → **Custom repositories**<br>4. Add repository:<br>&nbsp;&nbsp;&nbsp;• **URL**: `https://github.com/GhostTypes/ff-5mp-hass`<br>&nbsp;&nbsp;&nbsp;• **Category**: `Integration`<br>5. Click **Add**<br>6. Search for "FlashForge" in HACS<br>7. Click **Download**<br>8. **Restart Home Assistant** |
| **Manual Installation** | 1. Download the [latest release](https://github.com/GhostTypes/ff-5mp-hass/releases)<br>2. Extract the `custom_components/flashforge` folder<br>3. Copy to your Home Assistant `config/custom_components/` directory<br>4. Restart Home Assistant |

</div>


<div align="center">
  <h2>Configuration</h2>
</div>

<div align="center">

| Step | Instructions |
|------|--------------|
| **Prerequisites: Enable LAN Mode** | Before adding the integration, you must enable LAN mode on your FlashForge printer:<br><br>1. On the printer touchscreen, go to **Settings** → **Network** → **LAN Mode**<br>2. Enable LAN mode<br>3. Note the **Check Code** (8-digit code) - you'll need this for setup<br><br>[Video Tutorial](https://www.youtube.com/watch?v=krdEGccZuKo) |
| **Option 1: Automatic Discovery (Recommended)** | 1. Go to **Settings** → **Devices & Services** → **Integrations**<br>2. Click **+ Add Integration**<br>3. Search for **"FlashForge"**<br>4. Select your printer from the discovered list<br>5. Enter your printer's **Check Code**<br>6. Click **Submit** |
| **Option 2: Manual Configuration** | 1. Go to **Settings** → **Devices & Services** → **Integrations**<br>2. Click **+ Add Integration**<br>3. Search for **"FlashForge"**<br>4. Select **"Configure Manually"**<br>5. Enter:<br>&nbsp;&nbsp;&nbsp;• **IP Address**: Your printer's IP (e.g., `192.168.1.100`)<br>&nbsp;&nbsp;&nbsp;• **Printer Name**: Friendly name (optional)<br>&nbsp;&nbsp;&nbsp;• **Serial Number**: From printer settings<br>&nbsp;&nbsp;&nbsp;• **Check Code**: From LAN mode settings<br>6. Click **Submit** |
| **Configuration Options** | After setup, you can adjust settings:<br><br>1. Go to **Settings** → **Devices & Services** → **FlashForge**<br>2. Click **⋮** on your printer → **Configure**<br>3. **Scan Interval**: Update frequency in seconds (5-300, default: 10) |

</div>



<div align="center">
  <h2>Available Entities</h2>
</div>

<div align="center">

### Sensors

</div>

<div align="center">

| Entity | Description | Unit |
|--------|-------------|------|
| `sensor.flashforge_machine_status` | Current printer state (idle, printing, paused, error) | - |
| `sensor.flashforge_nozzle_temperature` | Current extruder temperature | °C |
| `sensor.flashforge_nozzle_target_temperature` | Target extruder temperature | °C |
| `sensor.flashforge_bed_temperature` | Current bed temperature | °C |
| `sensor.flashforge_bed_target_temperature` | Target bed temperature | °C |
| `sensor.flashforge_print_progress` | Print completion percentage | % |
| `sensor.flashforge_current_file` | Currently printing file name | - |
| `sensor.flashforge_current_layer` | Current layer number | - |
| `sensor.flashforge_total_layers` | Total layer count | - |
| `sensor.flashforge_elapsed_time` | Time spent printing | seconds |
| `sensor.flashforge_remaining_time` | Estimated time remaining | seconds |
| `sensor.flashforge_filament_length` | Estimated filament length needed | meters |
| `sensor.flashforge_filament_weight` | Estimated filament weight | grams |
| `sensor.flashforge_print_speed` | Speed adjustment percentage | % |
| `sensor.flashforge_z_offset` | Z-axis compensation | mm |
| `sensor.flashforge_nozzle_size` | Installed nozzle size | - |
| `sensor.flashforge_filament_type` | Current filament type | - |
| `sensor.flashforge_lifetime_filament` | Total filament used over printer lifetime | meters |
| `sensor.flashforge_lifetime_runtime` | Total runtime over printer lifetime | - |

</div>

<div align="center">

### Binary Sensors

</div>

<div align="center">

| Entity | Description | Device Class |
|--------|-------------|--------------|
| `binary_sensor.flashforge_printing` | On when actively printing | `running` |
| `binary_sensor.flashforge_online` | On when printer is connected | `connectivity` |
| `binary_sensor.flashforge_error` | On when error detected | `problem` |
| `binary_sensor.flashforge_paused` | On when print is paused | - |

</div>

<div align="center">

### Switches

</div>

<div align="center">

| Entity | Description | Availability |
|--------|-------------|--------------|
| `switch.flashforge_led` | Control printer LED lights | All Models |

</div>

<div align="center">

### Select Entities

</div>

<div align="center">

| Entity | Description | Options | Availability |
|--------|-------------|---------|--------------|
| `select.flashforge_filtration_mode` | Control filtration system | Off, Internal, External | Model-dependent |

</div>

<div align="center">

### Buttons

</div>

<div align="center">

| Entity | Description |
|--------|-------------|
| `button.flashforge_pause_print` | Pause active print job |
| `button.flashforge_resume_print` | Resume paused print job |
| `button.flashforge_cancel_print` | Cancel and abort print job |
| `button.flashforge_clear_status` | Clear printer status/errors |

</div>

<div align="center">

### Camera

</div>

<div align="center">

| Entity | Description |
|--------|-------------|
| `camera.flashforge_camera` | Live MJPEG stream from printer camera |

</div>



<div align="center">
  <h2>Usage Examples</h2>
</div>

<div align="center">

### Automation: Notify When Print Completes

</div>

```yaml
automation:
  - alias: "3D Print Complete Notification"
    trigger:
      - platform: state
        entity_id: binary_sensor.flashforge_printing
        from: "on"
        to: "off"
    action:
      - service: notify.mobile_app
        data:
          title: "Print Complete"
          message: "{{ states('sensor.flashforge_current_file') }} finished printing!"
```

<div align="center">

### Automation: Alert on Print Error

</div>

```yaml
automation:
  - alias: "3D Printer Error Alert"
    trigger:
      - platform: state
        entity_id: binary_sensor.flashforge_error
        to: "on"
    action:
      - service: notify.mobile_app
        data:
          title: "Printer Error"
          message: "FlashForge printer has encountered an error!"
          data:
            priority: high
```

<div align="center">

### Automation: Turn Off LED When Print Finishes

</div>

```yaml
automation:
  - alias: "Turn Off Printer LED After Print"
    trigger:
      - platform: state
        entity_id: binary_sensor.flashforge_printing
        from: "on"
        to: "off"
    action:
      - service: switch.turn_off
        target:
          entity_id: switch.flashforge_led
```

<div align="center">

### Lovelace Card Example

</div>

```yaml
type: entities
title: FlashForge Printer
entities:
  - entity: sensor.flashforge_machine_status
  - entity: binary_sensor.flashforge_printing
  - entity: sensor.flashforge_print_progress
  - entity: sensor.flashforge_nozzle_temperature
  - entity: sensor.flashforge_bed_temperature
  - entity: sensor.flashforge_remaining_time
  - type: divider
  - entity: button.flashforge_pause_print
  - entity: button.flashforge_resume_print
  - entity: button.flashforge_cancel_print
  - entity: button.flashforge_clear_status
  - type: divider
  - entity: switch.flashforge_led
  - entity: switch.flashforge_camera
  - entity: select.flashforge_filtration_mode
```

<div align="center">

### Camera Card

</div>

```yaml
type: picture-glance
camera_image: camera.flashforge_camera
entities:
  - binary_sensor.flashforge_printing
  - sensor.flashforge_print_progress
```



<div align="center">
  <h2>Troubleshooting</h2>
</div>

<div align="center">

| Issue | Problem | Solutions |
|-------|---------|-----------|
| **Discovery Not Finding Printer** | Automatic discovery doesn't detect your printer | • Ensure printer is on the same network/subnet as Home Assistant<br>• Check firewall settings (UDP port 18007 must be open)<br>• Verify LAN mode is enabled on the printer<br>• Try manual configuration with IP address |
| **Connection Failed During Setup** | Setup fails with connection error | • Verify printer has LAN mode enabled<br>• Check the check code is correct (codes can expire)<br>• Ensure printer is powered on and connected to network<br>• Test API access manually: `http://<PRINTER_IP>:8898/info`<br>• Verify serial number matches printer label |
| **Entities Show "Unavailable"** | Integration installed but entities are unavailable | • Check printer is online and reachable<br>• Verify credentials are still valid<br>• Reload the integration: Settings → Integrations → FlashForge → ⋮ → Reload<br>• Check Home Assistant logs for connection errors |
| **Python API Not Installing** | Integration fails due to missing flashforge-python-api | • Verify Home Assistant has internet access<br>• Check PyPI is reachable: https://pypi.org/project/flashforge-python-api/<br>• Try manual install: `pip install flashforge-python-api` in HA environment<br>• Restart Home Assistant after installation |
| **Static IP Recommended** | - | For best reliability, assign a static IP address to your printer in your router's DHCP settings. This prevents connection issues if the printer's IP changes. |

</div>



<div align="center">
  <h2>Related Projects</h2>
</div>

<div align="center">
<table>
  <tr>
    <th>Project</th>
    <th>Description</th>
    <th>Link</th>
  </tr>
  <tr>
    <td>Python API Library</td>
    <td>Core HTTP API client for FlashForge printers</td>
    <td><a href="https://github.com/GhostTypes/ff-5mp-api-py">ff-5mp-api-py</a></td>
  </tr>
  <tr>
    <td>TypeScript API Library</td>
    <td>TypeScript/JavaScript API client</td>
    <td><a href="https://github.com/GhostTypes/ff-5mp-api-ts">ff-5mp-api-ts</a></td>
  </tr>
  <tr>
    <td>FlashForgeUI</td>
    <td>Cross-platform monitoring & control application</td>
    <td><a href="https://github.com/Parallel-7/FlashForgeUI-Electron">FlashForgeUI-Electron</a></td>
  </tr>
</table>
</div>



<div align="center">
  <h2>License</h2>
</div>

<div align="center">
<p>This project is licensed under the MIT License - see the <a href="LICENSE">LICENSE</a> file for details.</p>
</div>



<div align="center">
  <p><b>If you find this integration useful, please star the repository!</b></p>
</div>
```

## Key Patterns to Note

### Multi-Column Tables with rowspan

```markdown
<tr>
  <td rowspan="3"><b>Monitoring</b></td>
  <td>18 Sensors</td>
  <td>Real-time temperature monitoring...</td>
</tr>
<tr>
  <td>4 Binary Sensors</td>
  <td>Printing status, connectivity...</td>
</tr>
```

This creates a clean category-based layout.

### Section Headers as Centered H2

```markdown
<div align="center">
  <h2>Features</h2>
</div>
```

Clean, consistent section breaks without horizontal rules.

### Tables with Varied Column Counts

- 2-column tables for simple key-value pairs
- 3-column tables for categorized information
- 4-column tables for detailed specification matrices

### Code Blocks Outside Center Tags

```markdown
</div>

```yaml
# Code here
```

<div align="center">
```

Never wrap standalone code blocks in center tags.

### Complex Table Cells with Formatting

```markdown
| **Via HACS** | 1. Open **HACS**<br>2. Click **Integrations**<br>3. Add:<br>&nbsp;&nbsp;&nbsp;• **URL**: `repo`<br>&nbsp;&nbsp;&nbsp;• **Category**: `Integration` |
```

Rich formatting with line breaks, bullets, bold, and code formatting.

### Subsections Within Centered Divs

```markdown
<div align="center">

### Sensors

</div>

<div align="center">

| Entity | Description |
```

H3 subsection headers centered but kept simple.
