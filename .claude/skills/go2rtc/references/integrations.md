# go2rtc Integrations Reference

Complete reference for third-party service integrations.

## Home Assistant

go2rtc has multiple integration methods with Home Assistant.

### Method 1: Official Add-On (Recommended)

Install the go2rtc add-on from the official Home Assistant add-on store.

**Features:**
- Pre-configured with FFmpeg and Python
- Automatic updates
- Simple UI configuration

**Configuration:**
```yaml
options:
  log_level: info
  streams:
    front_door: rtsp://admin:password@192.168.1.100:554/stream
```

### Method 2: Hass Module

Import cameras directly from Home Assistant configuration.

```yaml
hass:
  config: "/config"  # Path to Home Assistant config
```

The `hass` module will:
- Discover cameras from Home Assistant entities
- Import RTSP URLs from camera integrations
- Support Generic Camera, ONVIF, HomeKit Camera, and Roborock

### Method 3: WebRTC Camera Component

Use the WebRTC Camera custom component with go2rtc backend.

**Installation:**
1. Install HACS (Home Assistant Community Store)
2. Install "WebRTC Camera" via HACS
3. Configure in `configuration.yaml`:

```yaml
webrtc:
  camera:
    front_door:
      url: http://go2rtc-host:1984/api/webrtc?src=camera1
```

### Method 4: RTSP to WebRTC Integration

Home Assistant has built-in RTSP-to-WebRTC support using go2rtc:

```yaml
camera:
  - platform: webrtc
    rtsp_to_webrtc_url: http://go2rtc-host:1984
    stream_name: camera1
```

## HomeKit

Export go2rtc streams to Apple HomeKit.

### Basic Configuration

```yaml
homekit:
  camera1:
    pin: "12345678"
    name: "Front Door Camera"
```

### Advanced Configuration

```yaml
homekit:
  front_door:
    pin: "123-45-678"          # 3-2-3 format also accepted
    name: "Front Door"
    device_id: "XX:XX:XX:XX:XX:XX"
    device_private: "base64encodedkey"
    category_id: "camera"      # or "doorbell" or "bridge"
    pairings:
      - "admin:password"

  back_yard:
    pin: "87654321"
    name: "Back Yard"
    category_id: 1             # Numeric category ID also works
```

### Pairing Process

1. Add accessory in Home app
2. Enter the PIN from config
3. Camera appears in HomeKit

### Features

- Live streaming to Apple Home app
- Two-way audio support
- Snapshot support
- Recording with HomeKit Secure Video
- Multiple profiles/streams

## ONVIF Integration

### ONVIF Discovery

```bash
curl http://localhost:1984/api/onvif
```

**Response:**
```json
[
  {
    "name": "Camera1",
    "ip": "192.168.1.100",
    "port": 80,
    "profiles": ["0", "1"],
    "rtsp": "rtsp://192.168.1.100:554/stream"
  }
]
```

### ONVIF Stream Configuration

```yaml
streams:
  # Auto-discovery
  camera1: onvif://admin:password@192.168.1.123

  # With specific profile
  camera2: onvif://admin:password@192.168.1.123?profile=0

  # With substream
  camera3: onvif://admin:password@192.168.1.123?subtype=1
```

### ONVIF Features

- Automatic RTSP URL retrieval
- Profile management
- Snapshot via ONVIF
- PTZ support (depends on camera)
- Two-way audio

## Publishing to Streaming Services

### YouTube Live

```yaml
publish:
  youtube: "rtmp://xxx.rtmp.youtube.com/live2/xxxx-xxxx-xxxx-xxxx"
```

**Trigger stream:**
```bash
curl -X POST "http://localhost:1984/api/streams?src=camera1&dst=publish/youtube"
```

**Requirements:**
- H.264 video codec
- AAC audio codec
- Stream key from YouTube Studio

### Telegram

```yaml
publish:
  telegram: "rtmps://xxx-x.rtmp.t.me/s/xxxxxxxxxx:xxxxxxxxxxxxxxxxxxxxxx"
```

**Requirements:**
- RTMPS URL from Telegram BotFather
- Stream key

### Custom RTMP Server

```yaml
publish:
  custom: "rtmp://custom-server:1935/app/stream_key"
  nginx: "rtmp://nginx-rtmp:1935/live/camera1"
```

### Publish Configuration

Ensure your stream is encoded properly:

```yaml
streams:
  camera1: rtsp://url#video=h264#audio=aac
```

## WebTorrent Sharing

Share streams via peer-to-peer WebTorrent.

### Create Share

```bash
curl -X POST "http://localhost:1984/api/webtorrent?src=camera1"
```

**Response:**
```json
{
  "magnet": "magnet:?xt=urn:btih:...",
  "infoHash": "abc123...",
  "seeders": 1
}
```

### List Shares

```bash
curl http://localhost:1984/api/webtorrent
```

### Delete Share

```bash
curl -X DELETE "http://localhost:1984/api/webtorrent?src=camera1"
```

### Features

- Peer-to-peer streaming without public ports
- Secure sharing with password protection
- Temporary or permanent shares
- Works through NAT

## Frigate NVR Integration

go2rtc works seamlessly with Frigate for object detection.

### Frigate Configuration

```yaml
cameras:
  front_door:
    ffmpeg:
      inputs:
        - path: rtsp://go2rtc:8554/front_door
          roles:
            - detect
            - rtmp
            - record
```

### go2rtc Configuration

```yaml
streams:
  front_door: rtsp://admin:password@camera-ip/stream
```

## Home Assistant Voice (Wyoming)

Use go2rtc as a Wyoming satellite for voice assistants.

### Configuration

```yaml
wyoming:
  satellite_mic:
    listen: ":10700"
    name: "Living Room Satellite"
    mode: "mic"
    vad_threshold: 1.2

  satellite_snd:
    listen: ":10701"
    name: "Living Room Speaker"
    mode: "snd"
```

### Features

- Voice activity detection
- Wake word handling
- Two-way audio
- Event-driven actions

## Reverse Proxy Integration

### Nginx

```nginx
location /rtc/ {
    proxy_pass http://localhost:1984/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_buffering off;
}
```

### Caddy

```caddy
rtc.example.com {
    reverse_proxy localhost:1984
}
```

### go2rtc Config for Proxy

```yaml
api:
  listen: "127.0.0.1:1984"     # Bind to localhost
  base_path: "/rtc"            # Match proxy path
```

## ngrok / Pinggy

For external access without public ports.

### ngrok

```bash
ngrok http 1984
```

### Pinggy

```bash
ssh -R 0:localhost:1984 qr@a.pinggy.io
```

### Alternative: Use WebRTC with STUN

```yaml
webrtc:
  candidates:
    - "stun:8555"
    - "stun:stun.l.google.com:19302"
```

## MQTT Integration

MQTT is used by some camera integrations (Tuya) for wake-up and two-way audio.

### Tuya MQTT

```yaml
streams:
  tuya_camera: tuya:device_id?key=value
```

MQTT is handled automatically by the Tuya module for:
- Camera wake-up
- Two-way audio streaming
- Status updates

## Third-Party Cameras

### Dahua / Hikvision

```yaml
streams:
  dahua: rtsp://admin:password@ip/cam/realmonitor?channel=1&subtype=0
  hik: rtsp://admin:password@ip/Streaming/Channels/101
```

### Amcrest

```yaml
streams:
  amcrest: rtsp://admin:password@ip/cam/realmonitor?channel=1
```

### Reolink

```yaml
streams:
  reolink: rtsp://admin:password@ip/h264Preview_01_main
```

### Uniview

```yaml
streams:
  uniview: rtsp://admin:password@ip/video1
```

## Recording Solutions

### Using HLS

```bash
curl "http://localhost:1984/api/stream.m3u8?src=camera1" -o playlist.m3u8
```

### Using MP4

```bash
curl "http://localhost:1984/api/stream.mp4?src=camera1&duration=60" -o recording.mp4
```

### Integration with Recording Software

- **Shinobi**: Use go2rtc RTSP URLs as camera sources
- **ZoneMinder**: Point to go2rtc RTSP server
- **Blue Iris**: Use go2rtc as camera source
- **Motion**: Access via go2rtc MJPEG stream
