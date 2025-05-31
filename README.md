# 🖨️ FlashForgeUI-Electron

> Modern cross-platform interface for FlashForge 3D printers, built with Electron

A complete rewrite of FlashForgeUI (C#) bringing enhanced features and better compatibility to all platforms!

## ✨ Feature Comparison
> 💡 FlashForgeUI enables Klipper-like monitoring and control with **no modifications**

| Feature                     |  FlashForgeUI   | OrcaSlicer | Orca-FlashForge | FlashPrint |
|:----------------------------|:---------------:|:----------:|:---------------:|:----------:|
| 🌟 Open Source              |        ✅        |     ✅      |        ❌        |     ❌      |
| 🌍 Cross-Platform           |     ✅ NEW!      |     ✅      |        ✅        |     ✅      |
| 📋 Preview File Metadata    |     ✅ Full      | ⚠️ Limited |   ⚠️ Limited    |     ❌      |
| 📁 List Recent & Local Jobs |        ✅        |     ❌      |   ⚠️ Limited    |     ✅      |
| 🎮 Direct G&M Code Control  |        ✅        |     ❌      |        ❌        |     ❌      |
| 🌐 WebUI Support            |        ✅        |     ❌      |        ❌        |     ❌      |
| 📸 Camera Preview           | ✅ Multi-Device! |     ✅      |        ✅        |     ✅      |

## 🚀 Feature Coverage

> 💡 FlashForgeUI provides more features than all FlashForge software, and is open-source!

| Feature                  |    Legacy Mode    |  New API  |
|:-------------------------|:-----------------:|:---------:|
| 📂 Recent & Local Files  |         ✅         |     ✅     |
| 🖼️ Model Preview Images |     ✅ (Slow)      | ✅ (Fast!) |
| ⚙️ Full Job Control      |         ✅         |     ✅     |
| 💡 LED Control           |         ✅         |     ✅     |
| 📤 Upload New Files      |  ❌ (Not planned)  |     ✅     |
| ℹ️ Printer Information   |    ⚠️ Limited     |     ✅     |
| 📊 Job Information       |  ⚠️ Very Limited  |     ✅     |
| ⏱️ Job Time & ETA        |         ❌         |     ✅     |
| 🎮 G&M Code Control      |         ✅         |     ✅     |
| 📸 Camera Preview        | ⚠️ Setup Required |     ✅     |

## 🔧 Printer Support & Testing Status
> 💡 Legacy Mode *should* support all older network-enabled printers, but support is not yet confirmed.

| Printer Model     | Support Status | Testing Status | API Type         |
|:------------------|:--------------:|:--------------:|:-----------------|
| Adventurer 5X     | ⚠️ In Progress |   ❌ Untested   | HTTP (New) + TCP |
| Adventurer 5M/Pro |     ✅ Full     |    ✅ Tested    | HTTP (New) + TCP |
| Adventurer 3/4    |     ✅ Full     |   ⚠️ Partial   | TCP (Legacy)     |