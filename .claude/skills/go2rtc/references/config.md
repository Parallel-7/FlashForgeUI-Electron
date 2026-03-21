# go2rtc Configuration Reference

Complete reference for all go2rtc.yaml configuration options.

## Configuration File Locations

- **Default**: `go2rtc.yaml` in current working directory
- **Custom path**: `./go2rtc -config path/to/config.yaml`
- **Inline**: `./go2rtc -config 'streams: {camera1: rtsp://url}'`
- **Environment**: Use `${VAR}` or `${VAR:default}` syntax

## Configuration Sections

### streams

Defines stream sources that can be consumed.

```yaml
streams:
  # Stream name as key, URL as value
  camera1: rtsp://admin:password@192.168.1.100:554/stream
  camera2: ffmpeg:rtsp://admin:pass@ip/stream#video=h264#audio=opus

  # Multi-source (combines tracks from multiple sources)
  multi:
    - rtsp://camera1/stream
    - http://camera2/mjpeg
```

### api

Web UI and REST API server configuration.

```yaml
api:
  listen: ":1984"              # Listen address (default: :1984)
  username: "admin"            # Basic auth username
  password: "password"         # Basic auth password
  local_auth: false            # Require auth for localhost (default: false)
  base_path: "/rtc"            # API prefix for reverse proxy
  static_dir: "www"            # Custom static files folder
  origin: "*"                  # CORS origin (only "*" or "" supported)
  tls_listen: ":443"           # HTTPS listen address
  tls_cert: "-----BEGIN CERTIFICATE-----\n..."  # SSL certificate
  tls_key: "-----BEGIN PRIVATE KEY-----\n..."   # SSL private key
  unix_listen: "/tmp/go2rtc.sock"  # Unix socket path
  allow_paths:                 # Restrict API access to specific paths
    - "/api"
    - "/api/streams"
```

### rtsp

RTSP server configuration for streaming out.

```yaml
rtsp:
  listen: ":8554"              # Listen address (default: :8554)
  username: "admin"            # RTSP authentication
  password: "password"
  default_query: "video&audio" # Default probe query
  pkt_size: 1316               # Packet size optimization
```

### webrtc

WebRTC server configuration for lowest-latency streaming.

```yaml
webrtc:
  listen: ":8555"              # Listen address (default: :8555)
  candidates:                  # ICE candidates (STUN/TURN)
    - "216.58.210.174:8555"    # Static public IP
    - "stun:8555"              # Auto-detect via STUN
    - "stun:stun.l.google.com:19302"  # Public STUN server
  ice_servers:                 # Alternative ICE server format
    - urls: ["stun:stun.cloudflare.com:3478"]
    - urls: ["turn:123.123.123.123:3478"]
      username: "user"
      credential: "pass"
  filters:                     # Network filtering
    candidates: ["home.duckdns.org:8555"]
    interfaces: ["eth0", "wlan0"]
    ips: ["192.168.1.100"]
    networks: ["tcp4", "udp4"]
    udp_ports: [10000, 20000]  # UDP port range [min, max]
```

### ffmpeg

FFmpeg integration for transcoding and special sources.

```yaml
ffmpeg:
  bin: "ffmpeg"                # FFmpeg binary path
  global: "-hide_banner"       # Global flags
  timeout: 5                   # Connection timeout
  # Built-in templates
  h264: "-codec:v libx264 -g:v 30 -preset:v superfast -tune:v zerolatency"
  h265: "-codec:v libx265 -g:v 30 -preset:v superfast -tune:v zerolatency"
  opus: "-codec:a libopus -ac 1 -ar 48000 -b:a 64k -application lowdelay"
  pcmu: "-codec:a pcm_mulaw -ac 1 -ar 8000"
  pcma: "-codec:a pcm_alaw -ac 1 -ar 8000"
  aac: "-codec:a aac -ac 2 -ar 48000 -b:a 128k"
  # Custom templates
  mycodec: "-custom ffmpeg args..."
```

### homekit

Export streams to Apple HomeKit.

```yaml
homekit:
  camera1:                     # Stream name as key
    pin: "123-45-678"          # 8-digit PIN or 3-2-3 format
    name: "Front Camera"       # Friendly device name
    device_id: "XX:XX:XX:XX:XX:XX"  # Optional MAC-like device ID
    device_private: "base64_key"    # Private key for pairing
    category_id: "camera"      # camera/doorbell/bridge or numeric
    pairings:                  # Admin credentials
      - "admin:password"
```

### hass

Home Assistant integration.

```yaml
hass:
  config: "/config"            # Path to Home Assistant config
```

### log

Logging configuration.

```yaml
log:
  format: "color"              # color/json/text/empty (auto-detect if empty)
  level: "info"                # Global level: trace/debug/info/warn/error/fatal/panic/disabled
  output: "stdout"             # stdout/stderr/file[:path]
  time: "UNIXMS"              # UNIXMICRO/UNIXNANO/ISO8601

  # Per-module logging (overrides global level)
  api: "debug"
  webrtc: "debug"
  rtsp: "info"
  ffmpeg: "error"              # Special: only shown with exec: debug
  exec: "info"
```

### app

Application-level settings.

```yaml
app:
  modules:                     # Enable only specific modules
    - "api"
    - "ws"
    - "http"
    - "rtsp"
    - "webrtc"
    - "mp4"
    - "hls"
    - "mjpeg"
    - "homekit"
```

### publish

Publish streams to external services.

```yaml
publish:
  youtube: "rtmp://xxx.rtmp.youtube.com/live2/xxxx-xxxx-xxxx"
  telegram: "rtmps://xxx-x.rtmp.t.me/s/xxxx:xxxx"
  custom: "rtmp://server/app/key"
```

### env

Environment variables for substitution.

```yaml
env:
  CAMERA_PASSWORD: "secret123"
  RTSP_USER: "admin"

# Usage in other configs:
streams:
  camera1: rtsp://${RTSP_USER}:${CAMERA_PASSWORD}@ip/stream
```

### wyoming

Wyoming satellite protocol for voice assistants.

```yaml
wyoming:
  stream_name:                 # Stream name as key
    listen: ":10700"           # Listen address
    name: "Satellite Name"     # Optional friendly name
    mode: "mic"                # mic/snd/default
    event:
      start: "echo 'Stream started'"
      stop: "echo 'Stream stopped'"
    wake_uri: "tcp://host:port"  # WAKE service URI
    vad_threshold: 1.0         # Voice activity detection (0.0-2.0)
```

### exec

Restrict executable paths for security.

```yaml
exec:
  allow_paths:
    - "ffmpeg"
    - "/usr/bin/ffmpeg"
```

### echo

Restrict echo command paths.

```yaml
echo:
  allow_paths:
    - "echo"
    - "cat"
```

## Default Ports

| Service | Port | Protocol |
|---------|------|----------|
| API/WebUI | 1984 | HTTP |
| RTSP Server | 8554 | RTSP |
| WebRTC | 8555 | TCP/UDP |
| RTMP | 1935 | RTMP |

## URL Fragment Options

Special options appended to stream URLs with `#`:

```yaml
streams:
  # Two-way audio backchannel
  camera1: rtsp://url#backchannel=1

  # Codec transcoding
  camera2: rtsp://url#video=h264#audio=opus

  # Hardware acceleration
  camera3: rtsp://url#hardware

  # Audio-only
  camera4: rtsp://url#audio

  # Video-only
  camera5: rtsp://url#video

  # Specific codecs
  camera6: rtsp://url#video=h264,h265#audio=opus,aac
```
