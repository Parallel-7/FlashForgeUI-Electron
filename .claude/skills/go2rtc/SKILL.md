---
name: go2rtc
description: Camera streaming application that supports 30+ streaming protocols and camera brands. Use when working with go2rtc for setting up camera streaming from RTSP/RTMP/HTTP/ONVIF/WebRTC sources; configuring go2rtc.yaml; using the REST API for stream management; integrating with Home Assistant, HomeKit, or publishing to YouTube/Telegram; implementing two-way audio, WebRTC streaming, or transcoding; debugging connection issues or stream problems
---

# go2rtc

## Overview

go2rtc is a universal camera streaming application written in Go that provides a unified interface for streaming from various camera sources and broadcasting to multiple protocols. It supports 30+ input sources (RTSP, RTMP, HTTP, ONVIF, WebRTC, HomeKit, Tapo, Ring, Tuya, Xiaomi, Wyze, etc.) and can output to WebRTC, RTSP, RTMP, HLS, MSE, MP4, and more.

**Key features:** Ultra-low latency, two-way audio support, on-the-fly transcoding, Home Assistant/HomeKit integration, and zero-dependency single-binary deployment.

## Quick Start

### Installation

```bash
# Docker (recommended)
docker run -d --restart=unless-stopped \
  -p 1984:1984 -p 8554:8554 -p 8555:8555/udp \
  -v go2rtc:/config \
  alexxit/go2rtc:latest

# Binary download
# Download from https://github.com/AlexxIT/go2rtc/releases
# Run: ./go2rtc
```

### Basic Configuration

Create `go2rtc.yaml`:

```yaml
streams:
  camera1: rtsp://admin:password@192.168.1.100:554/stream

api:
  listen: ":1984"
```

Access WebUI at `http://localhost:1984`

### Stream URLs

Once configured, streams are available at:
- **WebRTC**: `http://localhost:1984/api/webrtc?src=camera1`
- **RTSP**: `rtsp://localhost:8554/camera1`
- **HLS**: `http://localhost:1984/api/stream.m3u8?src=camera1`
- **MJPEG**: `http://localhost:1984/api/stream.mjpeg?src=camera1`

## Stream Source Formats

### RTSP Cameras

```yaml
streams:
  camera1: rtsp://admin:password@192.168.1.100:554/stream
  # With backchannel for two-way audio
  camera2: rtsp://admin:password@192.168.1.100:554/stream#backchannel=1
```

### ONVIF Discovery

```yaml
streams:
  camera1: onvif://admin:password@192.168.1.123
```

### HTTP Sources

```yaml
streams:
  flv: http://server:port/flv
  mjpeg: http://server:port/mjpeg
  jpeg: http://server:port/snapshot.jpg
```

### FFmpeg Sources

```yaml
streams:
  # File input
  file: ffmpeg:media.mp4

  # With transcoding
  camera: ffmpeg:rtsp://url#video=h264#audio=opus

  # USB camera
  usb: ffmpeg:/dev/video0#hardware
```

### Brand-Specific Cameras

```yaml
streams:
  tapo: tapo:password@192.168.1.100
  tuya: tuya:device_id?key=value
  ring: ring:?device_id=xxx&refresh_token=xxx
  xiaomi: xiaomi:ip?password=xxx
  wyze: wyze:ip?username=xxx&password=xxx
```

## Core Configuration

### API Settings

```yaml
api:
  listen: ":1984"              # WebUI and API port
  username: "admin"            # Basic auth
  password: "password"
  local_auth: false            # Require auth for localhost
  base_path: "/rtc"            # Subfolder for reverse proxy
```

### RTSP Server

```yaml
rtsp:
  listen: ":8554"              # RTSP server port
  username: "admin"
  password: "password"
```

### WebRTC

```yaml
webrtc:
  listen: ":8555"              # WebRTC port (TCP+UDP)
  candidates:
    - "stun:stun.l.google.com:19302"
    - "stun:8555"              # Auto-detect public IP
```

### FFmpeg

```yaml
ffmpeg:
  bin: "ffmpeg"
  global: "-hide_banner"
  h264: "-codec:v libx264 -preset:v superfast"
```

## REST API Basics

### Stream Management

```bash
# List all streams
curl http://localhost:1984/api/streams

# Add stream dynamically
curl -X PUT "http://localhost:1984/api/streams?src=rtsp://url&name=camera1"

# Delete stream
curl -X DELETE "http://localhost:1984/api/streams?src=camera1"
```

### Stream Consumption

```bash
# WebRTC (WHEP)
curl -X POST "http://localhost:1984/api/webrtc?src=camera1"

# HLS
curl "http://localhost:1984/api/stream.m3u8?src=camera1"

# Snapshot
curl "http://localhost:1984/api/frame.jpeg?src=camera1"
```

## Two-Way Audio

Two-way audio works with: RTSP (ONVIF Profile T), Tapo, Ring, Tuya, Xiaomi, Wyze, Roborock, Doorbird, and browser.

Enable backchannel on the source:

```yaml
streams:
  camera: rtsp://admin:pass@ip/stream#backchannel=1
  tapo: tapo:password@ip
```

Use the WebRTC player (`/webrtc.html`) for audio support.

## Home Assistant Integration

```yaml
hass:
  config: "/config"            # Home Assistant config path
```

Or use the official go2rtc add-on for Home Assistant.

## HomeKit Export

```yaml
homekit:
  camera1:
    pin: "12345678"
    name: "Front Door Camera"
```

Camera will appear in Apple Home app.

## Publishing to Services

```yaml
publish:
  youtube: "rtmp://xxx.rtmp.youtube.com/live2/xxxx-xxxx"
  telegram: "rtmps://xxx-x.rtmp.t.me/s/xxxx:xxxx"
```

Trigger via API:

```bash
curl -X POST "http://localhost:1984/api/streams?src=camera1&dst=publish/youtube"
```

## Security Best Practices

1. **Enable authentication** for API and RTSP
2. **Bind sensitive services** to localhost when using reverse proxy
3. **Use HTTPS/TLS** for external access
4. **Restrict API paths** with `allow_paths`
5. **Use environment variables** for passwords: `${PASSWORD}`

```yaml
api:
  listen: "127.0.0.1:1984"     # Localhost only
  username: "admin"
  password: "${ADMIN_PASSWORD}"
  allow_paths: ["/api", "/api/streams"]

rtsp:
  listen: "127.0.0.1:8554"
```

## Troubleshooting

### Connection Issues

- Check stream info: `GET /api/streams?src=camera1`
- Verify URL format and credentials
- Enable debug logging: `log: {webrtc: debug, rtsp: debug}`
- Some cameras require specific user agents or transport modes

### High Latency

- Use WebRTC (lowest latency)
- Disable transcoding: remove codec filters from URL
- Check network bandwidth
- Ensure proper STUN/TURN configuration

### Two-Way Audio Not Working

- Verify camera supports ONVIF backchannel or native protocol
- Add `#backchannel=1` to RTSP URLs
- Use WebRTC player (not generic players)
- Check browser microphone permissions

## References

### Configuration Reference

See `references/config.md` for complete configuration options:
- All YAML settings and defaults
- Environment variable syntax
- Module selection
- Logging configuration
- Network and security options

### API Reference

See `references/api.md` for complete REST API documentation:
- All endpoints with methods and parameters
- Request/response formats
- Authentication methods
- WebSocket endpoints

### Protocols Reference

See `references/protocols.md` for detailed protocol information:
- All supported input sources with examples
- Output format options
- Codec-specific configurations
- Hardware acceleration settings

### Integrations Reference

See `references/integrations.md` for third-party integrations:
- Home Assistant setup (multiple methods)
- HomeKit bridge configuration
- ONVIF discovery and configuration
- Publishing to YouTube, Telegram, etc.
- WebTorrent sharing

### Advanced Features

See `references/advanced.md` for:
- Multi-source stream mixing
- Dynamic stream configuration (expr, echo)
- Hardware acceleration (Intel, AMD, NVIDIA, Rockchip)
- FFmpeg transcoding templates
- Recording and snapshot options
